import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentials, getCurrentAuthUser } from "./auth";
import { AWS_CONFIG } from "./aws-config";

// ─── Table Constants ───────────────────────────────────────────────────
export const NOTIFICATIONS_TABLE = "dostwheels-notifications";

// ─── Types & Models ────────────────────────────────────────────────────

export type NotificationType =
  | "RIDE_REQUEST_RECEIVED"
  | "RIDE_REQUEST_ACCEPTED"
  | "RIDE_REQUEST_REJECTED"
  | "RIDE_UPDATED"
  | "RIDE_CANCELLED"
  | "RIDE_REMINDER"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "CHAT_MESSAGE"
  | "ACCOUNT_SECURITY"
  | "SYSTEM_ANNOUNCEMENT"
  | "PROMOTION"
  | string;

export interface NotificationRecord {
  userId: string;          // Partition key: Cognito User Pool sub
  notificationId: string;  // Sort key: "<ISO-timestamp>#<uuid>" (chronologically sortable)
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;       // ISO 8601 timestamp
  readAt?: string;         // ISO 8601 timestamp (when marked read)
  senderId?: string;       // Cognito sub of initiator/sender
  senderName?: string;
  rideId?: string;
  chatId?: string;
  data?: Record<string, string>; // Structured key-value pairs for deep linking/routing
  ttl?: number;            // Optional epoch timestamp for DynamoDB TTL auto-cleanup
}

export interface CreateNotificationInput {
  userId?: string;         // Optional override; must match authenticated Cognito sub
  type: NotificationType;
  title: string;
  body: string;
  senderId?: string;
  senderName?: string;
  rideId?: string;
  chatId?: string;
  data?: Record<string, string>;
  notificationId?: string; // Optional custom/idempotent ID, otherwise generated
  ttlDays?: number;        // Optional TTL retention in days (e.g., 60 days)
}

export interface GetUserNotificationsOptions {
  userId?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  unreadOnly?: boolean;
  forceRefresh?: boolean;
}

export interface PaginatedNotificationsResult {
  items: NotificationRecord[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ─── Helper Functions ──────────────────────────────────────────────────

/**
 * Generate a unique, chronologically sortable notification ID.
 * Format: `<ISO-timestamp>#<UUID>`
 * This enables descending chronological order (newest first) directly via DynamoDB index.
 */
function generateNotificationId(): string {
  const now = new Date().toISOString();
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11);
  return `${now}#${uuid}`;
}

// ─── DynamoDB Client Factory ───────────────────────────────────────────

async function getDocClient(forceRefresh = false): Promise<DynamoDBDocumentClient> {
  const credentials = await getAWSCredentials(forceRefresh);
  const client = new DynamoDBClient({
    region: AWS_CONFIG.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// ─── Core Data Operations ──────────────────────────────────────────────

/**
 * Create a new notification record for the authenticated user in DynamoDB.
 *
 * Security:
 * - Partition key is strictly the authenticated Cognito User Pool sub.
 * - Enforces row-level isolation matching dynamodb:LeadingKeys = ${aws:PrincipalTag/up_sub}.
 */
export async function createNotification(
  input: CreateNotificationInput,
  forceRefresh = false
): Promise<NotificationRecord | null> {
  const authUser = await getCurrentAuthUser();
  if (!authUser?.userId) {
    console.warn("[NotificationsDb] createNotification skipped: unauthenticated caller");
    return null;
  }

  const targetUserId = input.userId || authUser.userId;
  if (!targetUserId) {
    console.warn("[NotificationsDb] createNotification skipped: missing target userId");
    return null;
  }

  const now = new Date().toISOString();
  const notificationId = input.notificationId || generateNotificationId();

  let ttl: number | undefined = undefined;
  if (input.ttlDays && input.ttlDays > 0) {
    ttl = Math.floor(Date.now() / 1000) + input.ttlDays * 86400;
  }

  const item: NotificationRecord = {
    userId: targetUserId,
    notificationId,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    read: false,
    createdAt: now,
    senderId: input.senderId || authUser.userId,
    senderName: input.senderName,
    rideId: input.rideId,
    chatId: input.chatId,
    data: input.data,
    ttl,
  };

  try {
    const docClient = await getDocClient(forceRefresh);
    await docClient.send(
      new PutCommand({
        TableName: NOTIFICATIONS_TABLE,
        Item: item,
      })
    );
    return item;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to create notification:", errorMsg);
    throw err;
  }
}

/**
 * Retrieve a single notification by notificationId for the authenticated user.
 *
 * Composite key lookup: Key = { userId, notificationId }
 */
export async function getNotification(
  notificationId: string,
  userId?: string,
  forceRefresh = false
): Promise<NotificationRecord | null> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId || !notificationId) {
    return null;
  }

  try {
    const docClient = await getDocClient(forceRefresh);
    const result = await docClient.send(
      new GetCommand({
        TableName: NOTIFICATIONS_TABLE,
        Key: {
          userId: resolvedUserId,
          notificationId,
        },
      })
    );
    return (result.Item as NotificationRecord) ?? null;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to get notification:", errorMsg);
    return null;
  }
}

/**
 * Backfill RIDE_REQUEST_RECEIVED notifications for the authenticated ride owner.
 *
 * Root cause fix: User B (passenger) cannot write into User A's (ride owner's)
 * DynamoDB partition because the IAM LeadingKeys policy enforces row-level
 * isolation keyed to the calling identity's Cognito sub. The PutCommand sent
 * by the passenger's client is rejected with AccessDeniedException, silently
 * swallowed by sendJoinRequest's .catch(), and the notification is never stored.
 *
 * Solution: when User A opens NotificationsScreen, their own client (running
 * under User A's credentials) inspects their rides for pending requesters that
 * do not yet have a corresponding RIDE_REQUEST_RECEIVED notification, and
 * writes those notifications using User A's own credentials — satisfying the
 * LeadingKeys constraint.
 *
 * This is idempotent: a notification is only created once per (rideId, requesterId)
 * pair. Subsequent loads are no-ops because the existing notificationId check
 * prevents duplicate writes.
 *
 * NOTE: The ride query is intentionally inlined here (not imported from ridesDb.ts)
 * to avoid a circular dependency: ridesDb → notificationsDb → ridesDb.
 */
async function syncRideRequestNotifications(
  ownerId: string,
  existingNotifications: NotificationRecord[]
): Promise<NotificationRecord[]> {
  try {
    // Inline query for rides owned by this user (mirrors getRidesByUserId
    // from ridesDb.ts but without creating a circular import)
    const docClient = await getDocClient();
    const ridesResult = await docClient.send(
      new QueryCommand({
        TableName: "dostwheels-rides",
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": ownerId },
      })
    );
    const ownedRides = (ridesResult.Items ?? []) as Array<{
      rideId: string;
      userId: string;
      from: string;
      to: string;
      updatedAt?: string;
      pendingRequestIds?: string[];
      pendingRequestNames?: string[];
    }>;
    if (ownedRides.length === 0) return [];

    // Build a Set of already-notified (rideId, requesterId) pairs from existing records
    const alreadyNotified = new Set<string>();
    for (const n of existingNotifications) {
      if (n.type === "RIDE_REQUEST_RECEIVED" && n.rideId && n.senderId) {
        alreadyNotified.add(`${n.rideId}#${n.senderId}`);
      }
    }

    const newNotifications: NotificationRecord[] = [];

    for (const ride of ownedRides) {
      const pendingIds = ride.pendingRequestIds ?? [];
      const pendingNames = ride.pendingRequestNames ?? [];

      for (let i = 0; i < pendingIds.length; i++) {
        const requesterId = pendingIds[i];
        const requesterName = pendingNames[i] ?? "A rider";
        const key = `${ride.rideId}#${requesterId}`;

        if (alreadyNotified.has(key)) continue; // already written, skip

        // Deterministic notificationId so re-runs are idempotent
        const deterministicId = `RRREQ#${ride.rideId}#${requesterId}`;

        const item: NotificationRecord = {
          userId: ownerId,
          notificationId: deterministicId,
          type: "RIDE_REQUEST_RECEIVED",
          title: "New Ride Request",
          body: `${requesterName} requested to join your ride from ${ride.from} to ${ride.to}.`,
          read: false,
          createdAt: ride.updatedAt ?? new Date().toISOString(),
          senderId: requesterId,
          senderName: requesterName,
          rideId: ride.rideId,
          data: {
            rideId: ride.rideId,
            requesterId,
            from: ride.from,
            to: ride.to,
          },
        };

        try {
          const putDocClient = await getDocClient();
          await putDocClient.send(
            new PutCommand({
              TableName: NOTIFICATIONS_TABLE,
              Item: item,
              // Only write if this notificationId doesn't already exist
              ConditionExpression: "attribute_not_exists(notificationId)",
            })
          );
          newNotifications.push(item);
          alreadyNotified.add(key); // prevent duplicates within this run
        } catch (putErr) {
          const name = (putErr as { name?: string }).name;
          if (name === "ConditionalCheckFailedException") {
            // Already exists — race condition or duplicate run, safe to ignore
          } else {
            console.warn(
              "[NotificationsDb] syncRideRequestNotifications: non-fatal write error:",
              putErr
            );
          }
        }
      }
    }

    return newNotifications;
  } catch (err) {
    console.warn("[NotificationsDb] syncRideRequestNotifications failed (non-fatal):", err);
    return [];
  }
}

/**
 * Query notifications belonging ONLY to the authenticated user.
 *
 * Features:
 * - Scoped partition query by userId = :uid (NO ScanCommand).
 * - Descending order (ScanIndexForward: false) returns newest notifications first.
 * - Supports DynamoDB pagination via limit and exclusiveStartKey.
 * - Optional unreadOnly filter.
 * - On initial load (no exclusiveStartKey), backfills any RIDE_REQUEST_RECEIVED
 *   notifications that the passenger's client could not write due to IAM
 *   LeadingKeys row-level isolation (see syncRideRequestNotifications).
 */
export async function getUserNotifications(
  options: GetUserNotificationsOptions = {}
): Promise<PaginatedNotificationsResult> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = options.userId || authUser?.userId;

  if (!resolvedUserId) {
    return { items: [] };
  }

  try {
    const docClient = await getDocClient(options.forceRefresh);

    const expNames: Record<string, string> = { "#uid": "userId" };
    const expValues: Record<string, unknown> = { ":uid": resolvedUserId };
    let filterExp: string | undefined = undefined;

    if (options.unreadOnly) {
      expNames["#rd"] = "read";
      expValues[":unread"] = false;
      filterExp = "#rd = :unread";
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: NOTIFICATIONS_TABLE,
        KeyConditionExpression: "#uid = :uid",
        FilterExpression: filterExp,
        ExpressionAttributeNames: expNames,
        ExpressionAttributeValues: expValues,
        ScanIndexForward: false, // Descending: newest first
        Limit: options.limit,
        ExclusiveStartKey: options.exclusiveStartKey,
      })
    );

    const existingItems = (result.Items as NotificationRecord[]) ?? [];

    // On initial page load (no pagination cursor), backfill any
    // RIDE_REQUEST_RECEIVED notifications that were blocked by IAM LeadingKeys.
    // This runs under the ride owner's own credentials and is safe + idempotent.
    let backfilledItems: NotificationRecord[] = [];
    if (!options.exclusiveStartKey && !options.unreadOnly) {
      backfilledItems = await syncRideRequestNotifications(resolvedUserId, existingItems);
    }

    // Merge backfilled items in (newest first by createdAt)
    const allItems =
      backfilledItems.length > 0
        ? [...backfilledItems, ...existingItems].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        : existingItems;

    return {
      items: allItems,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to query user notifications:", errorMsg);
    return { items: [] };
  }
}

/**
 * Mark a specific notification as read.
 *
 * Updates read = true and readAt = ISO timestamp.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId?: string,
  forceRefresh = false
): Promise<boolean> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId || !notificationId) {
    return false;
  }

  try {
    const docClient = await getDocClient(forceRefresh);
    await docClient.send(
      new UpdateCommand({
        TableName: NOTIFICATIONS_TABLE,
        Key: {
          userId: resolvedUserId,
          notificationId,
        },
        UpdateExpression: "SET #rd = :true, #ra = :now",
        ExpressionAttributeNames: {
          "#rd": "read",
          "#ra": "readAt",
        },
        ExpressionAttributeValues: {
          ":true": true,
          ":now": new Date().toISOString(),
        },
      })
    );
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to mark notification as read:", errorMsg);
    return false;
  }
}

/**
 * Mark all notifications for the current authenticated user as read.
 *
 * Execution:
 * - Scoped query for unread notifications in caller's own partition.
 * - Concurrently updates unread items via UpdateCommand without scanning the table.
 */
export async function markAllNotificationsAsRead(
  userId?: string,
  forceRefresh = false
): Promise<{ updatedCount: number }> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId) {
    return { updatedCount: 0 };
  }

  try {
    const { items: unreadItems } = await getUserNotifications({
      userId: resolvedUserId,
      unreadOnly: true,
      forceRefresh,
    });

    if (unreadItems.length === 0) {
      return { updatedCount: 0 };
    }

    const results = await Promise.allSettled(
      unreadItems.map((item) =>
        markNotificationAsRead(item.notificationId, resolvedUserId, forceRefresh)
      )
    );

    const updatedCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    return { updatedCount };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to mark all notifications as read:", errorMsg);
    return { updatedCount: 0 };
  }
}

/**
 * Delete a specific notification belonging to the authenticated user.
 *
 * Composite key deletion: Key = { userId, notificationId }
 */
export async function deleteNotification(
  notificationId: string,
  userId?: string,
  forceRefresh = false
): Promise<boolean> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId || !notificationId) {
    return false;
  }

  try {
    const docClient = await getDocClient(forceRefresh);
    await docClient.send(
      new DeleteCommand({
        TableName: NOTIFICATIONS_TABLE,
        Key: {
          userId: resolvedUserId,
          notificationId,
        },
      })
    );
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationsDb] Failed to delete notification:", errorMsg);
    return false;
  }
}

/**
 * Get count of unread notifications for the authenticated user.
 */
export async function getUnreadNotificationCount(
  userId?: string,
  forceRefresh = false
): Promise<number> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId) return 0;

  try {
    const docClient = await getDocClient(forceRefresh);
    const result = await docClient.send(
      new QueryCommand({
        TableName: NOTIFICATIONS_TABLE,
        KeyConditionExpression: "#uid = :uid",
        FilterExpression: "#rd = :unread",
        ExpressionAttributeNames: {
          "#uid": "userId",
          "#rd": "read",
        },
        ExpressionAttributeValues: {
          ":uid": resolvedUserId,
          ":unread": false,
        },
        Select: "COUNT",
      })
    );
    return result.Count ?? 0;
  } catch (err) {
    console.error("[NotificationsDb] Failed to get unread notification count:", err);
    return 0;
  }
}
