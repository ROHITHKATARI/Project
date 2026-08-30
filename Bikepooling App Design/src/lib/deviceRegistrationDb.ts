import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Capacitor } from "@capacitor/core";
import { getAWSCredentials, getCurrentAuthUser } from "./auth";
import { AWS_CONFIG } from "./aws-config";

// ─── Table & Storage Constants ─────────────────────────────────────────
export const NOTIFICATION_DEVICES_TABLE = "dostwheels-notification-devices";
export const DEVICE_ID_STORAGE_KEY = "dostwheels_device_id";

// ─── Types ────────────────────────────────────────────────────────────
export type DevicePlatform = "android" | "ios" | "web";
export type DeviceStatus = "active" | "inactive";

export interface NotificationDeviceRecord {
  userId: string;        // Partition Key: Cognito User Pool sub
  deviceId: string;      // Sort Key: Stable per-installation UUID
  token: string;         // FCM Registration Token
  platform: DevicePlatform;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  status: DeviceStatus;
  createdAt: string;     // ISO 8601 timestamp
  updatedAt: string;     // ISO 8601 timestamp
  lastSeenAt: string;    // ISO 8601 timestamp
}

export interface RegisterDeviceOptions {
  userId?: string;       // Optional override; must match authenticated Cognito sub
  token: string;         // FCM Registration Token
  platform?: DevicePlatform;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  forceRefresh?: boolean;
}

// ─── Security Helpers ──────────────────────────────────────────────────
/** Mask sensitive FCM token for safe diagnostic logging */
export function maskToken(token: string): string {
  if (!token || token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

// ─── Device ID Management ──────────────────────────────────────────────
/**
 * Obtain or generate a stable per-installation device ID.
 * - Reuses existing ID from localStorage if present.
 * - Otherwise generates a unique UUID and persists it.
 * - Never re-generates on every app launch.
 * - Never uses the FCM token as the device ID.
 */
export function getOrCreateDeviceId(): string {
  try {
    const existingId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existingId && existingId.trim().length > 0) {
      return existingId.trim();
    }
    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    return newId;
  } catch {
    // In restricted environments where localStorage might throw
    return `dev_ephemeral_${Date.now()}`;
  }
}

/** Detect platform metadata safely from runtime environment */
function detectDefaultPlatform(): DevicePlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "android") return "android";
  if (platform === "ios") return "ios";
  return "web";
}

function detectDeviceModel(): string {
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent;
    const match = ua.match(/;\s*([^;]+?)\s*(?:Build\/|\))/i);
    if (match && match[1] && !match[1].startsWith("Android")) {
      return match[1].trim();
    }
    if (navigator.platform) {
      return navigator.platform;
    }
  }
  return "Unknown Device";
}

function detectOsVersion(): string {
  if (typeof navigator !== "undefined") {
    const match = navigator.userAgent.match(/Android\s([0-9\.]+)/);
    if (match) return `Android ${match[1]}`;
  }
  return "Unknown OS";
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

// ─── Core Data Layer Functions ─────────────────────────────────────────

/**
 * Register or update the current device's FCM token in DynamoDB.
 *
 * Security & Ownership:
 * - The userId is strictly verified against the authenticated Cognito User Pool sub.
 * - Uses DynamoDB UpdateCommand with if_not_exists(createdAt, :now) to ensure idempotent upsert
 *   without generating duplicate records for the same userId + deviceId.
 * - Sets status = "active".
 */
export async function registerDeviceToken(
  options: RegisterDeviceOptions
): Promise<NotificationDeviceRecord | null> {
  const {
    token,
    platform = detectDefaultPlatform(),
    deviceModel = detectDeviceModel(),
    osVersion = detectOsVersion(),
    appVersion = "1.0.0",
    forceRefresh = false,
  } = options;

  if (!token || token.trim().length === 0) {
    console.warn("[DeviceRegistration] Registration skipped: empty FCM token");
    return null;
  }

  // 1. Resolve & verify authenticated Cognito User Pool sub
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = options.userId || authUser?.userId;

  if (!resolvedUserId) {
    console.warn("[DeviceRegistration] Registration skipped: no authenticated Cognito user");
    return null;
  }

  // If both were provided, verify they match to prevent cross-user writes
  if (authUser?.userId && options.userId && options.userId !== authUser.userId) {
    console.error("[DeviceRegistration] Security mismatch: provided userId does not match session sub");
    return null;
  }

  const deviceId = getOrCreateDeviceId();
  const now = new Date().toISOString();

  try {
    const docClient = await getDocClient(forceRefresh);

    await docClient.send(
      new UpdateCommand({
        TableName: NOTIFICATION_DEVICES_TABLE,
        Key: {
          userId: resolvedUserId,
          deviceId: deviceId,
        },
        UpdateExpression:
          "SET #token = :token, #platform = :platform, #deviceModel = :deviceModel, #osVersion = :osVersion, #appVersion = :appVersion, #status = :status, #updatedAt = :now, #lastSeenAt = :now, #createdAt = if_not_exists(#createdAt, :now)",
        ExpressionAttributeNames: {
          "#token": "token",
          "#platform": "platform",
          "#deviceModel": "deviceModel",
          "#osVersion": "osVersion",
          "#appVersion": "appVersion",
          "#status": "status",
          "#updatedAt": "updatedAt",
          "#lastSeenAt": "lastSeenAt",
          "#createdAt": "createdAt",
        },
        ExpressionAttributeValues: {
          ":token": token.trim(),
          ":platform": platform,
          ":deviceModel": deviceModel,
          ":osVersion": osVersion,
          ":appVersion": appVersion,
          ":status": "active" as DeviceStatus,
          ":now": now,
        },
      })
    );

    console.log(
      `[DeviceRegistration] Device registered successfully [deviceId=${deviceId}, token=${maskToken(token)}]`
    );

    return {
      userId: resolvedUserId,
      deviceId,
      token: token.trim(),
      platform,
      deviceModel,
      osVersion,
      appVersion,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[DeviceRegistration] Failed to register device token in DynamoDB:", errorMsg);
    throw err;
  }
}

/**
 * Deactivate a device token on logout or permission revocation.
 *
 * Security & Ownership:
 * - Updates status to "inactive".
 * - Does NOT delete the database record.
 * - Does NOT remove the persistent local deviceId.
 * - Only operates on the authenticated user's own partition.
 */
export async function deactivateDeviceToken(
  userId?: string,
  deviceId?: string,
  forceRefresh = false
): Promise<boolean> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId) {
    console.warn("[DeviceRegistration] Deactivation skipped: no authenticated Cognito user");
    return false;
  }

  const targetDeviceId = deviceId || getOrCreateDeviceId();
  const now = new Date().toISOString();

  try {
    const docClient = await getDocClient(forceRefresh);

    await docClient.send(
      new UpdateCommand({
        TableName: NOTIFICATION_DEVICES_TABLE,
        Key: {
          userId: resolvedUserId,
          deviceId: targetDeviceId,
        },
        UpdateExpression: "SET #status = :inactive, #updatedAt = :now",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":inactive": "inactive" as DeviceStatus,
          ":now": now,
        },
      })
    );

    console.log(`[DeviceRegistration] Device deactivated [deviceId=${targetDeviceId}]`);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[DeviceRegistration] Failed to deactivate device in DynamoDB:", errorMsg);
    return false;
  }
}

/**
 * Fetch the current device record for the authenticated user.
 */
export async function getDeviceRegistration(
  userId?: string,
  deviceId?: string,
  forceRefresh = false
): Promise<NotificationDeviceRecord | null> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId) return null;
  const targetDeviceId = deviceId || getOrCreateDeviceId();

  try {
    const docClient = await getDocClient(forceRefresh);
    const result = await docClient.send(
      new GetCommand({
        TableName: NOTIFICATION_DEVICES_TABLE,
        Key: {
          userId: resolvedUserId,
          deviceId: targetDeviceId,
        },
      })
    );

    return (result.Item as NotificationDeviceRecord) ?? null;
  } catch (err) {
    console.error("[DeviceRegistration] Failed to get device registration:", err);
    return null;
  }
}

/**
 * List all registered devices for the current authenticated user.
 * Scoped strictly to the caller's own partition key (userId).
 */
export async function getUserDevices(
  userId?: string,
  forceRefresh = false
): Promise<NotificationDeviceRecord[]> {
  const authUser = await getCurrentAuthUser();
  const resolvedUserId = userId || authUser?.userId;

  if (!resolvedUserId) return [];

  try {
    const docClient = await getDocClient(forceRefresh);
    const result = await docClient.send(
      new QueryCommand({
        TableName: NOTIFICATION_DEVICES_TABLE,
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: {
          "#uid": "userId",
        },
        ExpressionAttributeValues: {
          ":uid": resolvedUserId,
        },
      })
    );

    return (result.Items as NotificationDeviceRecord[]) ?? [];
  } catch (err) {
    console.error("[DeviceRegistration] Failed to query user devices:", err);
    return [];
  }
}
