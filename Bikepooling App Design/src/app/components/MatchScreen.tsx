import { useState } from "react";
import { CheckCircle2, XCircle, Star, MapPin, Clock, Users, MessageCircle, Phone, Shield } from "lucide-react";

interface Match {
  id: string;
  name: string;
  initials: string;
  color: string;
  rating: number;
  rides: number;
  from: string;
  to: string;
  time: string;
  date: string;
  message: string;
  verified: boolean;
  status: "pending" | "accepted" | "rejected";
}

const initialMatches: Match[] = [
  {
    id: "m1",
    name: "Kavya Reddy",
    initials: "KR",
    color: "#ec4899",
    rating: 4.8,
    rides: 34,
    from: "HSR Layout Sector 2",
    to: "Electronic City Phase 1",
    time: "8:30 AM",
    date: "Today",
    message: "Hi! I saw your ride. I work in the same area. Happy to split fuel cost!",
    verified: true,
    status: "pending",
  },
  {
    id: "m2",
    name: "Aryan Gupta",
    initials: "AG",
    color: "#8b5cf6",
    rating: 4.6,
    rides: 21,
    from: "Koramangala 5th Block",
    to: "Whitefield ITPL Gate 2",
    time: "9:00 AM",
    date: "Today",
    message: "Hey, same route daily. Would love to carpool regularly 🙌",
    verified: true,
    status: "pending",
  },
  {
    id: "m3",
    name: "Meera Iyer",
    initials: "MI",
    color: "#14b8a6",
    rating: 5.0,
    rides: 67,
    from: "Indiranagar 100ft Road",
    to: "Marathahalli Bridge",
    time: "7:45 AM",
    date: "Tomorrow",
    message: "Perfect match! I'm a regular commuter and very punctual.",
    verified: true,
    status: "pending",
  },
];

export function MatchScreen() {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [selected, setSelected] = useState<Match | null>(null);

  const respond = (id: string, action: "accepted" | "rejected") => {
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, status: action } : m)));
    setSelected(null);
  };

  const pending = matches.filter((m) => m.status === "pending");
  const resolved = matches.filter((m) => m.status !== "pending");

  if (selected) {
    return <MatchDetail match={selected} onBack={() => setSelected(null)} onRespond={respond} />;
  }

  return (
    <div className="px-4 pb-8">
      <div className="mb-6">
        <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>Ride Matches 🤝</h2>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>
          {pending.length} pending request{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3 mb-6">
          <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pending
          </p>
          {pending.map((match) => (
            <MatchCard key={match.id} match={match} onSelect={() => setSelected(match)} onRespond={respond} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-3">
          <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Responded
          </p>
          {resolved.map((match) => (
            <MatchCard key={match.id} match={match} onSelect={() => setSelected(match)} onRespond={respond} />
          ))}
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--muted)" }}>
            <Users className="w-10 h-10 text-muted-foreground" />
          </div>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>No matches yet</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>Post a ride to start getting requests</p>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, onSelect, onRespond }: { match: Match; onSelect: () => void; onRespond: (id: string, action: "accepted" | "rejected") => void }) {
  const isPending = match.status === "pending";
  return (
    <div
      className="rounded-2xl p-4 transition-all hover:shadow-md cursor-pointer"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
        opacity: match.status === "rejected" ? 0.6 : 1,
      }}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{ background: match.color, color: "white", fontWeight: 700 }}
        >
          {match.initials}
          {match.verified && (
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card"
              style={{ background: "#14b8a6" }}
            >
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{match.name}</p>
            {!isPending && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: match.status === "accepted" ? "#dcfce7" : "#fee2e2",
                  color: match.status === "accepted" ? "#16a34a" : "#dc2626",
                }}
              >
                {match.status === "accepted" ? "Accepted" : "Rejected"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 fill-current" style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{match.rating} · {match.rides} rides</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--primary)" }} />
            <p style={{ fontSize: "0.8rem", color: "var(--foreground)" }} className="truncate">
              {match.from} → {match.to}
            </p>
          </div>
          <p
            className="mt-2 rounded-lg px-3 py-2"
            style={{ fontSize: "0.8rem", color: "var(--foreground)", background: "var(--muted)", lineHeight: 1.5 }}
          >
            "{match.message}"
          </p>
        </div>
      </div>

      {isPending && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onRespond(match.id, "rejected")}
            className="flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all hover:border-destructive hover:text-destructive"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", fontWeight: 500, fontSize: "0.875rem" }}
          >
            <XCircle className="w-4 h-4" /> Decline
          </button>
          <button
            onClick={() => onRespond(match.id, "accepted")}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--primary)", color: "white", fontWeight: 600, fontSize: "0.875rem" }}
          >
            <CheckCircle2 className="w-4 h-4" /> Accept
          </button>
        </div>
      )}
    </div>
  );
}

function MatchDetail({ match, onBack, onRespond }: { match: Match; onBack: () => void; onRespond: (id: string, action: "accepted" | "rejected") => void }) {
  return (
    <div className="px-4 pb-8">
      <button onClick={onBack} className="flex items-center gap-2 mb-6" style={{ color: "var(--primary)", fontWeight: 500 }}>
        ← Back to matches
      </button>

      {/* Profile section */}
      <div
        className="rounded-3xl p-6 mb-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--secondary), var(--muted))" }}
      >
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center relative"
          style={{ background: match.color, color: "white", fontWeight: 700, fontSize: "1.5rem" }}
        >
          {match.initials}
          {match.verified && (
            <div
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center border-2 border-background"
              style={{ background: "#14b8a6" }}
            >
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "1.2rem" }}>{match.name}</h3>
        <div className="flex items-center justify-center gap-1 mt-1">
          <Star className="w-4 h-4 fill-current" style={{ color: "#f59e0b" }} />
          <span style={{ fontWeight: 600 }}>{match.rating}</span>
          <span className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>· {match.rides} rides</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:border-primary"
            style={{ borderColor: "var(--border)" }}
          >
            <MessageCircle className="w-4 h-4" style={{ color: "var(--primary)" }} />
          </button>
          <button
            className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:border-primary"
            style={{ borderColor: "var(--border)" }}
          >
            <Phone className="w-4 h-4" style={{ color: "var(--primary)" }} />
          </button>
        </div>
      </div>

      {/* Ride details */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "12px" }}>Ride Details</p>
        <div className="space-y-3">
          {[
            { icon: <MapPin className="w-4 h-4" />, label: "From", value: match.from },
            { icon: <MapPin className="w-4 h-4" />, label: "To", value: match.to },
            { icon: <Clock className="w-4 h-4" />, label: "Time", value: `${match.date}, ${match.time}` },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span style={{ color: "var(--primary)" }}>{item.icon}</span>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{item.label}</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "8px" }}>Their Message</p>
        <p style={{ fontSize: "0.9rem", color: "var(--foreground)", lineHeight: 1.6 }}>"{match.message}"</p>
      </div>

      {match.status === "pending" ? (
        <div className="flex gap-3">
          <button
            onClick={() => onRespond(match.id, "rejected")}
            className="flex-1 py-3.5 rounded-xl border flex items-center justify-center gap-2 transition-all hover:border-destructive hover:text-destructive"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", fontWeight: 600 }}
          >
            <XCircle className="w-5 h-5" /> Decline
          </button>
          <button
            onClick={() => onRespond(match.id, "accepted")}
            className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}
          >
            <CheckCircle2 className="w-5 h-5" /> Accept
          </button>
        </div>
      ) : (
        <div
          className="text-center py-4 rounded-xl"
          style={{
            background: match.status === "accepted" ? "#dcfce7" : "#fee2e2",
            color: match.status === "accepted" ? "#16a34a" : "#dc2626",
            fontWeight: 600,
          }}
        >
          You {match.status} this request
        </div>
      )}
    </div>
  );
}
