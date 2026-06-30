import { useState } from "react";
import { LoadingScreen } from "./components/LoadingScreen";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { PostRideScreen } from "./components/PostRideScreen";
import { MatchScreen } from "./components/MatchScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { DiscoverScreen } from "./components/DiscoverScreen";
import { NotificationsScreen } from "./components/NotificationsScreen";
import { Bike } from "lucide-react";

function DiscoverAndMatch() {
  const [tab, setTab] = useState<"discover" | "matches">("discover");
  return (
    <div>
      <div className="flex gap-2 px-4 pt-4 mb-1">
        {(["discover", "matches"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-xl capitalize transition-all"
            style={{
              background: tab === t ? "var(--primary)" : "var(--card)",
              color: tab === t ? "white" : "var(--muted-foreground)",
              fontWeight: tab === t ? 600 : 400,
              fontSize: "0.875rem",
            }}
          >
            {t === "discover" ? "🔍 Discover" : "🤝 My Matches"}
          </button>
        ))}
      </div>
      {tab === "discover" ? <DiscoverScreen /> : <MatchScreen />}
    </div>
  );
}

type Screen = "home" | "discover" | "post" | "notifications" | "profile";

interface User {
  name: string;
  email: string;
  avatar?: string;
}

function AppShell({ user, onLogout, onUpdateUser }: { user: User; onLogout: () => void; onUpdateUser: (u: Partial<User>) => void }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [showToast, setShowToast] = useState<string | null>(null);
  const notifCount = 2;

  const toast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleRequestRide = (ride: { rider: { name: string } }) => {
    toast(`Request sent to ${ride.rider.name}! 🚲`);
  };

  const renderScreen = () => {
    switch (screen) {
      case "home":
        return <HomeScreen user={user} onRequestRide={handleRequestRide} />;
      case "discover":
        return <DiscoverAndMatch />;
      case "post":
        return <PostRideScreen onPosted={() => { toast("Ride posted! 🎉"); setScreen("home"); }} />;
      case "notifications":
        return <NotificationsScreen />;
      case "profile":
        return <ProfileScreen user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} />;
      default:
        return null;
    }
  };

  return (
    /* MARKER-MAKE-KIT-INVOKED */
    <div className="min-h-screen relative">
      {/* Header — Frosted Glass */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid var(--glass-border)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            <Bike className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)", letterSpacing: "-0.02em" }}>
            DostWheels
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen("notifications")}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-secondary"
            style={{ background: screen === "notifications" ? "var(--secondary)" : "transparent" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: screen === "notifications" ? "var(--primary)" : "var(--muted-foreground)" }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--destructive)", fontSize: "0.6rem", fontWeight: 700 }}
              >
                {notifCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setScreen("profile")}
            className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border-2 transition-all"
            style={{
              borderColor: screen === "profile" ? "var(--primary)" : "transparent",
              background: user.avatar ? "transparent" : "var(--primary)",
            }}
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white" style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                {user.name.charAt(0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="pb-24 min-h-[calc(100vh-60px)] overflow-y-auto">
        {renderScreen()}
      </main>

      {/* Bottom nav */}
      <BottomNav active={screen} onNav={setScreen} notifCount={notifCount} />

      {/* Toast */}
      {showToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white"
          style={{
            background: "rgba(12,30,58,0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.15)",
            whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: 500,
          }}
        >
          {showToast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showLoading, setShowLoading] = useState(false);

  const handleAuth = (u: User) => {
    setUser(u);
    setShowLoading(true);
  };
  const handleLogout = () => setUser(null);
  const handleUpdateUser = (updates: Partial<User>) =>
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (showLoading) {
    return (
      <>
        <AppShell user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
        <LoadingScreen
          username={user.name}
          onFinished={() => setShowLoading(false)}
        />
      </>
    );
  }

  return <AppShell user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
}
