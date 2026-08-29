import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";

// ─── Structured Payload Types ─────────────────────────────────────────
export type NotificationEventType =
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

export interface StructuredNotificationData {
  type?: NotificationEventType;
  rideId?: string;
  chatId?: string;
  notificationId?: string;
  [key: string]: unknown;
}

// ─── State & Listeners ────────────────────────────────────────────────
let currentFCMToken: string | null = null;
const tokenListeners = new Set<(token: string) => void>();
const foregroundListeners = new Set<(notification: PushNotificationSchema) => void>();
const actionListeners = new Set<(action: ActionPerformed, data: StructuredNotificationData) => void>();
let isInitialized = false;

// ─── Token Accessors ──────────────────────────────────────────────────
export function getCachedFCMToken(): string | null {
  if (currentFCMToken) return currentFCMToken;
  try {
    return localStorage.getItem("dostwheels_fcm_token");
  } catch {
    return null;
  }
}

export function subscribeToFCMToken(listener: (token: string) => void): () => void {
  tokenListeners.add(listener);
  const existing = getCachedFCMToken();
  if (existing) {
    listener(existing);
  }
  return () => tokenListeners.delete(listener);
}

export function subscribeToForegroundNotifications(
  listener: (notification: PushNotificationSchema) => void
): () => void {
  foregroundListeners.add(listener);
  return () => foregroundListeners.delete(listener);
}

export function subscribeToNotificationActions(
  listener: (action: ActionPerformed, data: StructuredNotificationData) => void
): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

// ─── Channel Setup (Android) ──────────────────────────────────────────
async function setupAndroidChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    // Default High Priority Channel for Ride & Chat Notifications
    await PushNotifications.createChannel({
      id: "dostwheels_alerts",
      name: "Ride & Chat Alerts",
      description: "Critical notifications for ride updates, join requests, and direct chat messages",
      importance: 5, // High / Heads-up
      visibility: 1, // Public
      vibration: true,
      lights: true,
      lightColor: "#2E5BFF",
    });

    await PushNotifications.createChannel({
      id: "dostwheels_general",
      name: "General Announcements",
      description: "Updates, promotions, and general announcements",
      importance: 3, // Default
      visibility: 1,
      vibration: true,
    });

    console.log("[FCM] Android notification channels initialized");
  } catch (err) {
    console.warn("[FCM] Failed to create notification channels:", err);
  }
}

// ─── Core Initialization ──────────────────────────────────────────────
export async function initializeFCM(options?: {
  onTap?: (data: StructuredNotificationData) => void;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log("[FCM] Push notifications skipped (running in Web environment)");
    return { success: false, error: "Push notifications only supported on native Android/iOS" };
  }

  if (isInitialized) {
    return { success: true, token: currentFCMToken ?? getCachedFCMToken() ?? undefined };
  }

  try {
    await setupAndroidChannels();

    // 1. Check & Request Permissions
    let permStatus = await PushNotifications.checkPermissions();
    console.log("[FCM] Initial permission status:", permStatus.receive);

    if (permStatus.receive === "prompt" || permStatus.receive === "prompt-with-rationale") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.warn("[FCM] Notification permission not granted:", permStatus.receive);
      return { success: false, error: `Notification permission status: ${permStatus.receive}` };
    }

    // 2. Register FCM Listeners
    await PushNotifications.removeAllListeners();

    // Registration Success / Token Refresh
    await PushNotifications.addListener("registration", (token: Token) => {
      console.log("[FCM] Registration token received:", token.value);
      currentFCMToken = token.value;
      try {
        localStorage.setItem("dostwheels_fcm_token", token.value);
      } catch (e) {
        console.warn("[FCM] LocalStorage save failed:", e);
      }
      tokenListeners.forEach((cb) => {
        try {
          cb(token.value);
        } catch (e) {
          console.error("[FCM] Token listener error:", e);
        }
      });
    });

    // Registration Error
    await PushNotifications.addListener("registrationError", (err: unknown) => {
      console.error("[FCM] Registration error:", err);
    });

    // Foreground Notification Received
    await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      console.log("[FCM] Foreground notification received:", notification);
      foregroundListeners.forEach((cb) => {
        try {
          cb(notification);
        } catch (e) {
          console.error("[FCM] Foreground listener error:", e);
        }
      });
    });

    // Notification Action / Tap (Background or Closed app entry)
    await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      console.log("[FCM] Notification action performed (tap):", action);
      const rawData = (action.notification.data || {}) as Record<string, unknown>;

      const structuredData: StructuredNotificationData = {
        type: (rawData.type as NotificationEventType) || undefined,
        rideId: (rawData.rideId as string) || (rawData.ride_id as string) || undefined,
        chatId: (rawData.chatId as string) || (rawData.chat_id as string) || undefined,
        notificationId: (rawData.notificationId as string) || (rawData.notification_id as string) || undefined,
        ...rawData,
      };

      if (options?.onTap) {
        try {
          options.onTap(structuredData);
        } catch (e) {
          console.error("[FCM] onTap handler error:", e);
        }
      }

      actionListeners.forEach((cb) => {
        try {
          cb(action, structuredData);
        } catch (e) {
          console.error("[FCM] Action listener error:", e);
        }
      });
    });

    // 3. Register with Apple / Google APNs & FCM
    await PushNotifications.register();
    isInitialized = true;
    console.log("[FCM] PushNotifications.register() completed");

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[FCM] initializeFCM failure:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
