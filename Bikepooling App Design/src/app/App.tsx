import { useState, useEffect } from "react";
import { Hub } from "aws-amplify/utils";
import { LoadingScreen } from "./components/LoadingScreen";
import { NotificationsScreen } from "./components/NotificationsScreen";
import { AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { PostRideScreen } from "./components/PostRideScreen";
import { MatchScreen } from "./components/MatchScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { DiscoverScreen } from "./components/DiscoverScreen";
import { MyRidesScreen } from "./components/MyRidesScreen";
import { TandemBike } from "./components/ui/TandemBike";
import { RideDetailScreen } from "./components/RideDetailScreen";
import type { RidePost } from "../lib/ridesDb";
import { getCurrentAuthUser, logoutUser, getAWSCredentials } from "../lib/auth";
import { upsertUserProfile } from "../lib/userDb";
import {
  requestUserLocation,
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

type Screen = "home" | "discover" | "post" | "myrides" | "profile" | "notifications";

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
  const [notifCount, setNotifCount] = useState(0);
  const [selectedRide, setSelectedRide] = useState<RidePost | null>(null);

  const toast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleRequestRide = (ride: { rider: string | { name: string } }) => {
    const riderName =
      typeof ride.rider === "string" ? ride.rider : ride.rider.name;
    // If triggered from the Post Ride button, navigate to post screen
    if (riderName === "post") {
      setScreen("post");
      return;
    }
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
            onGoProfile={() => setScreen("profile")}
            onNotifications={() => setScreen("notifications")}
          />
        );
      case "notifications":
        return (
          <div>
            <div className="flex items-center gap-3 px-4 pt-5 pb-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setScreen("home")}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}
                aria-label="Back"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h2 className="font-bold" style={{ fontSize: "1.1rem", color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
                Notifications
              </h2>
            </div>
            <NotificationsScreen />
          </div>
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
            onGoToProfile={() => setScreen("profile")}
          />
        );
      case "myrides":
        return (
          <MyRidesScreen
            userId={user.id}
            userName={user.name}
            onPostRide={() => setScreen("post")}
            onOpenRide={(ride) => setSelectedRide(ride)}
          />
        );
      case "profile":
        return (
          <ProfileScreen
            user={user}
            onLogout={onLogout}
            onUpdateUser={onUpdateUser}
            userLocation={userLocation}
            isDark={isDark}
            toggleTheme={toggleTheme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative bg-background text-foreground transition-colors duration-300">
      <main className="pb-24 min-h-screen overflow-y-auto">
        {renderScreen()}
      </main>

      <BottomNav active={screen} onNav={setScreen} />

      {/* Ride detail overlay */}
      {selectedRide && (
        <RideDetailScreen
          ride={selectedRide}
          currentUserId={user.id}
          currentUserName={user.name}
          onClose={() => setSelectedRide(null)}
        />
      )}

      {/* Toast */}
      {showToast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white"
          style={{
            background: "rgba(26,16,37,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(109,40,217,0.2)",
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
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

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ─── Session restore + Google OAuth callback ───────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isOAuthCallback = params.has("code") || params.has("error");
    let handled = false;

    // ── Retry getCurrentAuthUser (Amplify may need a moment after redirect) ──
    const retryGetUser = async (maxRetries = 8, delay = 1000) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const u = await getCurrentAuthUser();
          if (u) return u;
        } catch { /* keep retrying */ }
        console.log(`[OAuth] getAuthUser attempt ${i + 1}/${maxRetries} returned null`);
        await new Promise((r) => setTimeout(r, delay));
      }
      return null;
    };

    // ── Core processing after Google OAuth redirect ────────────────────
    const processGoogleSignIn = async () => {
      if (handled) return;
      handled = true;
      setGoogleLoading(true);
      setOauthError(null);

      try {
        // Step 1: Try credential refresh — non-blocking, don't fail if throws
        try {
          await getAWSCredentials(true);
          console.log("[OAuth] Credentials refreshed");
        } catch (e) {
          console.warn("[OAuth] getAWSCredentials non-fatal:", e);
        }

        // Step 2: Get user — retry in case Amplify hasn't committed tokens yet
        const authUser = await retryGetUser(8, 1000);
        console.log("[OAuth] authUser:", authUser);

        if (!authUser) {
          throw new Error("Could not retrieve user info after Google sign-in. Please try again.");
        }

        // Step 3: Upsert DynamoDB profile — non-blocking fallback to raw authUser
        let profileData: { userId: string; name: string; email: string; avatar?: string };
        try {
          const profile = await upsertUserProfile(
            authUser.userId, authUser.name, authUser.email, "google", true
          );
          profileData = profile;
        } catch (dbErr) {
          console.warn("[OAuth] upsertUserProfile non-fatal:", dbErr);
          profileData = { userId: authUser.userId, name: authUser.name, email: authUser.email };
        }

        // Step 4: Success — navigate to home
        setUser({ id: profileData.userId, name: profileData.name, email: profileData.email, avatar: profileData.avatar });
        setShowLoading(true);
        requestUserLocation().then((loc) => { if (loc) setUserLocation(loc); });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
        console.error("[OAuth] Pipeline error:", err);
        setOauthError(msg);
      } finally {
        setGoogleLoading(false);
        setInitializing(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // ── Hub listener — fires when Amplify finishes token exchange ──────
    const unsubscribe = Hub.listen("auth", async ({ payload }) => {
      console.log("[Hub] auth event:", payload.event);
      if (payload.event === "signInWithRedirect") {
        await processGoogleSignIn();
      } else if (payload.event === "signInWithRedirect_failure") {
        handled = true;
        const msg = (payload.data as { message?: string })?.message || "Google sign-in failed.";
        console.error("[OAuth] signInWithRedirect_failure:", payload);
        setOauthError(msg);
        setGoogleLoading(false);
        setInitializing(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    if (isOAuthCallback) {
      // Show spinner while waiting; fallback if Hub event was missed
      setGoogleLoading(true);
      const fallbackTimer = setTimeout(async () => {
        if (!handled) {
          console.warn("[OAuth] Hub never fired — running fallback");
          await processGoogleSignIn();
        }
      }, 6000);
      return () => { unsubscribe(); clearTimeout(fallbackTimer); };
    } else {
      // Normal page load — restore existing Cognito session
      (async () => {
        try {
          const authUser = await getCurrentAuthUser();
          if (authUser) {
            const isGoogle = authUser.userId.includes("google");
            try {
              const profile = await upsertUserProfile(
                authUser.userId, authUser.name, authUser.email,
                isGoogle ? "google" : "email"
              );
              setUser({ id: profile.userId, name: profile.name, email: profile.email, avatar: profile.avatar });
            } catch {
              setUser({ id: authUser.userId, name: authUser.name, email: authUser.email });
            }
            // Always request location (returns cache if still fresh, otherwise fires GPS)
            requestUserLocation().then((loc) => { if (loc) setUserLocation(loc); });
          }
        } catch { /* no session */ } finally { setInitializing(false); }
      })();
      return () => unsubscribe();
    }
  }, []);

  const toggleTheme = () => setIsDark((p) => !p);

  const handleAuth = (u: User) => {
    setUser(u);
    setShowLoading(true);
    requestUserLocation().then((loc) => { if (loc) setUserLocation(loc); });
  };

  const handleLogout = async () => {
    await logoutUser();
    clearCachedLocation();
    setUser(null);
    setUserLocation(null);
    setOauthError(null);
  };

  const handleUpdateUser = (updates: Partial<User>) =>
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));

  // Spinner while initializing or processing Google OAuth
  if (initializing || googleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <TandemBike className="w-7 h-7" />
          </div>
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          {googleLoading && (
            <p className="text-sm text-muted-foreground font-medium animate-pulse">
              Signing in with Google…
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuth={handleAuth}
        isDark={isDark}
        toggleTheme={toggleTheme}
        oauthError={oauthError}
        onClearOauthError={() => setOauthError(null)}
      />
    );
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
