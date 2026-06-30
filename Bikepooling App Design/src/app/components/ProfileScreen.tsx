import { useState, useRef } from "react";
import { Camera, Edit3, Star, Bike, MapPin, Shield, Bell, HelpCircle, LogOut, ChevronRight, Award } from "lucide-react";

interface ProfileScreenProps {
  user: { name: string; email: string; avatar?: string };
  onLogout: () => void;
  onUpdateUser: (updates: Partial<{ name: string; email: string; avatar: string }>) => void;
}

export function ProfileScreen({ user, onLogout, onUpdateUser }: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatar(url);
      onUpdateUser({ avatar: url });
    }
  };

  const handleSave = () => {
    onUpdateUser({ name: editName, email: editEmail });
    setEditing(false);
  };

  const stats = [
    { icon: <Bike className="w-5 h-5" />, value: "12", label: "Total Rides", color: "#3b82f6" },
    { icon: <Star className="w-5 h-5" />, value: "4.8", label: "Rating", color: "#f59e0b" },
    { icon: <MapPin className="w-5 h-5" />, value: "284km", label: "Distance", color: "#14b8a6" },
    { icon: <Award className="w-5 h-5" />, value: "₹840", label: "Saved", color: "#8b5cf6" },
  ];

  const menuItems = [
    { icon: <Shield className="w-5 h-5" />, label: "Verification", value: "Verified ✓", color: "#14b8a6" },
    { icon: <Bell className="w-5 h-5" />, label: "Notifications", value: "On", color: "#3b82f6" },
    { icon: <HelpCircle className="w-5 h-5" />, label: "Help & Support", value: "", color: "#8b5cf6" },
  ];

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className="relative px-4 pt-6 pb-16"
        style={{ background: "linear-gradient(160deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)" }}
      >
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/2" />
        <h2 className="text-white mb-4" style={{ fontWeight: 700, fontSize: "1.3rem" }}>My Profile</h2>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white/30 flex items-center justify-center"
              style={{ background: avatar ? "transparent" : "rgba(255,255,255,0.25)" }}
            >
              {avatar ? (
                <img src={avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white" style={{ fontWeight: 700, fontSize: "1.8rem" }}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center border-2 border-white"
              style={{ background: "var(--primary)" }}
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-foreground bg-white/20 backdrop-blur border border-white/30 outline-none placeholder:text-white/60"
                  style={{ color: "white", fontSize: "0.9rem" }}
                />
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 bg-white/20 backdrop-blur border border-white/30 outline-none"
                  style={{ color: "white", fontSize: "0.9rem" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-1.5 rounded-lg border border-white/30 text-white/80"
                    style={{ fontSize: "0.8rem" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-1.5 rounded-lg bg-white"
                    style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.8rem" }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-white" style={{ fontWeight: 700, fontSize: "1.2rem" }}>{user.name}</h3>
                  <button onClick={() => setEditing(true)}>
                    <Edit3 className="w-4 h-4 text-white/70" />
                  </button>
                </div>
                <p className="text-white/75" style={{ fontSize: "0.85rem" }}>{user.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-white/80" style={{ fontSize: "0.75rem" }}>Active rider · Bengaluru</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats floating card */}
      <div className="px-4 -mt-10 relative z-10">
        <div
          className="rounded-2xl p-4 grid grid-cols-4 gap-2"
          style={{ background: "var(--glass-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                style={{ background: `${stat.color}18`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>{stat.value}</p>
              <p style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", lineHeight: 1.3 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="px-4 mt-5">
        <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
          Achievements
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {[
            { emoji: "🌟", label: "First Ride", earned: true },
            { emoji: "🔥", label: "10 Rides", earned: true },
            { emoji: "♻️", label: "Eco Rider", earned: true },
            { emoji: "⭐", label: "Top Rated", earned: false },
            { emoji: "🏆", label: "50 Rides", earned: false },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16"
              style={{ opacity: badge.earned ? 1 : 0.35 }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: badge.earned ? "var(--secondary)" : "var(--muted)",
                  border: badge.earned ? "2px solid var(--primary)" : "2px solid transparent",
                  fontSize: "1.5rem",
                }}
              >
                {badge.emoji}
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.2 }}>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-5 space-y-2">
        <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
          Settings
        </p>
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:shadow-md"
            style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--glass-border)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${item.color}18`, color: item.color }}
            >
              {item.icon}
            </div>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 500, fontSize: "0.9rem", color: "var(--foreground)" }}>{item.label}</span>
            {item.value && <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>{item.value}</span>}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:shadow-md mt-4"
          style={{ background: "#fee2e2" }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fecaca", color: "#dc2626" }}>
            <LogOut className="w-5 h-5" />
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#dc2626" }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
