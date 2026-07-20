import { useState, useEffect } from "react";
import { Calendar, Clock, Users, ArrowRight, CheckCircle2, FileText, AlertCircle, Car, Bike, Plus, CheckCircle } from "lucide-react";
import { MapPin } from "lucide-react";
import { createRide } from "../../lib/ridesDb";
import type { VehicleDetails } from "../../lib/ridesDb";
import type { UserLocation } from "../../lib/locationService";
import { PlacesAutocomplete } from "./PlacesAutocomplete";
import { getUserVehicles, availableSeats, type Vehicle } from "../../lib/userDb";

interface PostRideScreenProps {
  onPosted: () => void;
  userId: string;
  userName: string;
  userLocation?: UserLocation | null;
  onGoToProfile?: () => void;
}

const VEHICLE_EMOJI: Record<string, string> = { Bike: "🏍️", Scooter: "🛵", Car: "🚗" };

export function PostRideScreen({ onPosted, userId, userName, userLocation, onGoToProfile }: PostRideScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postedRideId, setPostedRideId] = useState<string | null>(null);

  const [savedVehicles, setSavedVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  const [form, setForm] = useState({
    from: userLocation?.areaName ?? "",
    to: "",
    date: "",
    time: "",
    seats: "1",
    notes: "",
  });

  useEffect(() => {
    getUserVehicles(userId)
      .then((vs) => {
        setSavedVehicles(vs);
        if (vs.length === 1) {
          setSelectedVehicleId(vs[0].vehicleId);
          setForm((f) => ({ ...f, seats: String(availableSeats(vs[0])) }));
        }
      })
      .finally(() => setVehiclesLoading(false));
  }, [userId]);

  const selectedVehicle = savedVehicles.find((v) => v.vehicleId === selectedVehicleId) ?? null;

  const handleSelectVehicle = (v: Vehicle) => {
    setSelectedVehicleId(v.vehicleId);
    setForm((f) => ({ ...f, seats: String(availableSeats(v)) }));
  };

  const buildVehicleDetails = (): VehicleDetails | undefined => {
    if (!selectedVehicle) return undefined;
    return {
      vehicleType: selectedVehicle.type,
      make: selectedVehicle.make,
      vehicleModel: `${selectedVehicle.make} ${selectedVehicle.model}`,
      vehicleColor: selectedVehicle.color,
      vehicleNumber: selectedVehicle.numberPlate,
      rcNumber: selectedVehicle.rcNumber,
      year: selectedVehicle.year,
    };
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const ride = await createRide({
        userId,
        posterName: userName,
        from: form.from,
        to: form.to,
        fromCoords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
        date: form.date,
        time: form.time,
        seats: Number(form.seats),
        notes: form.notes || undefined,
        vehicle: buildVehicleDetails(),
      });
      setPostedRideId(ride.rideId);
      setStep(3);
    } catch (err) {
      console.error("Failed to post ride:", err);
      setError("Failed to save your ride. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedVehicleId(null);
    setForm({ from: userLocation?.areaName ?? "", to: "", date: "", time: "", seats: "1", notes: "" });
    setPostedRideId(null);
    onPosted();
  };

  // ── Step 3: Success ───────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}>
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--foreground)" }}>Ride Posted! 🎉</h2>
          <p className="text-muted-foreground mt-2" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
            Your ride from <strong style={{ color: "var(--foreground)" }}>{form.from}</strong> to{" "}
            <strong style={{ color: "var(--foreground)" }}>{form.to}</strong> is live.
            We'll notify you when someone requests to join!
          </p>
          {selectedVehicle && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {VEHICLE_EMOJI[selectedVehicle.type]} {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.numberPlate}
            </p>
          )}
        </div>
        <button onClick={resetForm} className="px-8 py-3 rounded-xl transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 600 }}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      <div className="mb-6">
        <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>Post a Ride 🚲</h2>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>Fill in the details to find your dost</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: step >= s ? "var(--primary)" : "var(--muted)", color: step >= s ? "white" : "var(--muted-foreground)", fontWeight: 600, fontSize: "0.8rem" }}>
              {s}
            </div>
            <span style={{ fontSize: "0.8rem", color: step >= s ? "var(--primary)" : "var(--muted-foreground)", fontWeight: step >= s ? 600 : 400 }}>
              {s === 1 ? "Route" : "Schedule"}
            </span>
            {s < 2 && <div className="flex-1 h-0.5 rounded-full" style={{ background: step > s ? "var(--primary)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "var(--destructive)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* ── Step 1: Route ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionCard title="Start Location" icon={<MapPin className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <PlacesAutocomplete id="from-location" value={form.from}
              onChange={(val) => setForm({ ...form, from: val })}
              placeholder={userLocation ? `e.g. ${userLocation.areaName}` : "e.g. Koramangala 5th Block"}
              pinColor="#2E5BFF" biasLat={userLocation?.lat} biasLng={userLocation?.lng} />
          </SectionCard>

          <div className="flex items-center justify-center w-9 h-9 rounded-xl mx-auto border-2 cursor-pointer hover:border-primary transition-all"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            onClick={() => setForm({ ...form, from: form.to, to: form.from })}>
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>

          <SectionCard title="Destination" icon={<MapPin className="w-5 h-5" style={{ color: "var(--accent)" }} />}>
            <PlacesAutocomplete id="to-location" value={form.to}
              onChange={(val) => setForm({ ...form, to: val })}
              placeholder="e.g. Whitefield ITPL" pinColor="#FFB020"
              biasLat={userLocation?.lat} biasLng={userLocation?.lng} />
          </SectionCard>

          <div>
            <p className="text-muted-foreground mb-3" style={{ fontSize: "0.8rem" }}>Popular routes</p>
            <div className="flex flex-wrap gap-2">
              {[
                { from: userLocation?.areaName ?? "Koramangala", to: "Whitefield" },
                { from: "HSR Layout", to: "Electronic City" },
                { from: "Indiranagar", to: "MG Road" },
              ].map((r) => (
                <button key={`${r.from}-${r.to}`} onClick={() => setForm({ ...form, from: r.from, to: r.to })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all hover:border-primary"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", fontSize: "0.8rem" }}>
                  <MapPin className="w-3 h-3" style={{ color: "var(--primary)" }} />
                  {r.from} → {r.to}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!form.from || !form.to}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 mt-4"
            style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}>
            Next: Schedule <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Schedule + Vehicle ────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <SectionCard title="Date" icon={<Calendar className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <input type="date" className="w-full bg-transparent outline-none text-foreground"
              style={{ fontSize: "0.9rem" }} value={form.date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </SectionCard>

          <SectionCard title="Departure Time" icon={<Clock className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <input type="time" className="w-full bg-transparent outline-none text-foreground"
              style={{ fontSize: "0.9rem" }} value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </SectionCard>

          {/* ── Vehicle Picker ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-5 h-5" style={{ color: "var(--primary)" }} />
              <label style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>Select Vehicle</label>
            </div>

            {vehiclesLoading ? (
              <div className="rounded-xl px-4 py-6 border text-center" style={{ borderColor: "var(--border)", background: "var(--input-background)" }}>
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>Loading vehicles…</p>
              </div>
            ) : savedVehicles.length === 0 ? (
              <div className="rounded-xl px-4 py-5 border-2 border-dashed text-center space-y-3"
                style={{ borderColor: "var(--primary)", background: "rgba(59,130,246,0.04)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-2xl" style={{ background: "var(--secondary)" }}>🚗</div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>No vehicles added yet</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    Add your vehicle in your profile to enable vehicle selection
                  </p>
                </div>
                <button onClick={onGoToProfile}
                  className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "var(--primary)", color: "white" }}>
                  <Plus className="w-4 h-4" /> Add Vehicle in Profile
                </button>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>You can still post this ride without a vehicle</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedVehicles.map((v) => {
                  const seats = availableSeats(v);
                  const isSelected = selectedVehicleId === v.vehicleId;
                  return (
                    <button key={v.vehicleId} onClick={() => handleSelectVehicle(v)}
                      className="w-full text-left rounded-xl px-4 py-3 border-2 transition-all active:scale-[0.99]"
                      style={{ borderColor: isSelected ? "var(--primary)" : "var(--border)", background: isSelected ? "rgba(59,130,246,0.06)" : "var(--input-background)" }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{VEHICLE_EMOJI[v.type]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>{v.make} {v.model}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{v.color} · {v.year}</span>
                            <span className="text-xs font-mono px-1.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>{v.numberPlate}</span>
                            <span className="text-xs px-1.5 rounded font-medium" style={{ background: "rgba(20,184,166,0.12)", color: "#0d9488" }}>
                              {seats} seat{seats > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />}
                      </div>
                    </button>
                  );
                })}
                <button onClick={onGoToProfile}
                  className="w-full text-left rounded-xl px-4 py-3 border-2 border-dashed transition-all flex items-center gap-3"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <Plus className="w-5 h-5" /><span className="text-sm">Add another vehicle</span>
                </button>
              </div>
            )}
          </div>

          {/* Available Seats */}
          <SectionCard title="Available Seats" icon={<Users className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <div className="space-y-2">
              {selectedVehicle && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Auto-set from vehicle · adjust if needed</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                {(selectedVehicle?.type === "Bike" || selectedVehicle?.type === "Scooter") ? (
                  <div className="w-10 h-10 rounded-xl border-2 flex items-center justify-center font-semibold"
                    style={{ borderColor: "var(--primary)", background: "var(--secondary)", color: "var(--primary)" }}>1</div>
                ) : (
                  ["1", "2", "3", "4"].map((n) => (
                    <button key={n} onClick={() => setForm({ ...form, seats: n })}
                      className="w-10 h-10 rounded-xl border-2 transition-all font-semibold"
                      style={{ borderColor: form.seats === n ? "var(--primary)" : "var(--border)", background: form.seats === n ? "var(--secondary)" : "transparent", color: form.seats === n ? "var(--primary)" : "var(--foreground)" }}>
                      {n}
                    </button>
                  ))
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Notes (optional)" icon={<FileText className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />}>
            <textarea className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground resize-none"
              style={{ fontSize: "0.9rem", minHeight: "70px" }}
              placeholder="Any special instructions or meet-up point..."
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </SectionCard>

          {/* Summary */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--secondary)" }}>
            <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>Ride Summary</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{form.from} → {form.to}</span>
            </div>
            {form.date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{form.date} at {form.time || "TBD"}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{form.seats} seat{Number(form.seats) > 1 ? "s" : ""} available</span>
            </div>
            {selectedVehicle && (
              <div className="flex items-center gap-2">
                <span>{VEHICLE_EMOJI[selectedVehicle.type]}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>
                  {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.numberPlate}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl border transition-all hover:border-primary"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", fontWeight: 600 }}>Back</button>
            <button onClick={handleSubmit} disabled={loading || !form.date}
              className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}>
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Post Ride 🚲</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <label style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>{title}</label>
      </div>
      <div className="rounded-xl px-4 py-3.5 border focus-within:border-primary transition-all"
        style={{ background: "var(--input-background)", borderColor: "var(--border)" }}>
        {children}
      </div>
    </div>
  );
}
