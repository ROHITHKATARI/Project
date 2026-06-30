import { Home, Search, PlusCircle, Bell, User } from "lucide-react";

type Screen = "home" | "discover" | "post" | "notifications" | "profile";

interface BottomNavProps {
  active: Screen;
  onNav: (s: Screen) => void;
  notifCount?: number;
}

const items: { id: Screen; icon: React.FC<{ className?: string }>; label: string }[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "discover", icon: Search, label: "Discover" },
  { id: "post", icon: PlusCircle, label: "Post" },
  { id: "notifications", icon: Bell, label: "Alerts" },
  { id: "profile", icon: User, label: "Profile" },
];

export function BottomNav({ active, onNav, notifCount = 0 }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
      style={{
        background: "var(--glass-bg-strong)",
        borderTop: "1px solid var(--glass-border)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        paddingTop: "8px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.06), 0 0 0 1px var(--glass-border)",
      }}
    >
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        const isPost = id === "post";
        return (
          <button
            key={id}
            onClick={() => onNav(id)}
            className="flex flex-col items-center gap-1 relative transition-all duration-200"
            style={{ minWidth: "56px" }}
          >
            {isPost ? (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", marginTop: "-16px" }}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon
                    className="w-6 h-6 transition-all"
                    style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
                  />
                  {id === "notifications" && notifCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                      style={{ background: "var(--destructive)", fontSize: "0.6rem", fontWeight: 700 }}
                    >
                      {notifCount}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {label}
                </span>
                {isActive && (
                  <div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
