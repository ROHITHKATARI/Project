import { CheckCircle2, XCircle, Star, Bike, Bell } from "lucide-react";

interface Notification {
  id: string;
  type: "match_request" | "match_accepted" | "match_rejected" | "ride_reminder" | "rating";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  {
    id: "n1",
    type: "match_request",
    title: "New ride request",
    message: "Kavya Reddy wants to join your ride to Electronic City",
    time: "2 min ago",
    read: false,
  },
  {
    id: "n2",
    type: "match_accepted",
    title: "Request accepted! 🎉",
    message: "Rahul Dev accepted your join request for the Koramangala → Whitefield ride",
    time: "1 hour ago",
    read: false,
  },
  {
    id: "n3",
    type: "ride_reminder",
    title: "Ride in 30 minutes",
    message: "Your ride with Priya Sharma departs at 8:30 AM from Indiranagar",
    time: "3 hours ago",
    read: true,
  },
  {
    id: "n4",
    type: "rating",
    title: "New rating received",
    message: "Sneha Nair gave you 5 stars! \"Very punctual and friendly rider\"",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n5",
    type: "match_rejected",
    title: "Request declined",
    message: "Aryan Gupta couldn't accommodate your join request this time",
    time: "2 days ago",
    read: true,
  },
];

const iconMap = {
  match_request: { icon: <Bell className="w-5 h-5" />, color: "#3b82f6", bg: "#dbeafe" },
  match_accepted: { icon: <CheckCircle2 className="w-5 h-5" />, color: "#16a34a", bg: "#dcfce7" },
  match_rejected: { icon: <XCircle className="w-5 h-5" />, color: "#dc2626", bg: "#fee2e2" },
  ride_reminder: { icon: <Bike className="w-5 h-5" />, color: "#8b5cf6", bg: "#ede9fe" },
  rating: { icon: <Star className="w-5 h-5" />, color: "#f59e0b", bg: "#fef3c7" },
};

export function NotificationsScreen() {
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>Notifications</h2>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.875rem" }}>
            {unread.length} unread
          </p>
        </div>
        <button style={{ color: "var(--primary)", fontSize: "0.85rem", fontWeight: 500 }}>Mark all read</button>
      </div>

      {unread.length > 0 && (
        <div className="space-y-2 mb-6">
          <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
            New
          </p>
          {unread.map((n) => <NotifCard key={n.id} notif={n} />)}
        </div>
      )}

      {read.length > 0 && (
        <div className="space-y-2">
          <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
            Earlier
          </p>
          {read.map((n) => <NotifCard key={n.id} notif={n} />)}
        </div>
      )}
    </div>
  );
}

function NotifCard({ notif }: { notif: Notification }) {
  const { icon, color, bg } = iconMap[notif.type];
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl transition-all hover:shadow-sm cursor-pointer"
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
        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>{notif.title}</p>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
          {notif.message}
        </p>
        <p className="mt-1.5" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>{notif.time}</p>
      </div>
      {!notif.read && (
        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
      )}
    </div>
  );
}
