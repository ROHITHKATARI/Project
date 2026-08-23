/**
 * BottomNav — Premium Floating Capsule Navigation Bar
 * Material 3 (Material You) inspired sliding pill indicator.
 * Fully accessible, TypeScript, no external UI libraries.
 */
import React, { useRef, useLayoutEffect, useState, useCallback } from "react";
import { Home, Compass, Plus, Bike, User } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "home" | "discover" | "post" | "myrides" | "profile" | "notifications";

interface NavItem {
  id: Screen;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    color?: string;
    "aria-hidden"?: boolean;
    style?: React.CSSProperties;
  }>;
  label: string;
  ariaLabel: string;
}

interface BottomNavProps {
  /** Currently active screen */
  active: Screen;
  /** Called when user taps a nav item */
  onNav: (screen: Screen) => void;
  /** Show a notification dot on the Profile icon */
  hasNotification?: boolean;
}

interface IndicatorRect {
  left: number;
  width: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: "home",     icon: Home,    label: "Home",     ariaLabel: "Go to Home" },
  { id: "discover", icon: Compass, label: "Discover", ariaLabel: "Discover rides" },
  { id: "post",     icon: Plus,    label: "Post",     ariaLabel: "Post a ride" },
  { id: "myrides",  icon: Bike,    label: "My Rides", ariaLabel: "View my rides" },
  { id: "profile",  icon: User,    label: "Profile",  ariaLabel: "View profile" },
];

// Design tokens
const COLORS = {
  navBg: "rgba(23, 25, 30, 0.92)",
  indicatorBg: "rgba(255, 255, 255, 0.12)",
  activeText: "#FFFFFF",
  inactiveText: "#8B9097",
  postGradient: "linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #8B5CF6 100%)",
  postGlow: "rgba(99, 102, 241, 0.65)",
  notifDot: "#3B82F6",
  navBorder: "rgba(255,255,255,0.12)",
  navShadow:
    "0 -1px 0 rgba(255,255,255,0.1), 0 12px 48px rgba(0,0,0,0.65), 0 4px 20px rgba(0,0,0,0.45)",
} as const;

// ─── NavItemButton ─────────────────────────────────────────────────────────────

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  hasNotification: boolean;
  onClick: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}

function NavItemButton({
  item,
  isActive,
  hasNotification,
  onClick,
  buttonRef,
}: NavItemButtonProps) {
  const Icon = item.icon;
  const isPost = item.id === "post";
  const iconColor = isActive ? COLORS.activeText : COLORS.inactiveText;

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      aria-label={item.ariaLabel}
      aria-current={isActive ? "page" : undefined}
      style={{
        // Layout
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isPost ? "1px" : "3px",
        // Touch target — minimum 48×48
        minHeight: "54px",
        minWidth: "48px",
        padding: "6px 4px",
        // Reset
        background: "transparent",
        border: "none",
        cursor: "pointer",
        borderRadius: "9999px",
        // Stacking above the sliding indicator
        position: "relative",
        zIndex: isPost ? 5 : 1,
        // Interaction feedback
        WebkitTapHighlightColor: "transparent",
        outline: "none",
        transition: "transform 0.2s ease, opacity 0.15s ease",
        transform: isPost ? "translateY(-6px)" : "none",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Post Tab — distinct elevated pill/button style */}
      {isPost ? (
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "46px",
            height: "46px",
            borderRadius: "50%",
            background: COLORS.postGradient,
            border: "1.5px solid rgba(255, 255, 255, 0.35)",
            boxShadow: isActive
              ? `0 0 0 4px rgba(99, 102, 241, 0.35), 0 8px 24px ${COLORS.postGlow}`
              : `0 6px 20px ${COLORS.postGlow}, 0 0 12px rgba(139, 92, 246, 0.4)`,
            transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease",
            transform: isActive ? "scale(1.12)" : "scale(1)",
            animation: isActive ? "none" : "postGlowPulse 3s ease-in-out infinite",
          }}
        >
          <Icon
            size={22}
            strokeWidth={3}
            color={COLORS.activeText}
            aria-hidden
            style={{
              transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              transform: isActive ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        </span>
      ) : (
        /* Standard icon with relative container for notification dot */
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            transform: isActive ? "scale(1.08)" : "scale(1)",
          }}
        >
          <Icon
            size={22}
            strokeWidth={isActive ? 2.2 : 1.75}
            color={iconColor}
            aria-hidden
          />

          {/* Notification dot — only on Profile */}
          {item.id === "profile" && hasNotification && (
            <span
              aria-label="You have new notifications"
              style={{
                position: "absolute",
                top: "-1px",
                right: "-1px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: COLORS.notifDot,
                border: `1.5px solid ${COLORS.navBg}`,
                boxShadow: `0 0 6px ${COLORS.notifDot}`,
                animation: "notifPulse 2s ease-in-out infinite",
              }}
            />
          )}
        </span>
      )}

      {/* Label */}
      <span
        style={{
          fontSize: "10px",
          fontWeight: isActive || isPost ? 600 : 400,
          color: isPost
            ? "#60A5FA"
            : iconColor,
          letterSpacing: "0.02em",
          lineHeight: 1,
          transition: "color 0.25s ease, font-weight 0.1s ease",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
          marginTop: isPost ? "2px" : "0px",
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

export function BottomNav({ active, onNav, hasNotification = false }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<IndicatorRect>({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === active);
  const isPostActive = active === "post";

  // Recalculate indicator position whenever active tab changes
  const recalcIndicator = useCallback(() => {
    const navEl = navRef.current;
    const activeEl = itemRefs.current[activeIndex];
    if (!navEl || !activeEl) return;

    const navRect = navEl.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();

    setIndicator({
      left: itemRect.left - navRect.left,
      width: itemRect.width,
    });
    setReady(true);
  }, [activeIndex]);

  // Run after paint so sizes are accurate
  useLayoutEffect(() => {
    recalcIndicator();
  }, [recalcIndicator]);

  // Recalculate on window resize
  useLayoutEffect(() => {
    const handler = () => recalcIndicator();
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, [recalcIndicator]);

  return (
    <>
      {/* Keyframe for notification pulse & post button ambient glow */}
      <style>{`
        @keyframes notifPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.25); }
        }
        @keyframes postGlowPulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(99, 102, 241, 0.65), 0 0 12px rgba(139, 92, 246, 0.4); }
          50%       { box-shadow: 0 8px 28px rgba(99, 102, 241, 0.85), 0 0 20px rgba(139, 92, 246, 0.65); }
        }
      `}</style>

      {/*
        Outer wrapper: fixed, full-width, invisible except for the nav pill.
        pointer-events: none so taps fall through the gap areas.
      */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "center",
          /* 10px left + right margin, safe-area inset at the bottom */
          padding: "0 10px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          pointerEvents: "none",
        }}
        aria-hidden="false"
      >
        <nav
          ref={navRef}
          role="navigation"
          aria-label="Main navigation"
          style={{
            /* Floating pill geometry */
            width: "100%",
            maxWidth: "390px",
            borderRadius: "9999px",
            /* re-enable pointer events on the pill */
            pointerEvents: "auto",
            /* Dark background + subtle border */
            background: COLORS.navBg,
            border: `1px solid ${COLORS.navBorder}`,
            boxShadow: COLORS.navShadow,
            /* Inner layout */
            display: "flex",
            alignItems: "center",
            padding: "4px 4px",
            /* Sliding indicator sits behind nav items */
            position: "relative",
            overflow: "visible",
          }}
        >
          {/* ── Sliding Pill Indicator ──────────────────────────────────── */}
          {/* Hidden for Post tab (has its own visual), revealed once ready */}
          {!isPostActive && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "4px",
                bottom: "4px",
                left: indicator.left,
                width: indicator.width,
                zIndex: 0,
                pointerEvents: "none",
                // Only animate after first measurement to avoid flash
                transition: ready
                  ? "left 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1)"
                  : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Inner capsule — narrower than the full item width */}
              <span
                style={{
                  display: "block",
                  width: "58px",
                  height: "100%",
                  borderRadius: "9999px",
                  background: COLORS.indicatorBg,
                }}
              />
            </span>
          )}

          {/* ── Nav Items ───────────────────────────────────────────────── */}
          {NAV_ITEMS.map((item, i) => (
            <NavItemButton
              key={item.id}
              item={item}
              isActive={active === item.id}
              hasNotification={hasNotification}
              onClick={() => onNav(item.id)}
              buttonRef={(el) => {
                itemRefs.current[i] = el;
              }}
            />
          ))}
        </nav>
      </div>
    </>
  );
}
