import { useState, useEffect } from "react";
import { LoadingScreen } from "./components/LoadingScreen";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { PostRideScreen } from "./components/PostRideScreen";
import { MatchScreen } from "./components/MatchScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { DiscoverScreen } from "./components/DiscoverScreen";
import { NotificationsScreen } from "./components/NotificationsScreen";
import { TandemBike } from "./components/ui/TandemBike";
import { getCurrentAuthUser, logoutUser } from "../lib/auth";
import { upsertUserProfile } from "../lib/userDb";
import {
  requestUserLocation,
  getCachedLocation,
  clearCachedLocation,
  type UserLocation,
} from "../lib/locationService";

// ─── DiscoverAndMatch wrapper ─────────────────────────────────────────
function DiscoverAndMatch({
  onRequest,
  userId,
  userName,
  userLocation,
}: {
  onRequest: (ride: { rider: string }) => void;
  userId: string;
  userName: string;
  userLocation: UserLocation | null;
}) {
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
      {tab === "discover" ? (
        <DiscoverScreen
          onRequest={onRequest}
          userId={userId}
          userName={userName}
          userLocation={userLocation}
        />
      ) : (
        <MatchScreen />
      )}
    </div>
  );
}

type Screen = "home" | "discover" | "post" | "notifications" | "profile";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// ─── AppShell ─────────────────────────────────────────────────────────
function AppShell({
  user,
  onLogout,
  onUpdateUser,
  isDark,
  toggleTheme,
  userLocation,
}: {
  user: User;
  onLogout: () => void;
  onUpdateUser: (u: Partial<User>) => void;
  isDark: boolean;
  toggleTheme: () => void;
  userLocation: UserLocation | null;
}) {
  const [screen, setScreen] = useState<Screen>("home");
  const [showToast, setShowToast] = useState<string | null>(null);
  const notifCount = 2;

  const toast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleRequestRide = (ride: { rider: string | { name: string } }) => {
    const riderName =
      typeof ride.rider === "string" ? ride.rider : ride.rider.name;
    toast(`Request sent to ${riderName}! 🚲`);
  };

  const renderScreen = () => {
    switch (screen) {
      case "home":
        return (
          <HomeScreen
            user={user}
            onRequestRide={handleRequestRide}
            userLocation={userLocation}
          />
        );
      case "discover":
        return (
          <DiscoverAndMatch
            onRequest={handleRequestRide}
            userId={user.id}
            userName={user.name}
            userLocation={userLocation}
          />
        );
      case "post":
        return (
          <PostRideScreen
            onPosted={() => {
              toast("Ride posted! 🥳");
              setScreen("home");
            }}
            userId={user.id}
            userName={user.name}
            userLocation={userLocation}
          />
        );
      case "notifications":
        return <NotificationsScreen />;
      case "profile":
        return (
          <ProfileScreen
            user={user}
            onLogout={onLogout}
            onUpdateUser={onUpdateUser}
            userLocation={userLocation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative bg-background text-foreground transition-colors duration-300">
      {/* Header – Frosted Glass */}
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900/60 border border-white/40 dark:border-white/10 shadow-sm">
            <TandemBike className="w-7.5 h-7.5" />
          </div>
          <span className="font-['Space_Grotesk'] font-bold text-lg tracking-tight flex items-center">
            <span className="text-[#14122B] dark:text-white">Dost</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E5BFF] to-[#FFB020]">
              Wheels
            </span>
          </span>
        </div>

        {/* Location pill in header */}
        {userLocation && (
          <div
            className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: "var(--secondary)",
              color: "var(--primary)",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {userLocation.areaName}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Toggle theme"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3a6.8 6.8 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => setScreen("notifications")}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-secondary"
            style={{ background: screen === "notifications" ? "var(--secondary)" : "transparent" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: screen === "notifications" ? "var(--primary)" : "var(--muted-foreground)" }}
            >
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

          {/* User avatar */}
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
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="pb-24 min-h-[calc(100vh-60px)] overflow-y-auto">
        {renderScreen()}
      </main>

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
            whiteSpace: "nowrap",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {showToast}
        </div>
      )}
    </div>
  );
}

// ─── Root App component ───────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  // Apply dark class to <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // ─── Restore existing Cognito session on page load ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const authUser = await getCurrentAuthUser();
        if (authUser) {
          const profile = await upsertUserProfile(
            authUser.userId,
            authUser.name,
            authUser.email,
            authUser.email.includes("google") ? "google" : "email"
          );
          setUser({
            id: profile.userId,
            name: profile.name,
            email: profile.email,
            avatar: profile.avatar,
          });
          // Load cached location immediately on session restore
          const cached = getCachedLocation();
          if (cached) setUserLocation(cached);
        }
      } catch {
        // No active session — stay on auth screen
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const handleAuth = (u: User) => {
    setUser(u);
    setShowLoading(true);
    // Request precise location after successful login (runs in background)
    requestUserLocation().then((loc) => {
      if (loc) setUserLocation(loc);
    });
  };

  const handleLogout = async () => {
    await logoutUser();
    clearCachedLocation();
    setUser(null);
    setUserLocation(null);
  };

  const handleUpdateUser = (updates: Partial<User>) =>
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));

  // Show spinner while checking session
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <TandemBike className="w-7 h-7" />
          </div>
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} isDark={isDark} toggleTheme={toggleTheme} />;
  }

  if (showLoading) {
    return (
      <>
        <AppShell
          user={user}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          isDark={isDark}
          toggleTheme={toggleTheme}
          userLocation={userLocation}
        />
        <LoadingScreen username={user.name} onFinished={() => setShowLoading(false)} />
      </>
    );
  }

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onUpdateUser={handleUpdateUser}
      isDark={isDark}
      toggleTheme={toggleTheme}
      userLocation={userLocation}
    />
  );
}
