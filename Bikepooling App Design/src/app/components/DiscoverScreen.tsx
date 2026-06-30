import { useState } from "react";
import { Search, Filter, MapPin, Clock, Users, Star } from "lucide-react";

const allRides = [
  { id: "d1", from: "Koramangala", to: "Whitefield", time: "8:00 AM", date: "Today", seats: 1, rider: "Aditya K.", rating: 4.9, color: "#3b82f6" },
  { id: "d2", from: "HSR Layout", to: "Electronic City", time: "8:30 AM", date: "Today", seats: 2, rider: "Deepa R.", rating: 4.7, color: "#14b8a6" },
  { id: "d3", from: "Indiranagar", to: "MG Road", time: "9:15 AM", date: "Today", seats: 1, rider: "Vivek M.", rating: 4.8, color: "#8b5cf6" },
  { id: "d4", from: "BTM Layout", to: "Silk Board", time: "7:45 AM", date: "Tomorrow", seats: 2, rider: "Ananya S.", rating: 5.0, color: "#ec4899" },
  { id: "d5", from: "JP Nagar", to: "Marathahalli", time: "10:00 AM", date: "Tomorrow", seats: 1, rider: "Rohan P.", rating: 4.6, color: "#f59e0b" },
  { id: "d6", from: "Rajajinagar", to: "Hebbal", time: "8:00 AM", date: "Jun 7", seats: 3, rider: "Nisha T.", rating: 4.8, color: "#06b6d4" },
];

export function DiscoverScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "tomorrow">("all");

  const filtered = allRides.filter((r) => {
    const matchQuery =
      !query ||
      r.from.toLowerCase().includes(query.toLowerCase()) ||
      r.to.toLowerCase().includes(query.toLowerCase());
    const matchFilter =
      filter === "all" || (filter === "today" && r.date === "Today") || (filter === "tomorrow" && r.date === "Tomorrow");
    return matchQuery && matchFilter;
  });

  return (
    <div className="px-4 pb-8">
      <div className="mb-5">
        <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>Discover Rides 🔍</h2>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>Find the perfect ride for your commute</p>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border mb-4 focus-within:border-primary transition-all"
        style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "var(--glass-border)" }}
      >
        <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by area or route..."
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

      {/* Date filter */}
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

      <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "12px" }}>
        {filtered.length} ride{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Ride list */}
      <div className="space-y-3">
        {filtered.map((ride) => (
          <div
            key={ride.id}
            className="p-4 rounded-2xl transition-all hover:shadow-md cursor-pointer"
            style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: ride.color, color: "white", fontWeight: 700, fontSize: "0.8rem" }}
              >
                {ride.rider.split(" ").map((w) => w[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{ride.rider}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#f59e0b" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{ride.rating}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: "0.82rem", color: "var(--foreground)" }} className="truncate">
                    {ride.from} → {ride.to}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                    <Clock className="w-3 h-3" /> {ride.date}, {ride.time}
                  </span>
                  <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                    <Users className="w-3 h-3" /> {ride.seats} seat{ride.seats > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
            <button
              className="w-full mt-3 py-2.5 rounded-xl transition-all hover:opacity-90"
              style={{ background: "var(--secondary)", color: "var(--primary)", fontWeight: 600, fontSize: "0.875rem" }}
            >
              Request to Join
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--muted)" }}>
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>No rides found</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>Try a different search or filter</p>
        </div>
      )}
    </div>
  );
}
