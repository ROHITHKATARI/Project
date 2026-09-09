import React, { useState, useEffect, useCallback } from "react";
import { Hub } from "aws-amplify/utils";
import { App as CapApp } from "@capacitor/app";
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
import { type RidePost } from "../lib/ridesDb";
import { getCurrentAuthUser, logoutUser, getAWSCredentials } from "../lib/auth";
import { exchangeNativeOAuthCode } from "../lib/nativeOAuth";
import { upsertUserProfile } from "../lib/userDb";
import {
  requestUserLocation,
  clearCachedLocation,
  type UserLocation,
} from "../lib/locationService";
import {
  initializeFCM,
  subscribeToFCMToken,
  subscribeToForegroundNotifications,
} from "../lib/pushNotifications";
import { registerDeviceToken } from "../lib/deviceRegistrationDb";
import {
  resolveNotificationRoute,
  routerInputFromFCM,
  routerInputFromRecord,
  type RideDetailTab,
} from "../lib/notificationRouter";
import type { NotificationRecord } from "../lib/notificationsDb";

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
  locationDenied,
  onRequestLocation,
  onNavigateBack,
}: {
  user: User;
  onLogout: () => void;
  onUpdateUser: (u: Partial<User>) => void;
  isDark: boolean;
  toggleTheme: () => void;
  userLocation: UserLocation | null;
  locationDenied?: boolean;
  onRequestLocation?: () => void;
  onNavigateBack?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("home");
  const screenHistoryRef = React.useRef<Screen[]>(["home"]);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [selectedRide, setSelectedRide] = useState<RidePost | null>(null);
  const [selectedRideTab, setSelectedRideTab] = useState<RideDetailTab>("details");

  // Navigate with history tracking for Android back button
  const navigateTo = React.useCallback((s: Screen) => {
    setScreen((prev) => {
      if (prev !== s) {
        screenHistoryRef.current.push(s);
      }
      return s;
    });
  }, []);

  // Go back one step in screen history
  const goBack = React.useCallback(() => {
    if (selectedRide) {
      setSelectedRide(null);
      setSelectedRideTab("details");
      return;
    }
    const history = screenHistoryRef.current;
    if (history.length > 1) {
      history.pop(); // remove current
      const prev = history[history.length - 1];
      setScreen(prev);
    } else {
      // At root — let parent handle (e.g. minimize app)
      onNavigateBack?.();
    }
  }, [selectedRide, onNavigateBack]);

  // Expose goBack to parent for hardware back button
  React.useEffect(() => {
    (AppShell as unknown as { _goBack?: () => void })._goBack = goBack;
    return () => { (AppShell as unknown as { _goBack?: () => void })._goBack = undefined; };
  }, [goBack]);

  // ─── Centralized notification router ─────────────────────────────────
  // Single function used by both FCM tap and inbox tap so routing
  // logic is never duplicated.
  const handleNotificationRoute = React.useCallback(
    async (input: Parameters<typeof resolveNotificationRoute>[0]) => {
      try {
        const routeAction = await resolveNotificationRoute(input);
        switch (routeAction.action) {
          case "open_ride":
            setSelectedRideTab(routeAction.initialTab);
            setSelectedRide(routeAction.ride);
            break;
          case "navigate":
            navigateTo(routeAction.screen);
            break;
          case "noop":
            break;
        }
      } catch (err) {
        console.error("[NotificationRouter] Routing failed:", err);
        navigateTo("notifications");
      }
    },
    [navigateTo]
  );

  // Stable ref so the FCM onTap closure — registered only once by
  // initializeFCM (guarded by isInitialized) — always calls the
  // current version of handleNotificationRoute without going stale.
  const handleNotificationRouteRef = React.useRef(handleNotificationRoute);
  React.useEffect(() => {
    handleNotificationRouteRef.current = handleNotificationRoute;
  }, [handleNotificationRoute]);

  // Adapter called when the user taps an inbox notification record.
  const handleSelectNotification = React.useCallback(
    (notif: NotificationRecord) => {
      handleNotificationRoute(routerInputFromRecord(notif));
    },
    [handleNotificationRoute]
  );

  // ─── FCM Push Notifications Initialization & Deep-Linking ───────────
  React.useEffect(() => {
    initializeFCM({
      onTap: (data) => {
        console.log("[FCM DeepLink] Push notification tapped:", data);
        // Read through the ref so this closure — registered once and
        // never re-registered — always dispatches to the latest router.
        handleNotificationRouteRef.current(routerInputFromFCM(data));
      },
    });

    // Sync FCM device token to DynamoDB for the authenticated user
    const unsubscribeToken = subscribeToFCMToken((token) => {
      if (!user?.id || !token) return;
      registerDeviceToken({
        userId: user.id,
        token,
      }).catch((err) => {
        console.warn("[FCM] Device registration sync non-fatal error:", err?.message || err);
      });
    });

    const unsubscribeForeground = subscribeToForegroundNotifications((notif) => {
      const title = notif.title || "Notification";
      const body = notif.body ? `: ${notif.body}` : "";
      toast(`🔔 ${title}${body}`);
    });

    return () => {
      unsubscribeToken();
      unsubscribeForeground();
    };
    // initializeFCM is guarded by isInitialized — it runs once per app
    // lifetime. user.id is included so device token registration fires
    // when the user changes (e.g. logout → login).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const toast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleRequestRide = (ride: { rider: string | { name: string } }) => {
    const riderName =
      typeof ride.rider === "string" ? ride.rider : ride.rider.name;
    // If triggered from the Post Ride button, navigate to post screen
    if (riderName === "post") {
      navigateTo("post");
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
            onOpenRide={(ride) => setSelectedRide(ride)}
            userLocation={userLocation}
            locationDenied={locationDenied}
            onRequestLocation={onRequestLocation}
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
            <NotificationsScreen onSelectNotification={handleSelectNotification} />
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

      <BottomNav active={screen} onNav={navigateTo} />

      {/* Ride detail overlay */}
      {selectedRide && (
        <RideDetailScreen
          ride={selectedRide}
          currentUserId={user.id}
          currentUserName={user.name}
          userLocation={userLocation}
          initialTab={selectedRideTab}
          onClose={() => {
            setSelectedRide(null);
            setSelectedRideTab("details");
          }}
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
  const [locationDenied, setLocationDenied] = useState(false);
  // A lightweight repaint flag — does NOT remount AppShell (which would crash async ops)
  const [, forceRepaint] = useState(0);
  const appShellGoBackRef = React.useRef<(() => void) | null>(null);

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

  // ─── Session restore + Google OAuth callback ──────────────────────
  //
  // ANDROID FLOW:
  //   1. signInWithGoogle() opens Cognito in @capacitor/browser (Chrome Custom Tab)
  //   2. The main WebView stays at http://localhost throughout
  //   3. Cognito redirects to dostwheels://callback?code=...
  //   4. Android fires appUrlOpen event (captured below)
  //   5. We close the Browser tab and inject ?code=... into window.location
  //   6. Amplify detects ?code= on the next tick and exchanges the token
  //   7. Hub fires "signInWithRedirect" → processGoogleSignIn() completes login
  //
  // WEB FLOW:
  //   1. signInWithRedirect() navigates window.location to Cognito
  //   2. Cognito redirects back to http://localhost:5173/?code=...
  //   3. App reloads with ?code= in URL → Amplify picks it up automatically
  //   4. Hub fires "signInWithRedirect" → processGoogleSignIn() completes login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isOAuthCallback = params.has("code") || params.has("error");
    let handled = false;

    // ── Retry getCurrentAuthUser (Amplify may need a moment) ─────────
    const retryGetUser = async (maxRetries = 10, delay = 800) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const u = await getCurrentAuthUser();
          if (u) return u;
        } catch { /* keep retrying */ }
        console.log(`[OAuth] attempt ${i + 1}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, delay));
      }
      return null;
    };

    // ── Core sign-in processing ───────────────────────────────────────
    const processGoogleSignIn = async () => {
      if (handled) return;
      handled = true;
      setGoogleLoading(true);
      setOauthError(null);

      try {
        try { await getAWSCredentials(true); } catch (e) {
          console.warn("[OAuth] getAWSCredentials non-fatal:", e);
        }

        const authUser = await retryGetUser();
        console.log("[OAuth] authUser:", authUser);

        if (!authUser) throw new Error("Could not retrieve user after Google sign-in.");

        let profileData: { userId: string; name: string; email: string; avatar?: string };
        try {
          profileData = await upsertUserProfile(
            authUser.userId, authUser.name, authUser.email, "google", true
          );
        } catch (dbErr) {
          console.warn("[OAuth] upsertUserProfile non-fatal:", dbErr);
          profileData = { userId: authUser.userId, name: authUser.name, email: authUser.email };
        }

        setUser({ id: profileData.userId, name: profileData.name, email: profileData.email, avatar: profileData.avatar });
        setShowLoading(true);
        requestUserLocation().then((loc) => { if (loc) setUserLocation(loc); });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed.";
        console.error("[OAuth] error:", err);
        setOauthError(msg);
      } finally {
        setGoogleLoading(false);
        setInitializing(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // ── Hub listener — Amplify fires this after token exchange ────────
    const unsubscribe = Hub.listen("auth", async ({ payload }) => {
      console.log("[Hub] auth event:", payload.event);
      if (payload.event === "signInWithRedirect") {
        await processGoogleSignIn();
      } else if (payload.event === "signInWithRedirect_failure") {
        handled = true;
        const msg = (payload.data as { message?: string })?.message || "Google sign-in failed.";
        console.error("[OAuth] failure:", payload);
        setOauthError(msg);
        setGoogleLoading(false);
        setInitializing(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    // ── Android: capture the dostwheels://callback deep link ──────────────
    // This fires when @capacitor/browser (Chrome Custom Tab) receives the
    // dostwheels://callback?code=... redirect from Cognito after Google auth.
    //
    // Flow:
    //   1. signInWithGoogle() (native) → startNativeGoogleSignIn() → Browser.open(cognitoUrl)
    //      with redirect_uri=dostwheels://callback
    //   2. User authenticates with Google in the Chrome Custom Tab
    //   3. Cognito redirects to dostwheels://callback?code=...&state=...
    //   4. Android intent-filter intercepts → fires appUrlOpen
    //   5. We close the Browser tab
    //   6. We call exchangeNativeOAuthCode(code, state) which:
    //      a. Validates the PKCE state
    //      b. POSTs to Cognito /oauth2/token with code_verifier
    //      c. Gets access_token + id_token + refresh_token
    //      d. Stores tokens in Amplify's localStorage format
    //      e. Returns user info (userId, email, name)
    //   7. We upsert the user profile to DynamoDB
    //   8. We set the user in React state → app shows home screen ✅
    //
    // NO page reload — the WebView stays alive and the app continues normally.
    let urlOpenSub: Promise<{ remove: () => void }> | null = null;
    let isMountedUrlOpen = true;

    urlOpenSub = CapApp.addListener("appUrlOpen", async ({ url }) => {
      console.log("[AppUrlOpen] received:", url);
      if (!url.startsWith("dostwheels://callback")) return;

      // Close the Chrome Custom Tab
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch { /* ignore if already closed */ }

      if (!isMountedUrlOpen) return;

      const cbUrl = new URL(url.replace("dostwheels://callback", "http://x"));
      const code = cbUrl.searchParams.get("code");
      const state = cbUrl.searchParams.get("state");
      const error = cbUrl.searchParams.get("error");

      if (error) {
        setOauthError(`Google sign-in error: ${error}`);
        setGoogleLoading(false);
        setInitializing(false);
        return;
      }

      if (!code || !state) {
        setOauthError("Invalid OAuth callback — missing code or state.");
        setGoogleLoading(false);
        setInitializing(false);
        return;
      }

      // Show loading spinner while we exchange the code
      setGoogleLoading(true);
      setOauthError(null);

      try {
        // Manual PKCE token exchange (no Amplify signInWithRedirect needed)
        const nativeUser = await exchangeNativeOAuthCode(code, state);
        console.log("[AppUrlOpen] token exchange ok, user:", nativeUser.userId);

        if (!isMountedUrlOpen) return;

        // Get AWS credentials (Identity Pool) now that tokens are in localStorage
        try { await getAWSCredentials(true); } catch (e) {
          console.warn("[AppUrlOpen] getAWSCredentials non-fatal:", e);
        }

        // Upsert user profile to DynamoDB
        let profileData: { userId: string; name: string; email: string; avatar?: string };
        try {
          profileData = await upsertUserProfile(
            nativeUser.userId, nativeUser.name, nativeUser.email, "google", true
          );
        } catch (dbErr) {
          console.warn("[AppUrlOpen] upsertUserProfile non-fatal:", dbErr);
          profileData = { userId: nativeUser.userId, name: nativeUser.name, email: nativeUser.email };
        }

        if (!isMountedUrlOpen) return;

        // Set user → triggers app to show home screen
        setUser({ id: profileData.userId, name: profileData.name, email: profileData.email, avatar: profileData.avatar });
        setShowLoading(true);
        requestUserLocation().then((loc) => { if (loc && isMountedUrlOpen) setUserLocation(loc); });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed.";
        console.error("[AppUrlOpen] error:", err);
        if (isMountedUrlOpen) setOauthError(msg);
      } finally {
        if (isMountedUrlOpen) {
          setGoogleLoading(false);
          setInitializing(false);
        }
      }
    });

    if (isOAuthCallback) {
      // Web: ?code= already in URL — Amplify will auto-process via Hub
      setGoogleLoading(true);
      let isMounted = true;
      const fallbackTimer = setTimeout(async () => {
        if (!handled && isMounted) {
          console.warn("[OAuth] Hub never fired — running fallback");
          await processGoogleSignIn();
        }
      }, 4000);
      return () => {
        isMounted = false;
        isMountedUrlOpen = false;
        unsubscribe();
        clearTimeout(fallbackTimer);
        urlOpenSub?.then((h) => h.remove());
      };
    } else {
      // Normal page load — restore existing Cognito session
      let isMounted = true;
      (async () => {
        try {
          const authUser = await getCurrentAuthUser();
          if (!isMounted) return;
          if (authUser) {
            const isGoogle = authUser.userId.includes("google");
            try {
              const profile = await upsertUserProfile(
                authUser.userId, authUser.name, authUser.email,
                isGoogle ? "google" : "email"
              );
              if (!isMounted) return;
              setUser({ id: profile.userId, name: profile.name, email: profile.email, avatar: profile.avatar });
            } catch {
              if (!isMounted) return;
              setUser({ id: authUser.userId, name: authUser.name, email: authUser.email });
            }
            // Always request location (returns cache if still fresh, otherwise fires GPS)
            requestUserLocation().then((loc) => { if (loc && isMounted) setUserLocation(loc); });
          }
        } catch { /* no session */ } finally { if (isMounted) setInitializing(false); }
      })();
      return () => {
        isMounted = false;
        isMountedUrlOpen = false;
        unsubscribe();
        urlOpenSub?.then((h) => h.remove());
      };
    }
  }, []);

  const toggleTheme = () => setIsDark((p) => !p);

  // ── Handle Android hardware back button ──────────────────────────────
  useEffect(() => {
    const sub = CapApp.addListener("backButton", () => {
      // Delegate to AppShell's goBack if available
      const shellGoBack = (AppShell as unknown as { _goBack?: () => void })._goBack;
      if (shellGoBack) {
        shellGoBack();
      }
      // If not in app shell (auth screen), do nothing (app stays open)
    });
    return () => { sub.then((h: { remove: () => void }) => h.remove()); };
  }, []);

  // ── Handle Android app resume (foreground) ────────────────────────────
  // Trigger a lightweight re-render to repaint the WebView surface.
  // We use forceRepaint (not a key prop) so components aren't remounted.
  useEffect(() => {
    const sub = CapApp.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        forceRepaint((n) => n + 1);
      }
    });
    return () => { sub.then((h: { remove: () => void }) => h.remove()); };
  }, []);

  const handleAuth = (u: User) => {
    setUser(u);
    setShowLoading(true);
    requestUserLocation().then((loc) => {
      if (loc) {
        setUserLocation(loc);
        setLocationDenied(false);
      } else {
        setLocationDenied(true);
      }
    });
  };

  // Re-request location permission (called from the "Enable Location Services" button)
  const handleRequestLocation = useCallback(async () => {
    setLocationDenied(false);
    const loc = await requestUserLocation(true);
    if (loc) {
      setUserLocation(loc);
      setLocationDenied(false);
    } else {
      setLocationDenied(true);
    }
  }, []);

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
          locationDenied={locationDenied}
          onRequestLocation={handleRequestLocation}
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
      locationDenied={locationDenied}
      onRequestLocation={handleRequestLocation}
    />
  );
}
