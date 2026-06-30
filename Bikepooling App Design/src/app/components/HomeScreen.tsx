import { MapPin, Clock, Users, Zap, TrendingUp, Star, ChevronRight } from "lucide-react";

interface Ride {
  id: string;
  rider: { name: string; initials: string; rating: number; rides: number; color: string };
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  distance: string;
  status: "open" | "matched";
}

const sampleRides: Ride[] = [
  {
    id: "1",
    rider: { name: "Priya Sharma", initials: "PS", rating: 4.9, rides: 87, color: "#8b5cf6" },
    from: "Koramangala",
    to: "Whitefield",
    date: "Today",
    time: "8:30 AM",
    seats: 1,
    distance: "18 km",
    status: "open",
  },
  {
    id: "2",
    rider: { name: "Rahul Dev", initials: "RD", rating: 4.7, rides: 53, color: "#14b8a6" },
    from: "HSR Layout",
    to: "Electronic City",
    date: "Today",
    time: "9:00 AM",
    seats: 2,
    distance: "22 km",
    status: "open",
  },
  {
    id: "3",
    rider: { name: "Sneha Nair", initials: "SN", rating: 5.0, rides: 124, color: "#ec4899" },
    from: "Indiranagar",
    to: "Marathahalli",
    date: "Tomorrow",
    time: "7:45 AM",
    seats: 1,
    distance: "14 km",
    status: "open",
  },
];

interface HomeScreenProps {
  user: { name: string; email: string };
  onRequestRide: (ride: Ride) => void;
}

export function HomeScreen({ user, onRequestRide }: HomeScreenProps) {
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Hero greeting */}
      <div
        className="relative overflow-hidden mx-4 mt-4 rounded-3xl p-6"
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
        }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full opacity-10 bg-white translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-white/80" style={{ fontSize: "0.85rem" }}>{greeting},</p>
          <h2 className="text-white mt-0.5" style={{ fontWeight: 700, fontSize: "1.4rem" }}>{firstName}! 🚲</h2>
          <p className="text-white/75 mt-1" style={{ fontSize: "0.85rem" }}>Where are you riding today?</p>

          {/* Quick search */}
          <div className="mt-4 flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
            <MapPin className="w-4 h-4 text-white/80 flex-shrink-0" />
            <span className="text-white/70" style={{ fontSize: "0.9rem" }}>Search destination...</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 px-4">
        {[
          { icon: <Zap className="w-5 h-5" />, value: "12", label: "Rides", color: "#3b82f6" },
          { icon: <TrendingUp className="w-5 h-5" />, value: "₹840", label: "Saved", color: "#14b8a6" },
          { icon: <Star className="w-5 h-5" />, value: "4.8", label: "Rating", color: "#8b5cf6" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${stat.color}18`, color: stat.color }}
            >
              {stat.icon}
            </div>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>{stat.value}</p>
            <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Available rides */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontWeight: 700, color: "var(--foreground)" }}>Rides near you</h3>
          <button className="flex items-center gap-1" style={{ color: "var(--primary)", fontSize: "0.85rem", fontWeight: 500 }}>
            See all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {sampleRides.map((ride) => (
            <RideCard key={ride.id} ride={ride} onRequest={() => onRequestRide(ride)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RideCard({ ride, onRequest }: { ride: Ride; onRequest: () => void }) {
  return (
    <div
      className="rounded-2xl p-4 transition-all hover:shadow-lg"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: ride.rider.color, color: "white", fontWeight: 700, fontSize: "0.85rem" }}
        >
          {ride.rider.initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>{ride.rider.name}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#f59e0b" }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>{ride.rider.rating}</span>
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{ride.rider.rides} rides · Verified</p>

          {/* Route */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{ride.from}</span>
            </div>
            <div className="ml-1 h-4 w-px border-l-2 border-dashed border-border" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: "var(--accent)" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{ride.to}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              <Clock className="w-3 h-3" /> {ride.date}, {ride.time}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              <Users className="w-3 h-3" /> {ride.seats} seat{ride.seats > 1 ? "s" : ""} free
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              <MapPin className="w-3 h-3" /> {ride.distance}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onRequest}
          className="flex-1 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 600, fontSize: "0.875rem" }}
        >
          Request to Join
        </button>
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all hover:border-primary"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <MapPin className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
