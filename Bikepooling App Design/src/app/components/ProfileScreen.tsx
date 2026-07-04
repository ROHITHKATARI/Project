import { useState, useRef, useEffect } from "react";
import {
  Camera, Edit3, Star, Bike, MapPin, Shield, Bell,
  HelpCircle, LogOut, ChevronRight, Award, Pencil, Trash2, X, CheckCircle2
} from "lucide-react";
import { updateUserProfile } from "../../lib/userDb";
import {
  getRidesByUserId,
  getJoinedRidesByUserId,
  updateRide,
  deleteRide,
  type RidePost,
  type UpdateRideInput,
} from "../../lib/ridesDb";
import type { UserLocation } from "../../lib/locationService";

interface ProfileScreenProps {
  user: { id: string; name: string; email: string; avatar?: string };
  onLogout: () => void;
  onUpdateUser: (updates: Partial<{ name: string; email: string; avatar: string }>) => void;
  userLocation?: UserLocation | null;
}

export function ProfileScreen({ user, onLogout, onUpdateUser, userLocation }: ProfileScreenProps) {
  // ── Profile editing ─────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── My Rides ────────────────────────────────────────────────────────
  const [ridesTab, setRidesTab] = useState<"posted" | "joined">("posted");
  const [postedRides, setPostedRides] = useState<RidePost[]>([]);
  const [joinedRides, setJoinedRides] = useState<RidePost[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);

  // ── Edit ride modal ─────────────────────────────────────────────────
  const [editingRide, setEditingRide] = useState<RidePost | null>(null);
  const [editForm, setEditForm] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: "1",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Load rides on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function loadRides() {
      setRidesLoading(true);
      const [posted, joined] = await Promise.all([
        getRidesByUserId(user.id),
        getJoinedRidesByUserId(user.id),
      ]);
      setPostedRides(posted);
      setJoinedRides(joined);
      setRidesLoading(false);
    }
    loadRides();
  }, [user.id]);

  // ── Photo change ────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatar(url);
      onUpdateUser({ avatar: url });
    }
  };

  // ── Save profile ────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await updateUserProfile(user.id, { name: editName, email: editEmail });
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
    onUpdateUser({ name: editName, email: editEmail });
    setEditing(false);
  };

  // ── Open ride edit modal ────────────────────────────────────────────
  const openEditRide = (ride: RidePost) => {
    setEditingRide(ride);
    setEditForm({
      from: ride.from,
      to: ride.to,
      date: ride.date,
      time: ride.time,
      seats: String(ride.seats),
      notes: ride.notes ?? "",
    });
  };

  // ── Save ride edits ─────────────────────────────────────────────────
  const handleSaveRideEdit = async () => {
    if (!editingRide) return;
    setEditSaving(true);
    try {
      const updates: UpdateRideInput = {
        from: editForm.from,
        to: editForm.to,
        date: editForm.date,
        time: editForm.time,
        seats: Number(editForm.seats),
        notes: editForm.notes || undefined,
      };
      await updateRide(editingRide.rideId, updates);
      setPostedRides((prev) =>
        prev.map((r) =>
          r.rideId === editingRide.rideId
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r
        )
      );
      setEditingRide(null);
    } catch (err) {
      console.error("Failed to update ride:", err);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ride ─────────────────────────────────────────────────────
  const handleDeleteRide = async (rideId: string) => {
    try {
      await deleteRide(rideId);
      setPostedRides((prev) => prev.filter((r) => r.rideId !== rideId));
    } catch (err) {
      console.error("Failed to delete ride:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // ── Utility ─────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  const formatDate = (d: string) => {
    if (d === todayStr) return "Today";
    if (d === tomorrowStr) return "Tomorrow";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  const formatTime = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${((h % 12) || 12)}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const statusColor = (r: RidePost) =>
    r.seatsLeft > 0 ? "#16a34a" : "#dc2626";
  const statusLabel = (r: RidePost) =>
    r.status === "cancelled" ? "Cancelled" : r.seatsLeft > 0 ? "Open" : "Full";

  // ── Stats ────────────────────────────────────────────────────────────
  const stats = [
    { icon: <Bike className="w-5 h-5" />, value: String(postedRides.length + joinedRides.length), label: "Total Rides", color: "#3b82f6" },
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
      {/* ── Header gradient ──────────────────────────────────────────── */}
      <div
        className="relative px-4 pt-6 pb-16"
        style={{ background: "linear-gradient(160deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)" }}
      >
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/2" />
        <h2 className="text-white mb-4" style={{ fontWeight: 700, fontSize: "1.3rem" }}>
          My Profile
        </h2>
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
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Name / email */}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 bg-white/20 backdrop-blur border border-white/30 outline-none"
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
                  <h3 className="text-white" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                    {user.name}
                  </h3>
                  <button onClick={() => setEditing(true)}>
                    <Edit3 className="w-4 h-4 text-white/70" />
                  </button>
                </div>
                <p className="text-white/75" style={{ fontSize: "0.85rem" }}>
                  {user.email}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-white/80" style={{ fontSize: "0.75rem" }}>
                    Active rider
                    {userLocation ? ` · ${userLocation.areaName}` : ""}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats floating card ────────────────────────────────────── */}
      <div className="px-4 -mt-10 relative z-10">
        <div
          className="rounded-2xl p-4 grid grid-cols-4 gap-2"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                style={{ background: `${stat.color}18`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>
                {stat.value}
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", lineHeight: 1.3 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── MY RIDES SECTION ──────────────────────────────────────── */}
      <div className="px-4 mt-6">
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          My Rides
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["posted", "joined"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRidesTab(tab)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{
                background: ridesTab === tab ? "var(--primary)" : "var(--card)",
                color: ridesTab === tab ? "white" : "var(--muted-foreground)",
                fontWeight: ridesTab === tab ? 600 : 400,
                border: `1px solid ${ridesTab === tab ? "var(--primary)" : "var(--border)"}`,
              }}
            >
              {tab === "posted" ? `🚲 Posted (${postedRides.length})` : `🤝 Joined (${joinedRides.length})`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {ridesLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Posted rides */}
        {!ridesLoading && ridesTab === "posted" && (
          <div className="space-y-3">
            {postedRides.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "var(--muted)" }}
                >
                  <Bike className="w-7 h-7 text-muted-foreground" />
                </div>
                <p style={{ fontWeight: 600, color: "var(--foreground)", fontSize: "0.9rem" }}>
                  No rides posted yet
                </p>
                <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8rem" }}>
                  Hit the + button to post your first ride
                </p>
              </div>
            ) : (
              postedRides.map((ride) => (
                <div
                  key={ride.rideId}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  {/* Route */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                        <p
                          className="truncate"
                          style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}
                        >
                          {ride.from} → {ride.to}
                        </p>
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: "4px" }}>
                        {formatDate(ride.date)}
                        {ride.time ? `, ${formatTime(ride.time)}` : ""} ·{" "}
                        {ride.seatsLeft}/{ride.seats} seats left
                      </p>
                      {ride.notes && (
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}
                        >
                          "{ride.notes}"
                        </p>
                      )}
                    </div>
                    {/* Status badge */}
                    <span
                      className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: `${statusColor(ride)}15`,
                        color: statusColor(ride),
                      }}
                    >
                      {statusLabel(ride)}
                    </span>
                  </div>

                  {/* Joiners */}
                  {ride.joinedByNames.length > 0 && (
                    <div
                      className="mt-3 px-3 py-2 rounded-xl"
                      style={{ background: "var(--secondary)", fontSize: "0.78rem", color: "var(--secondary-foreground)" }}
                    >
                      🤝 {ride.joinedByNames.join(", ")} joined
                    </div>
                  )}

                  {/* Actions */}
                  {deleteConfirmId === ride.rideId ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-2 rounded-xl border text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", fontWeight: 500 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteRide(ride.rideId)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "#fee2e2", color: "#dc2626" }}
                      >
                        Confirm Delete
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openEditRide(ride)}
                        className="flex-1 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-sm transition-all hover:border-primary"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)", fontWeight: 500 }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(ride.rideId)}
                        className="flex-1 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-sm transition-all hover:border-red-400"
                        style={{ borderColor: "var(--border)", color: "#dc2626", fontWeight: 500 }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Joined rides */}
        {!ridesLoading && ridesTab === "joined" && (
          <div className="space-y-3">
            {joinedRides.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "var(--muted)" }}
                >
                  <Award className="w-7 h-7 text-muted-foreground" />
                </div>
                <p style={{ fontWeight: 600, color: "var(--foreground)", fontSize: "0.9rem" }}>
                  No rides joined yet
                </p>
                <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8rem" }}>
                  Discover rides and hit "Request to Join"
                </p>
              </div>
            ) : (
              joinedRides.map((ride) => (
                <div
                  key={ride.rideId}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                        <p
                          className="truncate"
                          style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}
                        >
                          {ride.from} → {ride.to}
                        </p>
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: "4px" }}>
                        {formatDate(ride.date)}
                        {ride.time ? `, ${formatTime(ride.time)}` : ""}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: "2px" }}>
                        Hosted by{" "}
                        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                          {ride.posterName}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: "#dcfce7", color: "#16a34a" }}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>Joined</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Achievements ──────────────────────────────────────────── */}
      <div className="px-4 mt-6">
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          Achievements
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {[
            { emoji: "🌟", label: "First Ride", earned: (postedRides.length + joinedRides.length) >= 1 },
            { emoji: "🔥", label: "10 Rides", earned: (postedRides.length + joinedRides.length) >= 10 },
            { emoji: "♻️", label: "Eco Rider", earned: postedRides.length >= 3 },
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
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "var(--muted-foreground)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Settings menu ─────────────────────────────────────────── */}
      <div className="px-4 mt-5 space-y-2">
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          Settings
        </p>
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:shadow-md"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${item.color}18`, color: item.color }}
            >
              {item.icon}
            </div>
            <span
              style={{ flex: 1, textAlign: "left", fontWeight: 500, fontSize: "0.9rem", color: "var(--foreground)" }}
            >
              {item.label}
            </span>
            {item.value && (
              <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                {item.value}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:shadow-md mt-4"
          style={{ background: "#fee2e2" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#fecaca", color: "#dc2626" }}
          >
            <LogOut className="w-5 h-5" />
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#dc2626" }}>Sign Out</span>
        </button>
      </div>

      {/* ── Edit Ride Modal ───────────────────────────────────────── */}
      {editingRide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingRide(null)}
          />
          {/* Panel */}
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 space-y-4"
            style={{
              background: "var(--card)",
              borderTop: "1px solid var(--glass-border)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-2" style={{ background: "var(--border)" }} />

            <div className="flex items-center justify-between">
              <h3 style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
                Edit Ride
              </h3>
              <button
                onClick={() => setEditingRide(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            {[
              { key: "from", label: "From", placeholder: "Start location" },
              { key: "to", label: "To", placeholder: "Destination" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                  {label}
                </label>
                <input
                  value={editForm[key as keyof typeof editForm]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full mt-1 px-4 py-3 rounded-xl border outline-none focus:border-primary transition-all text-foreground bg-card"
                  style={{ borderColor: "var(--border)", fontSize: "0.9rem" }}
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                  Date
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl border outline-none focus:border-primary transition-all text-foreground bg-card"
                  style={{ borderColor: "var(--border)", fontSize: "0.9rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl border outline-none focus:border-primary transition-all text-foreground bg-card"
                  style={{ borderColor: "var(--border)", fontSize: "0.9rem" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Seats
              </label>
              <div className="flex gap-3 mt-1">
                {["1", "2", "3"].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEditForm({ ...editForm, seats: n })}
                    className="w-10 h-10 rounded-xl border-2 transition-all font-semibold"
                    style={{
                      borderColor: editForm.seats === n ? "var(--primary)" : "var(--border)",
                      background: editForm.seats === n ? "var(--secondary)" : "transparent",
                      color: editForm.seats === n ? "var(--primary)" : "var(--foreground)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Notes
              </label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes..."
                className="w-full mt-1 px-4 py-3 rounded-xl border outline-none focus:border-primary transition-all text-foreground bg-card resize-none placeholder:text-muted-foreground"
                style={{ borderColor: "var(--border)", fontSize: "0.9rem", minHeight: "64px" }}
              />
            </div>

            <button
              onClick={handleSaveRideEdit}
              disabled={editSaving || !editForm.from || !editForm.to}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}
            >
              {editSaving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
