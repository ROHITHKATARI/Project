import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Star,
  Bike,
  Bell,
  MessageCircle,
  ShieldCheck,
  Info,
  Loader2,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationRecord,
  type NotificationType,
} from "../../lib/notificationsDb";

interface NotificationsScreenProps {
  onSelectNotification?: (notif: NotificationRecord) => void;
}

// ─── Time Formatting Helper ───────────────────────────────────────────
function formatTimeAgo(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return "Recent";

    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 172800) return "Yesterday";

    const date = new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recent";
  }
}

// ─── Notification Type Visual Config ──────────────────────────────────
interface VisualConfig {
  icon: JSX.Element;
  color: string;
  bg: string;
}

function getVisualConfig(type: NotificationType): VisualConfig {
  switch (type) {
    case "RIDE_REQUEST_RECEIVED":
      return {
        icon: <Bell className="w-5 h-5" />,
        color: "#3b82f6",
        bg: "rgba(59,130,246,0.12)",
      };
    case "RIDE_REQUEST_ACCEPTED":
      return {
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: "#16a34a",
        bg: "rgba(22,163,74,0.12)",
      };
    case "RIDE_REQUEST_REJECTED":
    case "RIDE_CANCELLED":
      return {
        icon: <XCircle className="w-5 h-5" />,
        color: "#dc2626",
        bg: "rgba(220,38,38,0.12)",
      };
    case "RIDE_UPDATED":
    case "RIDE_REMINDER":
    case "RIDE_STARTED":
      return {
        icon: <Bike className="w-5 h-5" />,
        color: "#8b5cf6",
        bg: "rgba(139,92,246,0.12)",
      };
    case "RIDE_COMPLETED":
      return {
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: "#10b981",
        bg: "rgba(16,185,129,0.12)",
      };
    case "CHAT_MESSAGE":
      return {
        icon: <MessageCircle className="w-5 h-5" />,
        color: "#06b6d4",
        bg: "rgba(6,182,212,0.12)",
      };
    case "ACCOUNT_SECURITY":
      return {
        icon: <ShieldCheck className="w-5 h-5" />,
        color: "#6366f1",
        bg: "rgba(99,102,241,0.12)",
      };
    case "PROMOTION":
      return {
        icon: <Star className="w-5 h-5" />,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
      };
    case "SYSTEM_ANNOUNCEMENT":
    default:
      return {
        icon: <Info className="w-5 h-5" />,
        color: "#3b82f6",
        bg: "rgba(59,130,246,0.12)",
      };
  }
}

// ─── Main Screen Component ────────────────────────────────────────────
export function NotificationsScreen({ onSelectNotification }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<Record<string, unknown> | undefined>();

  const loadNotifications = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await getUserNotifications({
        limit: 20,
        exclusiveStartKey: isInitial ? undefined : lastEvaluatedKey,
      });

      setNotifications((prev) => (isInitial ? result.items : [...prev, ...result.items]));
      setLastEvaluatedKey(result.lastEvaluatedKey);
    } catch (err) {
      console.error("[NotificationsScreen] Failed to load notifications:", err);
      setError("Unable to load notifications. Please check your connection and try again.");
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }, [lastEvaluatedKey]);

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const handleNotificationClick = async (notif: NotificationRecord) => {
    if (!notif.read) {
      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notif.notificationId
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );

      // Persist read status in DynamoDB
      markNotificationAsRead(notif.notificationId).catch((err) => {
        console.warn("[NotificationsScreen] Failed to persist read status:", err);
      });
    }

    if (onSelectNotification) {
      onSelectNotification(notif);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;

    setMarkingAll(true);
    // Optimistically update local state
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );

    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.warn("[NotificationsScreen] Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  // ─── Render: Loading State ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 py-16 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Loading notifications...</p>
      </div>
    );
  }

  // ─── Render: Error State ─────────────────────────────────────────────
  if (error) {
    return (
      <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}
        >
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
          Couldn't load notifications
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mb-4">{error}</p>
        <button
          onClick={() => loadNotifications(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Render: Empty State ─────────────────────────────────────────────
  if (notifications.length === 0) {
    return (
      <div className="px-4 py-16 flex flex-col items-center justify-center text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
        >
          <Bell className="w-7 h-7 opacity-60" />
        </div>
        <p className="font-semibold text-base mb-1" style={{ color: "var(--foreground)" }}>
          No notifications yet
        </p>
        <p className="text-xs text-muted-foreground max-w-xs" style={{ lineHeight: 1.5 }}>
          When you receive ride requests, confirmations, or chat messages, they'll appear here.
        </p>
      </div>
    );
  }

  // ─── Render: Notification Feed ───────────────────────────────────────
  return (
    <div className="px-4 pb-8">
      {/* Header Summary & Mark All Read */}
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>
            Notifications
          </h2>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1 transition-all hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--primary)", fontSize: "0.85rem", fontWeight: 500 }}
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Unread / New Notifications */}
      {unread.length > 0 && (
        <div className="space-y-2 mb-6">
          <p
            style={{
              fontWeight: 600,
              fontSize: "0.8rem",
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            New
          </p>
          {unread.map((n) => (
            <NotifCard key={n.notificationId} notif={n} onClick={() => handleNotificationClick(n)} />
          ))}
        </div>
      )}

      {/* Earlier / Read Notifications */}
      {read.length > 0 && (
        <div className="space-y-2">
          {unread.length > 0 && (
            <p
              style={{
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "10px",
              }}
            >
              Earlier
            </p>
          )}
          {read.map((n) => (
            <NotifCard key={n.notificationId} notif={n} onClick={() => handleNotificationClick(n)} />
          ))}
        </div>
      )}

      {/* Pagination: Load More */}
      {lastEvaluatedKey && (
        <div className="mt-6 text-center">
          <button
            onClick={() => loadNotifications(false)}
            disabled={loadingMore}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{
              background: "var(--secondary)",
              color: "var(--foreground)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {loadingMore ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </span>
            ) : (
              "Load earlier notifications"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Notification Item Card ───────────────────────────────────────────
function NotifCard({
  notif,
  onClick,
}: {
  notif: NotificationRecord;
  onClick: () => void;
}) {
  const { icon, color, bg } = getVisualConfig(notif.type);
  const timeLabel = formatTimeAgo(notif.createdAt);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-2xl transition-all hover:shadow-sm cursor-pointer active:scale-[0.99]"
      style={{
        background: notif.read ? "var(--glass-bg)" : "var(--secondary)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
        borderLeft: notif.read ? "1px solid var(--glass-border)" : `3px solid ${color}`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: bg, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
          {notif.title}
        </p>
        <p
          className="text-muted-foreground mt-0.5"
          style={{ fontSize: "0.82rem", lineHeight: 1.5 }}
        >
          {notif.body}
        </p>
        <p className="mt-1.5" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
          {timeLabel}
        </p>
      </div>
      {!notif.read && (
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: color }}
        />
      )}
    </div>
  );
}
