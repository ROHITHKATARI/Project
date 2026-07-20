import { useState, useEffect, useRef } from "react";
import {
  X, MapPin, Clock, MessageCircle, Navigation2,
  Send, Car, Bike, ChevronRight, Star, Loader2,
  RadioTower, Briefcase, Building2, Info,
} from "lucide-react";
import type { RidePost } from "../../lib/ridesDb";
import { sendMessage, getMessages, type ChatMessage } from "../../lib/chatDb";
import { updateMyLocation, getRideLocations, type ParticipantLocation } from "../../lib/locationDb";
import { getUserProfile, type UserProfile } from "../../lib/userDb";

// ─── Props ────────────────────────────────────────────────────────────
interface RideDetailScreenProps {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
}

type Tab = "details" | "location" | "chat";

// ─── Helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#3b82f6","#14b8a6","#8b5cf6","#ec4899","#f59e0b","#06b6d4","#10b981"];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatRideDate(dateStr: string, timeStr: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  const label = dateStr === todayStr ? "Today" : dateStr === tomorrowStr ? "Tomorrow" : new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (!timeStr) return label;
  const [h, m] = timeStr.split(":").map(Number);
  return `${label} at ${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const VEHICLE_ICONS: Record<string, string> = { Bike: "🏍️", Scooter: "🛵", Car: "🚗" };

// ─── Member Profile Bottom-Sheet ──────────────────────────────────────
function MemberProfileSheet({
  profile, userId, name, role, onClose,
}: {
  profile: UserProfile | null; userId: string; name: string;
  role: "Host" | "Rider"; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl pb-10"
        style={{ background: "var(--card)", boxShadow: "0 -20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 pt-4 pb-5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: avatarColor(userId) }}
          >
            {initials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{name}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: role === "Host" ? "rgba(59,130,246,0.12)" : "rgba(20,184,166,0.12)",
                  color: role === "Host" ? "var(--primary)" : "#0d9488",
                }}
              >{role}</span>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#f59e0b" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{profile?.rating || "4.8"}</span>
              </div>
              {(profile?.rides ?? 0) > 0 && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>· {profile!.rides} rides</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 pt-4 space-y-4">
          {(profile?.jobTitle || profile?.workplace) && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)" }}>
                <Briefcase className="w-4 h-4" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                {profile?.jobTitle && <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{profile.jobTitle}</p>}
                {profile?.workplace && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{profile.workplace}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {profile?.bio && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.1)" }}>
                <Info className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-sm italic flex-1" style={{ color: "var(--foreground)", lineHeight: 1.6 }}>
                &ldquo;{profile.bio}&rdquo;
              </p>
            </div>
          )}
          {!profile?.jobTitle && !profile?.workplace && !profile?.bio && (
            <div className="rounded-2xl py-6 text-center" style={{ background: "var(--secondary)" }}>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No profile info added yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                Users can add bio &amp; job from their Profile tab
              </p>
            </div>
          )}
          {profile?.createdAt && (
            <p className="text-xs text-center pb-2" style={{ color: "var(--muted-foreground)" }}>
              Member since {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Details ─────────────────────────────────────────────────────
function DetailsTab({ ride, currentUserId }: { ride: RidePost; currentUserId: string }) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null>>({});
  const [selectedMember, setSelectedMember] = useState<{
    userId: string; name: string; role: "Host" | "Rider";
  } | null>(null);
  const isHost = currentUserId === ride.userId;

  useEffect(() => {
    const ids = [ride.userId, ...(ride.joinedByIds ?? [])].filter(Boolean);
    if (ids.length === 0) return;
    Promise.all(
      ids.map((id) => getUserProfile(id).then((p) => [id, p] as [string, UserProfile | null]).catch(() => [id, null] as [string, null]))
    ).then((entries) => setProfiles(Object.fromEntries(entries)));
  }, [ride.rideId]);

  return (
    <div className="space-y-4 pb-6">
      {/* Member profile sheet */}
      {selectedMember && (
        <MemberProfileSheet
          profile={profiles[selectedMember.userId] ?? null}
          userId={selectedMember.userId}
          name={selectedMember.name}
          role={selectedMember.role}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Host context banner (host view) */}
      {isHost && (
        <div
          className="rounded-2xl p-3 flex items-center gap-2"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <span className="text-lg">🎯</span>
          <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            You are the host &middot; Tap any member to view their profile
          </p>
        </div>
      )}

      {/* Host card (joiner view) */}
      {!isHost && (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ride Host</p>
          <button
            className="w-full flex items-center gap-3 text-left"
            onClick={() => setSelectedMember({ userId: ride.userId, name: ride.posterName, role: "Host" })}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: avatarColor(ride.userId), fontSize: "0.85rem" }}
            >
              {initials(ride.posterName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.posterName}</p>
              {profiles[ride.userId]?.jobTitle && (
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  💼 {profiles[ride.userId]!.jobTitle}
                  {profiles[ride.userId]?.workplace ? ` · ${profiles[ride.userId]!.workplace}` : ""}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 fill-current" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>4.8</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>&middot; Tap to view profile</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      )}

      {/* Route */}
      <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Route</p>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--primary)" }} />
            <div className="w-px flex-1 border-l-2 border-dashed" style={{ borderColor: "var(--border)", minHeight: "24px" }} />
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#f59e0b" }} />
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>From</p>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.from}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>To</p>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{ride.to}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {formatRideDate(ride.date, ride.time)}
          </span>
        </div>
      </div>

      {/* Vehicle */}
      {ride.vehicle ? (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vehicle</p>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: "var(--secondary)" }}
            >
              {VEHICLE_ICONS[ride.vehicle.vehicleType] ?? "🚲"}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg" style={{ color: "var(--foreground)", lineHeight: 1.2 }}>
                {ride.vehicle.vehicleModel}
              </p>
              {ride.vehicle.year && (
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{ride.vehicle.year}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.12)", color: "var(--primary)" }}>
                  {ride.vehicle.vehicleType}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                  {ride.vehicle.vehicleColor}
                </span>
                {ride.vehicle.vehicleNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium font-mono" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>
                    {ride.vehicle.vehicleNumber}
                  </span>
                )}
                {ride.vehicle.rcNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(139,92,246,0.12)", color: "#7c3aed" }}>
                    RC ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "var(--secondary)", border: "1px dashed var(--border)" }}>
          <Bike className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Vehicle details not provided</p>
        </div>
      )}

      {/* Members — tappable */}
      <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Members ({1 + (ride.joinedByIds?.length ?? 0)})
        </p>
        <div className="space-y-1">
          {/* Host row */}
          <button
            className="w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left transition-all active:scale-[0.99]"
            style={{ background: isHost ? "rgba(59,130,246,0.06)" : "transparent" }}
            onClick={() => setSelectedMember({ userId: ride.userId, name: ride.posterName, role: "Host" })}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
              style={{ background: avatarColor(ride.userId) }}
            >
              {initials(ride.posterName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {ride.posterName}
                {ride.userId === currentUserId && (
                  <span className="font-normal text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>(you)</span>
                )}
              </p>
              {profiles[ride.userId]?.jobTitle && (
                <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                  {profiles[ride.userId]!.jobTitle}
                </p>
              )}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(59,130,246,0.12)", color: "var(--primary)" }}>
              Host
            </span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          </button>

          {/* Joiner rows */}
          {(ride.joinedByNames ?? []).map((name, i) => {
            const uid = ride.joinedByIds?.[i] ?? name;
            return (
              <button
                key={i}
                className="w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left transition-all active:scale-[0.99]"
                style={{ background: uid === currentUserId ? "rgba(20,184,166,0.06)" : "transparent" }}
                onClick={() => setSelectedMember({ userId: uid, name, role: "Rider" })}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: avatarColor(uid) }}
                >
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {name}
                    {uid === currentUserId && (
                      <span className="font-normal text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>(you)</span>
                    )}
                  </p>
                  {profiles[uid]?.jobTitle && (
                    <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{profiles[uid]!.jobTitle}</p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(20,184,166,0.12)", color: "#0d9488" }}>
                  Rider
                </span>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {ride.notes && (
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Notes from host</p>
          <p className="text-sm italic" style={{ color: "var(--foreground)", lineHeight: 1.6 }}>
            &ldquo;{ride.notes}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Live Location ───────────────────────────────────────────────
function LiveLocationTab({
  ride,
  currentUserId,
  currentUserName,
}: {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
}) {
  const [sharing, setSharing] = useState(false);
  const [locations, setLocations] = useState<ParticipantLocation[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [shareError, setShareError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Centre of locations for map embed
  const mapCenter = locations.length > 0
    ? {
        lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length,
        lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length,
      }
    : ride.fromCoords ?? { lat: 12.9716, lng: 77.5946 }; // default: Bengaluru

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.02}%2C${mapCenter.lat - 0.015}%2C${mapCenter.lng + 0.02}%2C${mapCenter.lat + 0.015}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lng}`;

  // Fetch all participants' locations
  const fetchLocations = async () => {
    const locs = await getRideLocations(ride.rideId);
    setLocations(locs);
    setLoadingLoc(false);
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10_000);
    return () => clearInterval(interval);
  }, [ride.rideId]);

  // Toggle location sharing
  const toggleSharing = () => {
    if (sharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharing(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setShareError("Your browser does not support geolocation.");
      return;
    }

    setShareError(null);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        await updateMyLocation(
          ride.rideId,
          currentUserId,
          currentUserName,
          pos.coords.latitude,
          pos.coords.longitude
        );
        fetchLocations();
      },
      (err) => {
        setShareError(err.code === 1 ? "Location permission denied." : "Could not get location.");
        setSharing(false);
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
    watchIdRef.current = id;
    setSharing(true);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 pb-6">
      {/* Share toggle */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: sharing ? "rgba(16,185,129,0.12)" : "var(--secondary)" }}
          >
            {sharing
              ? <RadioTower className="w-5 h-5" style={{ color: "#10b981" }} />
              : <Navigation2 className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
            }
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {sharing ? "Sharing your location" : "Share my location"}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {sharing ? "Visible to all ride members" : "Let others see where you are"}
            </p>
          </div>
        </div>
        <button
          onClick={toggleSharing}
          className="w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0"
          style={{ background: sharing ? "#10b981" : "var(--muted)" }}
        >
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow"
            style={{ left: sharing ? "26px" : "2px" }}
          />
        </button>
      </div>

      {shareError && (
        <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--destructive)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {shareError}
        </div>
      )}

      {/* Map embed */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--glass-border)", height: "260px" }}>
        <iframe
          src={mapUrl}
          width="100%"
          height="260"
          style={{ border: 0 }}
          title="Ride map"
          loading="lazy"
        />
      </div>

      {/* Participants */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--card)", border: "1px solid var(--glass-border)" }}
      >
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Member Locations
        </p>
        {loadingLoc ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: "var(--muted-foreground)" }}>
            No one has shared their location yet.
          </p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.userId} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: avatarColor(loc.userId) }}
                >
                  {initials(loc.userName)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {loc.userName} {loc.userId === currentUserId && <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>(you)</span>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Updated {timeAgo(loc.updatedAt)}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
        Locations refresh every 10 seconds
      </p>
    </div>
  );
}

// ─── Tab: Group Chat ──────────────────────────────────────────────────
function ChatTab({
  ride,
  currentUserId,
  currentUserName,
}: {
  ride: RidePost;
  currentUserId: string;
  currentUserName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);

  const fetchMessages = async (initial = false) => {
    const msgs = await getMessages(ride.rideId);
    setMessages(msgs);
    setLoadingChat(false);
    if (msgs.length > 0) {
      lastMessageIdRef.current = msgs[msgs.length - 1].messageId;
    }
    if (initial || msgs.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: initial ? "auto" : "smooth" }), 50);
    }
  };

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 5_000);
    return () => clearInterval(interval);
  }, [ride.rideId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Optimistic update
    const optimistic: ChatMessage = {
      rideId: ride.rideId,
      messageId: `${new Date().toISOString()}#optimistic`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    await sendMessage(ride.rideId, currentUserId, currentUserName, text);
    setSending(false);
    // Refetch to get the real messageId
    fetchMessages(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "360px" }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loadingChat ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--secondary)" }}>
              <MessageCircle className="w-7 h-7" style={{ color: "var(--muted-foreground)" }} />
            </div>
            <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
              No messages yet.<br />Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.messageId}
                className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2 items-end`}
              >
                {!isMe && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: avatarColor(msg.senderId), fontSize: "0.65rem", marginBottom: "2px" }}
                  >
                    {initials(msg.senderName)}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isMe && (
                    <p className="text-xs font-semibold px-1" style={{ color: "var(--muted-foreground)" }}>
                      {msg.senderName.split(" ")[0]}
                    </p>
                  )}
                  <div
                    className="px-3.5 py-2.5 rounded-2xl"
                    style={{
                      background: isMe
                        ? "linear-gradient(135deg, var(--primary), #6d28d9)"
                        : "var(--card)",
                      color: isMe ? "white" : "var(--foreground)",
                      border: isMe ? "none" : "1px solid var(--glass-border)",
                      borderBottomRightRadius: isMe ? "6px" : "16px",
                      borderBottomLeftRadius: isMe ? "16px" : "6px",
                      boxShadow: isMe ? "0 2px 12px rgba(109,40,217,0.25)" : "none",
                    }}
                  >
                    <p className="text-sm" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>{msg.text}</p>
                  </div>
                  <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
                    {formatTime(msg.sentAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="px-4 py-3 flex items-end gap-3"
        style={{
          borderTop: "1px solid var(--glass-border)",
          background: "var(--background)",
        }}
      >
        <div
          className="flex-1 rounded-2xl px-4 py-2.5 flex items-center"
          style={{
            background: "var(--card)",
            border: "1px solid var(--glass-border)",
            minHeight: "44px",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none"
            style={{
              color: "var(--foreground)",
              fontSize: "0.9rem",
              maxHeight: "100px",
              lineHeight: 1.5,
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, var(--primary), #6d28d9)",
            boxShadow: "0 4px 14px rgba(109,40,217,0.35)",
          }}
        >
          {sending
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Send className="w-5 h-5 text-white" />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Root: RideDetailScreen ───────────────────────────────────────────
export function RideDetailScreen({ ride, currentUserId, currentUserName, onClose }: RideDetailScreenProps) {
  const [tab, setTab] = useState<Tab>("details");

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "details",  label: "Details",  icon: <Car className="w-4 h-4" /> },
    { id: "location", label: "Location", icon: <MapPin className="w-4 h-4" /> },
    { id: "chat",     label: "Chat",     icon: <MessageCircle className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
          style={{ background: "var(--secondary)", color: "var(--foreground)" }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate" style={{ fontSize: "1rem", color: "var(--foreground)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {ride.from} → {ride.to}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            Hosted by {ride.posterName}
          </p>
        </div>
        {/* Seats badge */}
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            background: ride.seatsLeft > 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: ride.seatsLeft > 0 ? "#16a34a" : "#dc2626",
          }}
        >
          {ride.seatsLeft > 0 ? `${ride.seatsLeft} seats left` : "Full"}
        </span>
      </div>

      {/* Tab bar */}
      <div
        className="flex px-4 py-2 gap-1 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? "var(--primary)" : "transparent",
              color: tab === t.id ? "white" : "var(--muted-foreground)",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "details" && (
          <div className="px-4 pt-4">
            <DetailsTab ride={ride} currentUserId={currentUserId} />
          </div>
        )}
        {tab === "location" && (
          <div className="px-4 pt-4">
            <LiveLocationTab ride={ride} currentUserId={currentUserId} currentUserName={currentUserName} />
          </div>
        )}
        {tab === "chat" && (
          <ChatTab ride={ride} currentUserId={currentUserId} currentUserName={currentUserName} />
        )}
      </div>
    </div>
  );
}
