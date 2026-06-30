import { useState } from "react";
import { MapPin, Calendar, Clock, Users, ArrowRight, CheckCircle2 } from "lucide-react";

interface PostRideScreenProps {
  onPosted: () => void;
}

export function PostRideScreen({ onPosted }: PostRideScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: "1",
    notes: "",
  });

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 1500);
  };

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-6">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--foreground)" }}>Ride Posted! 🎉</h2>
          <p className="text-muted-foreground mt-2" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
            Your ride from <strong style={{ color: "var(--foreground)" }}>{form.from || "Koramangala"}</strong> to{" "}
            <strong style={{ color: "var(--foreground)" }}>{form.to || "Whitefield"}</strong> is live. We'll notify you when someone requests to join!
          </p>
        </div>
        <button
          onClick={() => { setStep(1); setForm({ from: "", to: "", date: "", time: "", seats: "1", notes: "" }); onPosted(); }}
          className="px-8 py-3 rounded-xl transition-all hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 600 }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h2 style={{ fontWeight: 700, fontSize: "1.4rem", color: "var(--foreground)" }}>Post a Ride 🚲</h2>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.875rem" }}>Fill in the details to find your dost</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: step >= s ? "var(--primary)" : "var(--muted)",
                color: step >= s ? "white" : "var(--muted-foreground)",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              {s}
            </div>
            <span style={{ fontSize: "0.8rem", color: step >= s ? "var(--primary)" : "var(--muted-foreground)", fontWeight: step >= s ? 600 : 400 }}>
              {s === 1 ? "Route" : "Schedule"}
            </span>
            {s < 2 && <div className="flex-1 h-0.5 rounded-full" style={{ background: step > s ? "var(--primary)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <SectionCard title="Start Location" icon={<MapPin className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <input
              className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              style={{ fontSize: "0.9rem" }}
              placeholder="e.g. Koramangala 5th Block"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
          </SectionCard>

          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl mx-auto border-2 cursor-pointer hover:border-primary transition-all"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            onClick={() => setForm({ ...form, from: form.to, to: form.from })}
          >
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>

          <SectionCard title="Destination" icon={<MapPin className="w-5 h-5" style={{ color: "var(--accent)" }} />}>
            <input
              className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              style={{ fontSize: "0.9rem" }}
              placeholder="e.g. Whitefield ITPL"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </SectionCard>

          {/* Popular routes */}
          <div>
            <p className="text-muted-foreground mb-3" style={{ fontSize: "0.8rem" }}>Popular routes</p>
            <div className="flex flex-wrap gap-2">
              {[
                { from: "Koramangala", to: "Whitefield" },
                { from: "HSR Layout", to: "Electronic City" },
                { from: "Indiranagar", to: "MG Road" },
              ].map((r) => (
                <button
                  key={r.from}
                  onClick={() => setForm({ ...form, from: r.from, to: r.to })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all hover:border-primary"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", fontSize: "0.8rem" }}
                >
                  <MapPin className="w-3 h-3" style={{ color: "var(--primary)" }} />
                  {r.from} → {r.to}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!form.from || !form.to}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 mt-4"
            style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}
          >
            Next: Schedule <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <SectionCard title="Date" icon={<Calendar className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <input
              type="date"
              className="w-full bg-transparent outline-none text-foreground"
              style={{ fontSize: "0.9rem" }}
              value={form.date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </SectionCard>

          <SectionCard title="Departure Time" icon={<Clock className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <input
              type="time"
              className="w-full bg-transparent outline-none text-foreground"
              style={{ fontSize: "0.9rem" }}
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </SectionCard>

          <SectionCard title="Available Seats" icon={<Users className="w-5 h-5" style={{ color: "var(--primary)" }} />}>
            <div className="flex items-center gap-4">
              {["1", "2", "3"].map((n) => (
                <button
                  key={n}
                  onClick={() => setForm({ ...form, seats: n })}
                  className="w-10 h-10 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.seats === n ? "var(--primary)" : "var(--border)",
                    background: form.seats === n ? "var(--secondary)" : "transparent",
                    color: form.seats === n ? "var(--primary)" : "var(--foreground)",
                    fontWeight: 600,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Notes (optional)" icon={<MapPin className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />}>
            <textarea
              className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground resize-none"
              style={{ fontSize: "0.9rem", minHeight: "70px" }}
              placeholder="Any special instructions or meet-up point..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </SectionCard>

          {/* Summary */}
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ background: "var(--secondary)" }}
          >
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
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3.5 rounded-xl border transition-all hover:border-primary"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", fontWeight: 600 }}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !form.date}
              className="flex-2 flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "white", fontWeight: 600 }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Post Ride 🚲</>
              )}
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
      <div
        className="rounded-xl px-4 py-3.5 border focus-within:border-primary transition-all"
        style={{ background: "var(--input-background)", borderColor: "var(--border)" }}
      >
        {children}
      </div>
    </div>
  );
}
