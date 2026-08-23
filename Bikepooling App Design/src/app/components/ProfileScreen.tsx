import { useState, useEffect, useRef } from "react";
import {
  Bike, Star, MapPin, Plus, Share2, Copy,
  Bell, ShieldCheck, ChevronRight, Car, Gift, User,
  AlertCircle, X, GraduationCap, Briefcase, Lightbulb,
  CheckCircle2, Camera, Wallet, Settings, Edit3, QrCode,
  Calendar, CreditCard, Headphones, History, FileText, Heart, LogOut
} from "lucide-react";
import {
  updateUserProfile, getUserVehicles, saveUserVehicles,
  availableSeats, type Vehicle,
} from "../../lib/userDb";
import { uploadAvatar } from "../../lib/avatarUpload";
import type { UserLocation } from "../../lib/locationService";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileScreenProps {
  user: { id: string; name: string; email: string; avatar?: string };
  onLogout: () => void;
  onUpdateUser: (updates: Partial<{ name: string; email: string; avatar: string }>) => void;
  userLocation?: UserLocation | null;
  isDark?: boolean;
  toggleTheme?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Profile Avatar ───────────────────────────────────────────────────────────

function ProfileAvatar({
  user, onAvatarChange, isVerified
}: {
  user: { id: string; name: string; email?: string; avatar?: string };
  onAvatarChange: (url: string) => void;
  isVerified: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState(user.avatar);
  const color = avatarColor(user.name);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLocalUrl(preview);
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await updateUserProfile(user.id, { avatar: url });
      setLocalUrl(url);
      onAvatarChange(url);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setLocalUrl(user.avatar);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0 w-[84px] h-[84px]">
        {/* Invisible file input overlay for direct mobile tap support */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Upload profile picture"
          onChange={handleFile}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        <div
          className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center cursor-pointer shadow-sm border relative z-0"
          style={{ background: localUrl ? "transparent" : color, borderColor: "var(--border)" }}
        >
          {localUrl ? (
            <img src={localUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>
              {getInitials(user.name)}
            </span>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 z-10">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
        {/* Verification Checkmark or Camera icon */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 z-10 pointer-events-none"
          style={{ borderColor: "var(--background-solid)", backgroundColor: "var(--primary)" }}
        >
          {isVerified ? (
            <CheckCircle2 size={12} color="#fff" />
          ) : (
            <Camera size={12} color="#fff" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold truncate" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>
          {user.name}
        </h1>
        <div className="flex items-center gap-1 mt-0.5">
          <Star size={12} fill="#F59E0B" color="#F59E0B" />
          <span className="text-[11px] font-semibold text-amber-500">Gold Member</span>
        </div>
        <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{user.email}</p>
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        <button className="flex items-center justify-center gap-1.5 border rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "var(--input)" }}>
          <Edit3 size={11} /> Edit Profile
        </button>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center border rounded-xl p-1.5 transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
            <Share2 size={14} />
          </button>
          <button className="flex-1 flex items-center justify-center border rounded-xl p-1.5 transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
            <QrCode size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rider Passport Overlay ───────────────────────────────────────────────────

function PassportOverlay({
  user, userLocation, isVerified, onClose,
}: {
  user: { id: string; name: string; avatar?: string };
  userLocation?: UserLocation | null;
  isVerified: boolean;
  onClose: () => void;
}) {
  const color = avatarColor(user.name);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: color }} />
        )}
        <div className="absolute inset-0 bg-[#0A081C]/70 backdrop-blur-2xl" />
      </div>

      <button onClick={onClose} aria-label="Close"
        className="absolute top-12 right-5 w-10 h-10 rounded-full flex items-center justify-center z-10 border border-white/20 bg-white/10">
        <X size={18} color="#fff" />
      </button>

      {/* Passport Card details */}
      <div className="relative w-full max-w-[340px] mx-5 rounded-[28px] z-10 overflow-hidden"
        style={{
          background: "linear-gradient(150deg,#211D45 0%,#1B1836 55%,#151330 100%)",
          boxShadow: "0 32px 64px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          animation: "passportIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        }} onClick={(e) => e.stopPropagation()}>
        <style>{`
          @keyframes passportIn {
            from { opacity:0; transform: scale(0.88) translateY(20px); }
            to   { opacity:1; transform: scale(1) translateY(0); }
          }
        `}</style>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(120deg,transparent 25%,rgba(201,169,97,0.18) 40%,rgba(255,255,255,0.06) 48%,transparent 60%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
        
        <div className="relative px-6 pt-6 pb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-lg"
            style={{ background: user.avatar ? "transparent" : color }}>
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>{getInitials(user.name)}</span>
            }
          </div>
          <div className="flex-1">
            <p className="text-[9px] tracking-[0.22em] uppercase font-semibold mb-1 text-[#8B87B0]">Rider Passport</p>
            <h2 className="text-[19px] font-semibold text-white leading-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{user.name}</h2>
            <div className="flex items-center gap-1 mt-1 text-[#A6A2C8]">
              <MapPin size={10} className="text-blue-400" />
              <p className="text-[10.5px]">{userLocation?.fullLabel ?? "Location not set"}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: "radial-gradient(circle at 30% 30%,#E7CB92,#C9A961 55%,#9C7A3F 100%)" }}>
              <ShieldCheck size={18} color="#1B1836" strokeWidth={1.6} />
            </div>
            <span className="text-[7.5px] tracking-[0.14em] uppercase font-semibold text-[#C9A961]">Gold</span>
          </div>
        </div>
        <div className="relative h-0 mx-1">
          <div className="absolute left-0 right-0 border-t border-dashed border-white/20 top-0" />
          <div className="absolute -left-5 -top-2.5 w-5 h-5 rounded-full bg-[#0A081C]/90" />
          <div className="absolute -right-5 -top-2.5 w-5 h-5 rounded-full bg-[#0A081C]/90" />
        </div>
        <div className="relative px-6 pt-4 pb-6 flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <Star size={11} fill="#FFB020" color="#FFB020" />
              <span className="text-white font-semibold text-[14px]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>4.8</span>
            </div>
            <span className="text-[9px] text-[#8B87B0]">Ride Score</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold text-[14px]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Your Area</span>
            </div>
            <span className="text-[9px] text-[#8B87B0]">Zone</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] tracking-wider text-[#8B87B0]" style={{ fontFamily: "'JetBrains Mono',monospace" }}>DW-{user.id.slice(0, 4).toUpperCase()}</span>
            {isVerified && (
              <span className="flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                <ShieldCheck size={8} /> Verified
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="relative z-10 mt-5 text-[11px] text-white/50">Tap anywhere to close</p>
    </div>
  );
}

// ─── Add Vehicle Modal ────────────────────────────────────────────────────────

function AddVehicleModal({ initial, onSave, onClose }: { initial?: Vehicle; onSave: (v: Vehicle) => void; onClose: () => void }) {
  const [type, setType] = useState<Vehicle["type"]>(initial?.type ?? "Bike");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [plate, setPlate] = useState(initial?.numberPlate ?? "");
  const [year, setYear] = useState(initial?.year ?? "");
  const [totalSeats, setTotalSeats] = useState(initial?.totalSeats ?? 2);
  const [rc, setRc] = useState(initial?.rcNumber ?? "");
  const [err, setErr] = useState<string | null>(null);

  const handleSave = () => {
    if (!make.trim()) { setErr("Brand / Make is required"); return; }
    if (!model.trim()) { setErr("Model is required"); return; }
    if (!color.trim()) { setErr("Color is required"); return; }
    if (!plate.trim()) { setErr("Number plate is required"); return; }
    const yr = Number(year);
    if (!year.trim() || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1) { setErr("Enter a valid manufacturing year"); return; }
    setErr(null);
    onSave({
      vehicleId: initial?.vehicleId ?? crypto.randomUUID(),
      type, make: make.trim(), model: model.trim(), color: color.trim(), numberPlate: plate.trim().toUpperCase(),
      year: year.trim(), totalSeats, rcNumber: rc.trim() || undefined, addedAt: initial?.addedAt ?? new Date().toISOString(),
    });
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%", background: "var(--input-background)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "10px 14px", fontSize: "0.9rem", color: "var(--foreground)", outline: "none",
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto" 
           style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>{initial ? "Edit Vehicle" : "Add Vehicle"}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--input-background)" }}><X size={16} style={{ color: "var(--muted-foreground)" }} /></button>
        </div>
        <div className="px-5 py-4 space-y-5 pb-10">
          {err && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border border-red-200" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}><AlertCircle size={14} className="shrink-0" />{err}</div>}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vehicle Type</p>
            <div className="flex gap-2">
              {[ { id: "Bike", emoji: "🏍️" }, { id: "Scooter", emoji: "🛵" }, { id: "Car", emoji: "🚗" } ].map((vt) => (
                <button key={vt.id} onClick={() => { setType(vt.id as any); setTotalSeats(vt.id === "Car" ? 5 : 2); }}
                  className={`flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all`}
                  style={{ borderColor: type === vt.id ? "var(--primary)" : "var(--border)", background: type === vt.id ? "var(--input)" : "transparent" }}>
                  <span className="text-xl">{vt.emoji}</span>
                  <span className="text-xs font-semibold" style={{ color: type === vt.id ? "var(--primary)" : "var(--muted-foreground)" }}>{vt.id}</span>
                </button>
              ))}
            </div>
          </div>
          {[
            { label: "Brand / Make *", value: make, set: setMake, placeholder: "e.g. Honda, Royal Enfield" },
            { label: "Model *", value: model, set: setModel, placeholder: type === "Bike" ? "e.g. Classic 350" : type === "Scooter" ? "e.g. Activa 6G" : "e.g. Swift Dzire" },
            { label: "Color *", value: color, set: setColor, placeholder: "e.g. Matte Black, Pearl White" },
            { label: "Number Plate *", value: plate, set: (v: string) => setPlate(v.toUpperCase()), placeholder: "e.g. KA 01 AB 1234" },
            { label: "Manufacturing Year *", value: year, set: setYear, placeholder: `e.g. ${new Date().getFullYear() - 2}`, type: "number" },
          ].map(({ label, value, set, placeholder, type }) => (
            <div key={label}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{label}</p>
              <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} type={type ?? "text"} style={fieldStyle} />
            </div>
          ))}
          {type === "Car" && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Seating Capacity</p>
              <div className="flex gap-3">
                {[5, 6].map((s) => (
                  <button key={s} onClick={() => setTotalSeats(s)} className="flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all"
                          style={{ borderColor: totalSeats === s ? "var(--primary)" : "var(--border)", background: totalSeats === s ? "var(--input)" : "transparent" }}>
                    <span className="font-bold text-lg" style={{ color: totalSeats === s ? "var(--primary)" : "var(--foreground)" }}>{s}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>seater · {s - 1} available</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleSave} className="w-full py-3.5 rounded-xl font-semibold text-white mt-2 shadow-md" style={{ background: "var(--primary)" }}>
            {initial ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Verification Modal ───────────────────────────────────────────────────────

type Profession = "student" | "employee" | "entrepreneur" | null;

const PROFESSION_OPTIONS = [
  { id: "student" as const, icon: <GraduationCap size={26} />, label: "Student", desc: "Currently enrolled in college / school", color: "#3b82f6" },
  { id: "employee" as const, icon: <Briefcase size={26} />, label: "Employee", desc: "Working at a company / organization", color: "#8b5cf6" },
  { id: "entrepreneur" as const, icon: <Lightbulb size={26} />, label: "Entrepreneur", desc: "Running your own business / startup", color: "#f59e0b" },
];

function VerificationModal({ userId, onClose, onVerified }: { userId: string; onClose: () => void; onVerified: () => void; }) {
  const [step, setStep] = useState<"choose" | "form" | "done">("choose");
  const [chosen, setChosen] = useState<Profession>(null);
  const [form, setForm] = useState({ name1: "", name2: "" });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChoose = (prof: Profession) => { setChosen(prof); setStep("form"); setErr(null); setForm({ name1: "", name2: "" }); };

  const handleSubmit = async () => {
    if (!form.name1.trim() || !form.name2.trim()) { setErr("Please fill all required fields"); return; }
    setErr(null); setSubmitting(true);
    try {
      await updateUserProfile(userId, {
        verificationStatus: "pending", verificationProfession: chosen ?? undefined,
        verificationData: JSON.stringify(form), verificationSubmittedAt: new Date().toISOString(),
      });
      setStep("done"); setTimeout(() => { onVerified(); onClose(); }, 1800);
    } catch { setErr("Submission failed. Please try again."); } finally { setSubmitting(false); }
  };

  const fieldStyle: React.CSSProperties = { width: "100%", background: "var(--input-background)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: "0.9rem", color: "var(--foreground)", outline: "none" };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-10" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div><p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>Get Verified</p><p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Earn a trust badge on your Rider Passport</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--input-background)" }}><X size={16} style={{ color: "var(--muted-foreground)" }} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {err && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border border-red-200" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}><AlertCircle size={14} className="shrink-0" />{err}</div>}
          
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Verified riders build more trust with co-riders.</p>
              {PROFESSION_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => handleChoose(opt.id)} className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all hover:opacity-80"
                        style={{ borderColor: "var(--border)", background: "var(--input-background)" }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${opt.color}15`, color: opt.color }}>{opt.icon}</div>
                  <div className="flex-1"><p className="font-semibold" style={{ color: "var(--foreground)" }}>{opt.label}</p><p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{opt.desc}</p></div>
                  <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
                </button>
              ))}
            </div>
          )}

          {step === "form" && (
            <div className="space-y-4">
              <button onClick={() => setStep("choose")} className="text-xs font-semibold" style={{ color: "var(--primary)" }}>← Back</button>
              <input value={form.name1} onChange={(e) => setForm({ ...form, name1: e.target.value })} placeholder={chosen === "student" ? "Institution name *" : chosen === "employee" ? "Company name *" : "Business name *"} style={fieldStyle} />
              <input value={form.name2} onChange={(e) => setForm({ ...form, name2: e.target.value })} placeholder={chosen === "student" ? "Student ID *" : chosen === "employee" ? "Designation *" : "Website (optional)"} style={fieldStyle} />
              <button onClick={handleSubmit} disabled={submitting} className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-70 mt-2 shadow-md"
                      style={{ background: "var(--primary)" }}>
                {submitting ? "Submitting…" : "Submit for Verification"}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-100 text-green-600"><CheckCircle2 size={32} /></div>
              <p className="font-bold text-base" style={{ color: "var(--foreground)" }}>Request submitted!</p>
              <p className="text-sm max-w-[240px]" style={{ color: "var(--muted-foreground)" }}>We'll review your details within 24–48 hours and add a trust badge.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ProfileScreen ───────────────────────────────────────────────────────

export function ProfileScreen({
  user, onLogout, onUpdateUser, userLocation, isDark, toggleTheme,
}: ProfileScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const [localAvatar, setLocalAvatar] = useState(user.avatar);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"none" | "pending" | "approved">("none");
  const [copiedCode, setCopiedCode] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const referCode = `ROHITH100`; // hardcoded as requested in image style
  const isVerified = verificationStatus === "approved";

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => { getUserVehicles(user.id).then((vs) => { setVehicles(vs); setVehiclesLoading(false); }); }, [user.id]);

  const persistVehicles = async (updated: Vehicle[]) => { setVehicles(updated); await saveUserVehicles(user.id, updated); };
  const handleAddVehicle = async (v: Vehicle) => { await persistVehicles([...vehicles, v]); setShowAddVehicle(false); };
  const handleEditVehicle = async (v: Vehicle) => { await persistVehicles(vehicles.map((x) => x.vehicleId === v.vehicleId ? v : x)); setEditingVehicle(null); };
  const handleDeleteVehicle = async (id: string) => { await persistVehicles(vehicles.filter((v) => v.vehicleId !== id)); setConfirmDeleteId(null); };

  const handleCopyCode = () => { navigator.clipboard.writeText(referCode).catch(() => {}); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  return (
    <div className="w-full min-h-screen pb-28" style={{ background: "var(--background-solid)", fontFamily: "'Inter',sans-serif", color: "var(--foreground)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        .dw-scroll-hide::-webkit-scrollbar{display:none}.dw-scroll-hide{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showPassport && <PassportOverlay user={{ ...user, avatar: localAvatar }} userLocation={userLocation} isVerified={isVerified} onClose={() => setShowPassport(false)} />}
      {(showAddVehicle || editingVehicle) && <AddVehicleModal initial={editingVehicle ?? undefined} onSave={editingVehicle ? handleEditVehicle : handleAddVehicle} onClose={() => { setShowAddVehicle(false); setEditingVehicle(null); }} />}
      {showVerify && <VerificationModal userId={user.id} onClose={() => setShowVerify(false)} onVerified={() => setVerificationStatus("pending")} />}

      {/* ── Legal & Safety Modal ─────────────────────────────────────── */}
      {showLegal && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLegal(false)}>
          <div className="w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[88vh] overflow-y-auto" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} /></div>
            <div className="px-6 py-4 sticky top-0 z-10 flex items-center justify-between border-b" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>Legal &amp; Safety</p>
              <button onClick={() => setShowLegal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--input-background)" }}><X size={16} style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            <div className="px-6 py-5 space-y-5 pb-10 text-sm" style={{ color: "var(--foreground)" }}>
              <div className="rounded-xl p-3.5" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <p className="font-bold text-amber-600 text-xs mb-1">About DostWheels</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  DostWheels is a community ride-sharing platform that helps commuters share travel expenses, reduce traffic congestion, and reduce pollution. The platform is intended solely for cost-sharing among users already traveling in the same direction. Commercial taxi operations or profit-making using private vehicles are not permitted.
                </p>
              </div>

              <section>
                <h3 className="font-bold text-sm mb-2" style={{ color: "var(--foreground)" }}>Ride-Sharing Policy</h3>
                <ul className="space-y-2 text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  <li className="flex items-start gap-2"><span className="text-green-500 font-bold shrink-0">✓</span> Drivers must already be making the trip.</li>
                  <li className="flex items-start gap-2"><span className="text-green-500 font-bold shrink-0">✓</span> Rider contributions are limited to sharing trip expenses only.</li>
                  <li className="flex items-start gap-2"><span className="text-red-500 font-bold shrink-0">✗</span> Commercial passenger transport or profit-making is prohibited.</li>
                  <li className="flex items-start gap-2"><span className="text-red-500 font-bold shrink-0">✗</span> Violations may result in account suspension.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-2" style={{ color: "var(--foreground)" }}>Safety Guidelines</h3>
                <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  Always share your ride details with a trusted contact. Verify the rider's or driver's profile and rating before committing to a ride. DostWheels is not responsible for any incidents that occur during rides.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-sm mb-2" style={{ color: "var(--foreground)" }}>Privacy Policy</h3>
                <p className="text-xs" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  Your name, contact info, and location are shared only with your ride co-participants. We do not sell your data to third parties.
                </p>
              </section>

              <button onClick={() => setShowLegal(false)} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>Remove Vehicle?</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>This vehicle will be removed from your profile.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>Cancel</button>
              <button onClick={() => handleDeleteVehicle(confirmDeleteId)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-500 hover:bg-red-600">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOP SECTION (Avatar & Buttons) ═════════════════════════════════ */}
      <div className="px-5 pt-6 pb-4">
        <ProfileAvatar user={{ ...user, avatar: localAvatar }} onAvatarChange={(url) => { setLocalAvatar(url); onUpdateUser({ avatar: url }); }} isVerified={isVerified} />
      </div>

      {/* ══ RIDER PASSPORT CARD ══════════════════════════════════════════ */}
      <div className="px-5 mt-2">
        <div className="relative rounded-[20px] bg-[#1B1836] shadow-xl p-5 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "12px 12px" }} />
          <div className="relative flex justify-between items-start">
            <div>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-0.5">Gold Rider</p>
              <h2 className="text-xl font-bold text-white tracking-wide" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Gold Member</h2>
              <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5"><Calendar size={12} /> Member Since 2024</p>
            </div>
            <div className="w-[52px] h-[52px] bg-gradient-to-br from-[#FCE8B1] via-[#F4B43B] to-[#C97C19] rounded-xl flex items-center justify-center p-[2px] shadow-lg shadow-amber-900/20">
               <div className="w-full h-full border-[1.5px] border-[#FFE6A5]/50 rounded-[9px] flex items-center justify-center">
                 <Star size={24} color="#1B1836" fill="#1B1836" />
               </div>
            </div>
          </div>
          <div className="relative flex justify-between items-end mt-7 pt-4 border-t border-white/10">
            <div className="flex gap-5">
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">Ride Score</p>
                <p className="font-semibold text-white text-[13px] flex items-center gap-1"><Star size={11} fill="#F59E0B" color="#F59E0B"/> 4.8</p>
              </div>
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">Zone</p>
                <p className="font-semibold text-white text-[13px]">Your Area</p>
              </div>
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">Rider ID</p>
                <p className="font-semibold text-white text-[13px]" style={{ fontFamily: "'JetBrains Mono',monospace" }}>DW-{user.id.slice(0, 4).toUpperCase()}</p>
              </div>
            </div>
            <button onClick={() => setShowPassport(true)} className="flex items-center gap-1 border border-white/20 rounded-full px-3 py-1.5 text-[10px] text-white hover:bg-white/5 transition-colors">
              View Digital Card <ChevronRight size={12} className="opacity-70"/>
            </button>
          </div>
        </div>
      </div>

      {/* ══ 4 STATS ROW ════════════════════════════════════════════════════ */}
      <div className="px-5 mt-5 flex gap-3 overflow-x-auto dw-scroll-hide pb-2">
        {[
          { icon: <MapPin size={16} className="text-blue-500" />, iconBg: "rgba(59, 130, 246, 0.15)", value: "284", unit: "km", label: "Distance Travelled" },
          { icon: <Bike size={16} className="text-purple-500" />, iconBg: "rgba(168, 85, 247, 0.15)", value: "2", label: "Total Rides" },
          { icon: <Wallet size={16} className="text-orange-500" />, iconBg: "rgba(249, 115, 22, 0.15)", value: "₹840", label: "Total Saved" },
          { icon: <Star size={16} className="text-green-500" />, iconBg: "rgba(34, 197, 94, 0.15)", value: "4.8", label: "Ride Rating" },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col rounded-[16px] p-3.5 shadow-sm border min-w-[100px] shrink-0"
               style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center mb-3" style={{ background: stat.iconBg }}>{stat.icon}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[17px] font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>{stat.value}</span>
              {stat.unit && <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{stat.unit}</span>}
            </div>
            <span className="text-[10px] font-medium mt-0.5" style={{ color: "var(--muted-foreground)" }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ══ MY VEHICLES ════════════════════════════════════════════════════ */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: "var(--foreground)" }}>
            <Car size={16} style={{ color: "var(--muted-foreground)" }} /> My Vehicles
          </div>
          <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--primary)" }}>
            <Plus size={12} /> Add Vehicle
          </button>
        </div>
        {vehiclesLoading ? (
          <div className="rounded-[16px] border shadow-sm p-8 flex justify-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-5 h-5 border-2 rounded-full animate-spin border-blue-600/30 border-t-blue-600" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-[16px] border shadow-sm p-6 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="border border-dashed rounded-xl p-5" style={{ borderColor: "var(--border)" }}>
              <Car size={28} className="mx-auto text-blue-500 mb-2" />
              <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>No vehicles added yet</p>
              <p className="text-[11px] mt-1 mb-4 max-w-[220px] mx-auto" style={{ color: "var(--muted-foreground)" }}>Add your vehicle for faster bookings and better experience.</p>
              <button onClick={() => setShowAddVehicle(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-md"
                      style={{ background: "var(--primary)" }}>
                <Plus size={13} /> Add My Vehicle
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {vehicles.map((v) => (
              <div key={v.vehicleId} className="flex items-center justify-between p-3.5 rounded-[16px] border shadow-sm"
                   style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-600" style={{ background: "rgba(59, 130, 246, 0.15)" }}>
                    {v.type === "Car" ? <Car size={18} /> : <Bike size={18} />}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>{v.make} {v.model}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{v.numberPlate} • {availableSeats(v)} seat{availableSeats(v) !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingVehicle(v)} className="p-1.5 hover:text-blue-600" style={{ color: "var(--muted-foreground)" }}><Edit3 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ WALLET & GOLD REWARDS ═════════════════════════════════════════ */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        {/* Wallet */}
        <div className="rounded-[20px] p-4 shadow-sm border flex flex-col justify-between" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}><Wallet size={16} className="text-blue-600" fill="#2563EB" /> Wallet</div>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>Balance</p>
            <p className="text-[22px] font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--foreground)" }}>₹840</p>
            <div className="flex justify-between mt-3 mb-4">
              <div>
                <p className="text-[9px] mb-0.5" style={{ color: "var(--muted-foreground)" }}>Cashback</p>
                <p className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>₹120</p>
              </div>
              <div className="w-px h-6" style={{ background: "var(--border)" }} />
              <div>
                <p className="text-[9px] mb-0.5" style={{ color: "var(--muted-foreground)" }}>Coupons</p>
                <p className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>3 Active</p>
              </div>
            </div>
          </div>
          <button className="w-full py-2 rounded-xl text-[11px] font-semibold transition-colors"
                  style={{ color: "var(--primary)", background: "var(--input)" }}>Add Money</button>
        </div>
        {/* Rewards */}
        <div className="rounded-[20px] p-4 shadow-sm border flex flex-col justify-between" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sm mb-4" style={{ color: "var(--foreground)" }}><span className="text-amber-500 text-lg leading-none">👑</span> Gold Rewards</div>
            <div className="flex gap-1 mb-4">
               {[1,2,3].map(i => <Star key={`f${i}`} size={16} fill="#F59E0B" color="#F59E0B" />)}
               {[4,5].map(i => <Star key={`e${i}`} size={16} fill="#E5E7EB" color="#E5E7EB" />)}
            </div>
            <p className="text-[10px] mb-1" style={{ color: "var(--muted-foreground)" }}>Next reward in</p>
            <p className="text-[14px] font-bold mb-4" style={{ color: "var(--primary)" }}>120 Points</p>
          </div>
          <button className="w-full py-2 rounded-xl text-[11px] font-semibold transition-colors"
                  style={{ color: "#b45309", background: "rgba(245, 158, 11, 0.15)" }}>View Benefits</button>
        </div>
      </div>

      {/* ══ QUICK LINKS ══════════════════════════════════════════════════ */}
      <div className="px-5 mt-6">
        <h3 className="font-bold text-[13px] mb-3" style={{ color: "var(--foreground)" }}>Quick Links</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: <User size={15} className="text-blue-400" />, label: "Personal Details" },
            { icon: <ShieldCheck size={15} className="text-green-500" />, label: "KYC Verification", onClick: () => setShowVerify(true) },
            { icon: <CreditCard size={15} className="text-purple-500" />, label: "Payment Methods" },
            { icon: <History size={15} className="text-gray-500" />, label: "Ride History" },
            { icon: <MapPin size={15} className="text-blue-500" />, label: "Saved Addresses" },
            { icon: <FileText size={15} className="text-gray-500" />, label: "Invoices" },
            { icon: <Heart size={15} className="text-red-400" />, label: "Favourite Locations" },
            { icon: <Bell size={15} className="text-amber-400" />, label: "Notifications" },
            { icon: <Headphones size={15} className="text-blue-500" />, label: "Help Center" },
            { icon: <Settings size={15} className="text-gray-500" />, label: "Change Theme", onClick: toggleTheme },
            { icon: <FileText size={15} className="text-orange-500" />, label: "Legal & Safety", onClick: () => setShowLegal(true) },
          ].map((item, i) => (
            <button key={i} onClick={item.onClick} className="flex items-center gap-3 p-3 rounded-[14px] border shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-colors text-left"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--input-background)" }}>{item.icon}</div>
              <span className="text-[11px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ INVITE FRIENDS ════════════════════════════════════════════════ */}
      <div className="px-5 mt-6 mb-8">
        <div className="relative rounded-[16px] bg-blue-600 overflow-hidden flex items-center justify-between p-4 shadow-lg shadow-blue-600/20">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 100% 0%, #fff 0%, transparent 50%)" }} />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 shrink-0 text-3xl">🎁</div>
            <div>
              <p className="font-bold text-[14px] text-white">Invite Friends</p>
              <p className="text-[9px] text-blue-100 mt-0.5">Earn ₹100 for every successful referral</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 relative z-10 shrink-0">
             <p className="text-[8px] text-blue-200">Referral Code</p>
             <div className="flex items-center gap-1 border border-blue-400 border-dashed rounded-lg pl-2 pr-1 py-1 bg-blue-700/50">
               <span className="text-[11px] font-bold text-white uppercase tracking-wider">{referCode}</span>
               <button onClick={handleCopyCode} className="bg-white text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 hover:bg-blue-50 transition-colors">
                 {copiedCode ? "Copied" : "Copy"}
               </button>
             </div>
             <button className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white border border-blue-400 shadow-sm hover:bg-blue-400 transition-colors">
               <Share2 size={11} />
             </button>
          </div>
        </div>
      </div>

      {/* ══ LOGOUT BUTTON ══════════════════════════════════════════════════ */}
      <div className="px-5 mt-2 mb-8">
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border font-semibold text-red-500 hover:bg-red-50 transition-colors"
                style={{ borderColor: "rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.05)" }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
