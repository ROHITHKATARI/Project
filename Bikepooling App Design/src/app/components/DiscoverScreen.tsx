import { useState, useEffect } from "react";
import { Search, Filter, MapPin, Clock, Users, Star, AlertCircle } from "lucide-react";
import { getAllOpenRides, joinRide, type RidePost } from "../../lib/ridesDb";
import type { UserLocation } from "../../lib/locationService";

interface DiscoverScreenProps {
  onRequest: (ride: { rider: string }) => void;
  userId: string;
  userName: string;
  userLocation?: UserLocation | null;
}

export function DiscoverScreen({
  onRequest,
  userId,
  userName,
  userLocation,
}: DiscoverScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "tomorrow">("all");
  const [allRides, setAllRides] = useState<RidePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Date strings for filter comparison
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  useEffect(() => {
    getAllOpenRides().then((rides) => {
      // Exclude the current user's own rides from discovery
      setAllRides(rides.filter((r) => r.userId !== userId));
      setLoading(false);
    });
  }, [userId]);

  const filtered = allRides.filter((r) => {
    const matchQuery =
      !query ||
      r.from.toLowerCase().includes(query.toLowerCase()) ||
      r.to.toLowerCase().includes(query.toLowerCase()) ||
      r.posterName.toLowerCase().includes(query.toLowerCase());

    const matchFilter =
      filter === "all" ||
      (filter === "today" && r.date === todayStr) ||
      (filter === "tomorrow" && r.date === tomorrowStr);

    return matchQuery && matchFilter;
  });

  const handleJoin = async (ride: RidePost) => {
    if (joinedIds.has(ride.rideId) || joiningId) return;
    setJoiningId(ride.rideId);
    setJoinError(null);
    const result = await joinRide(ride.rideId, userId, userName);
    setJoiningId(null);
    if (result.success) {
      setJoinedIds((prev) => new Set([...prev, ride.rideId]));
      onRequest({ rider: ride.posterName });
    } else {
      setJoinError(result.message);
      setTimeout(() => setJoinError(null), 4000);
    }
  };

  // ── Colour palette for avatars ──────────────────────────────────────
  const avatarColors = [
    "#3b82f6", "#14b8a6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4",
  ];
  const colorFor = (id: string) =>
    avatarColors[Math.abs(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % avatarColors.length];

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const formatDate = (date: string) => {
    if (date === todayStr) return "Today";
    if (date === tomorrowStr) return "Tomorrow";
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${((h % 12) || 12)}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="px-4 pb-8">
      <div className="mb-5">
        <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>
          Discover Rides 🔍
        </h2>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>
          {userLocation
            ? `Rides near ${userLocation.areaName}`
            : "Find the perfect ride for your commute"}
        </p>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border mb-4 focus-within:border-primary transition-all"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderColor: "var(--glass-border)",
        }}
      >
        <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by area, route or rider name..."
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          style={{ fontSize: "0.9rem" }}
        />
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Date filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "today", "tomorrow"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl border capitalize transition-all"
            style={{
              background: filter === f ? "var(--primary)" : "var(--card)",
              color: filter === f ? "white" : "var(--muted-foreground)",
              borderColor: filter === f ? "var(--primary)" : "var(--border)",
              fontWeight: filter === f ? 600 : 400,
              fontSize: "0.85rem",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {joinError && (
        <div
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium"
          style={{ background: "rgba(239,68,68,0.08)", color: "var(--destructive)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {joinError}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl animate-pulse"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", height: "148px" }}
            />
          ))}
        </div>
      )}

      {/* Rides found count */}
      {!loading && (
        <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "12px" }}>
          {filtered.length} ride{filtered.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Ride list */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((ride) => {
            const alreadyJoined = joinedIds.has(ride.rideId);
            const isJoining = joiningId === ride.rideId;
            const noSeats = ride.seatsLeft <= 0;

            return (
              <div
                key={ride.rideId}
                className="p-4 rounded-2xl transition-all hover:shadow-md"
                style={{
                  background: "var(--glass-bg)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: colorFor(ride.userId),
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                  >
                    {initials(ride.posterName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                        {ride.posterName}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#f59e0b" }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>
                          4.8
                        </span>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--primary)" }} />
                      <span
                        style={{ fontSize: "0.82rem", color: "var(--foreground)" }}
                        className="truncate"
                      >
                        {ride.from} → {ride.to}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="flex items-center gap-1"
                        style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}
                      >
                        <Clock className="w-3 h-3" />
                        {formatDate(ride.date)}{ride.time ? `, ${formatTime(ride.time)}` : ""}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}
                      >
                        <Users className="w-3 h-3" />
                        {ride.seatsLeft} seat{ride.seatsLeft !== 1 ? "s" : ""} left
                      </span>
                    </div>
                  </div>
                </div>

                {/* Join button */}
                <button
                  onClick={() => handleJoin(ride)}
                  disabled={alreadyJoined || isJoining || noSeats}
                  className="w-full mt-3 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed"
                  style={{
                    background: alreadyJoined
                      ? "var(--secondary)"
                      : noSeats
                      ? "var(--muted)"
                      : "var(--primary)",
                    color: alreadyJoined
                      ? "var(--primary)"
                      : noSeats
                      ? "var(--muted-foreground)"
                      : "white",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    opacity: alreadyJoined || noSeats ? 0.8 : 1,
                  }}
                >
                  {isJoining ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Joining…
                    </span>
                  ) : alreadyJoined ? (
                    "✓ Joined"
                  ) : noSeats ? (
                    "No seats left"
                  ) : (
                    "Request to Join"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "var(--muted)" }}
          >
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>No rides found</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>
            {allRides.length === 0
              ? "No rides have been posted yet. Be the first to post one!"
              : "Try a different search or filter"}
          </p>
        </div>
      )}
    </div>
  );
}
