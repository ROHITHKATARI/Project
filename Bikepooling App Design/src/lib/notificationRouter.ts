import { getRideById, type RidePost } from "./ridesDb";
import type { StructuredNotificationData } from "./pushNotifications";
import type { NotificationRecord } from "./notificationsDb";

// ─── Tab target within RideDetailScreen ───────────────────────────────
export type RideDetailTab = "details" | "location" | "chat";

// ─── Strongly-typed router action results ─────────────────────────────

/** Open RideDetailScreen for the given ride, optionally on a specific tab. */
export interface RouteToRideAction {
  action: "open_ride";
  ride: RidePost;
  initialTab: RideDetailTab;
}

/** Navigate to a named top-level screen. */
export interface RouteToScreenAction {
  action: "navigate";
  screen: "notifications" | "home" | "profile";
}

/** Nothing to do — router chose to stay put (e.g. unknown type, missing data). */
export interface RouteNoOpAction {
  action: "noop";
}

export type NotificationRouteAction =
  | RouteToRideAction
  | RouteToScreenAction
  | RouteNoOpAction;

// ─── Shared input type accepted by both call sites ────────────────────
// Covers data from:
//   (a) FCM tap  → StructuredNotificationData (from pushNotifications.ts)
//   (b) Inbox tap → NotificationRecord          (from notificationsDb.ts)
export interface RouterInput {
  type?: string;
  rideId?: string;
  notificationId?: string;
}

// ─── Core Router ──────────────────────────────────────────────────────

/**
 * resolveNotificationRoute
 *
 * Single source of truth for notification-driven navigation.
 * Called identically from:
 *   - FCM push tap handler  (App.tsx — background/killed app)
 *   - Inbox item tap        (NotificationsScreen → onSelectNotification)
 *
 * Returns a typed action describing what the UI should do.
 * The caller executes the action (setSelectedRide, navigateTo, etc.).
 *
 * Adding a new notification type in the future means adding one
 * case block here — no other files need to change.
 */
export async function resolveNotificationRoute(
  input: RouterInput
): Promise<NotificationRouteAction> {
  const { type, rideId } = input;

  switch (type) {
    // ── Ride owner: new join request ─────────────────────────────────
    case "RIDE_REQUEST_RECEIVED": {
      if (!rideId) return { action: "navigate", screen: "notifications" };
      const ride = await fetchRide(rideId);
      if (!ride) return { action: "navigate", screen: "notifications" };
      return { action: "open_ride", ride, initialTab: "details" };
    }

    // ── Requester: request was accepted ─────────────────────────────
    case "RIDE_REQUEST_ACCEPTED": {
      if (!rideId) return { action: "navigate", screen: "notifications" };
      const ride = await fetchRide(rideId);
      if (!ride) return { action: "navigate", screen: "notifications" };
      return { action: "open_ride", ride, initialTab: "details" };
    }

    // ── Requester: request was rejected ─────────────────────────────
    case "RIDE_REQUEST_REJECTED": {
      // No meaningful ride context to show — ride detail may show
      // the user as neither pending nor joined. Go to inbox.
      return { action: "navigate", screen: "notifications" };
    }

    // ── Joined member: ride details changed ─────────────────────────
    case "RIDE_UPDATED": {
      if (!rideId) return { action: "navigate", screen: "notifications" };
      const ride = await fetchRide(rideId);
      if (!ride) return { action: "navigate", screen: "notifications" };
      return { action: "open_ride", ride, initialTab: "details" };
    }

    // ── Joined/pending member: ride was cancelled ────────────────────
    case "RIDE_CANCELLED": {
      // Ride may no longer exist — navigate to inbox instead.
      return { action: "navigate", screen: "notifications" };
    }

    // ── Direct chat message in a ride conversation ───────────────────
    case "CHAT_MESSAGE": {
      if (!rideId) return { action: "navigate", screen: "notifications" };
      const ride = await fetchRide(rideId);
      if (!ride) return { action: "navigate", screen: "notifications" };
      return { action: "open_ride", ride, initialTab: "chat" };
    }

    // ── Account / security events ────────────────────────────────────
    case "ACCOUNT_SECURITY": {
      return { action: "navigate", screen: "profile" };
    }

    // ── Welcome, system, promotional ─────────────────────────────────
    case "WELCOME":
    case "SYSTEM_ANNOUNCEMENT":
    case "PROMOTION": {
      return { action: "navigate", screen: "home" };
    }

    // ── Unknown / future types — fallback to inbox ───────────────────
    default: {
      return { action: "navigate", screen: "notifications" };
    }
  }
}

// ─── Adapters ─────────────────────────────────────────────────────────

/**
 * Adapter: convert FCM StructuredNotificationData → RouterInput.
 * Extracts the fields the router needs.
 */
export function routerInputFromFCM(
  data: StructuredNotificationData
): RouterInput {
  return {
    type: data.type,
    rideId: data.rideId,
    notificationId: data.notificationId,
  };
}

/**
 * Adapter: convert a NotificationRecord (inbox tap) → RouterInput.
 * Prefers data.rideId if present (populated by Lambda for future types),
 * falls back to the top-level rideId field.
 */
export function routerInputFromRecord(record: NotificationRecord): RouterInput {
  return {
    type: record.type,
    rideId: record.data?.rideId ?? record.rideId,
    notificationId: record.notificationId,
  };
}

// ─── Private helper ───────────────────────────────────────────────────

async function fetchRide(rideId: string): Promise<RidePost | null> {
  try {
    return await getRideById(rideId);
  } catch (err) {
    console.error("[NotificationRouter] Failed to fetch ride:", rideId, err);
    return null;
  }
}
