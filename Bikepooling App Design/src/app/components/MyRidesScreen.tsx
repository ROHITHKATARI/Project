import { useState, useEffect } from "react";
import { Bike, Clock, MapPin, Users, ChevronRight, Plus, Loader2, Star } from "lucide-react";
import { getRidesByUserId, getJoinedRidesByUserId, type RidePost } from "../../lib/ridesDb";

interface MyRidesScreenProps {
  userId: string;
  userName: string;
  onPostRide: () => void;
  onOpenRide: (ride: RidePost) => void;
}

type Tab = "posted" | "joined";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
  } catch {
    return timeStr;
  }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open:      { bg: "rgba(34,197,94,0.12)", text: "#16a34a", label: "Open" },
  full:      { bg: "rgba(249,115,22,0.12)", text: "#ea580c", label: "Full" },
  cancelled: { bg: "rgba(239,68,68,0.12)",  text: "#dc2626", label: "Cancelled" },
};

function RideCard({ ride, onOpen }: { ride: RidePost; onOpen: () => void }) {
  const status = STATUS_STYLES[ride.status] ?? STATUS_STYLES.open;
  const initials = ride.posterName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#3b82f6", "#8b5cf6", "#14b8a6", "#ec4899", "#f59e0b"];
  const color = colors[ride.posterName.charCodeAt(0) % colors.length];

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.99]"
      style={{
        background: "var(--card)",
        border: "1px solid var(--glass-border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: color, fontWeight: 700, fontSize: "0.8rem" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate" style={{ fontSize: "0.9rem", color: "var(--foreground)" }}>
              {ride.posterName}
            </p>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: status.bg, color: status.text }}
            >
              {status.label}
            </span>
          </div>

          {/* Route */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
              <div className="w-px h-4 border-l border-dashed" style={{ borderColor: "var(--border)" }} />
              <div className="w-2 h-2 rounded-sm" style={{ background: "#f59e0b" }} />
            </div>
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: "0.82rem", color: "var(--foreground)", fontWeight: 500 }}>{ride.from}</span>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground)", fontWeight: 500 }}>{ride.to}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
              <Clock className="w-3 h-3" />
              {formatDate(ride.date)}, {formatTime(ride.time)}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
              <Users className="w-3 h-3" />
              {ride.seatsLeft}/{ride.seats} seats left
            </span>
            {ride.joinedByNames?.length > 0 && (
              <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
                <Star className="w-3 h-3" />
                {ride.joinedByNames.length} joined
              </span>
            )}
          </div>

          {/* Joiners */}
          {ride.joinedByNames?.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {ride.joinedByNames.slice(0, 4).map((name, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    color: "var(--primary)",
                    fontWeight: 500,
                  }}
                >
                  {name.split(" ")[0]}
                </span>
              ))}
              {ride.joinedByNames.length > 4 && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  +{ride.joinedByNames.length - 4} more
                </span>
              )}
            </div>
          )}

          {ride.notes && (
            <p
              className="mt-2 px-3 py-2 rounded-xl text-xs italic"
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
            >
              &ldquo;{ride.notes}&rdquo;
            </p>
          )}

          {/* Tap hint */}
          <div className="mt-3 flex items-center justify-end gap-1" style={{ color: "var(--primary)" }}>
            <span className="text-xs font-semibold">View Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

export function MyRidesScreen({ userId, userName, onPostRide, onOpenRide }: MyRidesScreenProps) {
  const [tab, setTab] = useState<Tab>("posted");
  const [postedRides, setPostedRides] = useState<RidePost[]>([]);
  const [joinedRides, setJoinedRides] = useState<RidePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRidesByUserId(userId), getJoinedRidesByUserId(userId)])
      .then(([posted, joined]) => {
        setPostedRides(posted);
        setJoinedRides(joined);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const rides = tab === "posted" ? postedRides : joinedRides;

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl" style={{ color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
              My Rides
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Track all your bike pooling activity
            </p>
          </div>
          <button
            onClick={onPostRide}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #2563eb, #60a5fa)", boxShadow: "0 4px 14px rgba(59,130,246,0.4)" }}
          >
            <Plus className="w-4 h-4" />
            Post
          </button>
        </div>

        {/* Stats strip */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Rides Posted", value: postedRides.length, color: "#3b82f6", icon: "📤" },
            { label: "Rides Joined", value: joinedRides.length, color: "#8b5cf6", icon: "🤝" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 flex items-center gap-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="font-bold text-lg" style={{ color: s.color, lineHeight: 1 }}>
                  {loading ? "—" : s.value}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-3">
        <div
          className="flex rounded-2xl p-1"
          style={{ background: "var(--secondary)" }}
        >
          {(["posted", "joined"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize"
              style={{
                background: tab === t ? "var(--primary)" : "transparent",
                color: tab === t ? "white" : "var(--muted-foreground)",
                boxShadow: tab === t ? "0 2px 8px rgba(59,130,246,0.35)" : "none",
              }}
            >
              {t === "posted" ? "📤 Posted" : "🤝 Joined"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.08)" }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading your rides…</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.08)" }}
            >
              <Bike className="w-10 h-10" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                {tab === "posted" ? "No rides posted yet" : "You haven't joined any rides"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                {tab === "posted"
                  ? "Share your commute and find dosts!"
                  : "Discover and join rides near you"}
              </p>
            </div>
            <button
              onClick={onPostRide}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary)", boxShadow: "0 4px 14px rgba(59,130,246,0.35)" }}
            >
              <Plus className="w-4 h-4" />
              Post a Ride
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
              {rides.length} {tab === "posted" ? "ride" : "ride"}{rides.length !== 1 ? "s" : ""}
            </p>
            {rides.map((r) => (
              <RideCard key={r.rideId} ride={r} onOpen={() => onOpenRide(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
