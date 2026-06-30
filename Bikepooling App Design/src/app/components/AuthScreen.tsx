import { useState } from "react";
import { Bike, Eye, EyeOff, Phone, Mail, Lock, User, ArrowRight, Chrome } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuth: (user: { name: string; email: string; avatar?: string }) => void;
}

type Tab = "login" | "register";
type Method = "email" | "phone";

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [method, setMethod] = useState<Method>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onAuth({
        name: form.name || "Arjun Mehta",
        email: form.email || form.phone || "arjun@example.com",
      });
      setLoading(false);
    }, 1200);
  };

  const handleGoogle = () => {
    setLoading(true);
    setTimeout(() => {
      onAuth({ name: "Arjun Mehta", email: "arjun@gmail.com" });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Left panel — brand */}
      <div
        className="hidden md:flex flex-col justify-between p-12 w-[45%] relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #3b82f6 0%, #2563eb 40%, #1d4ed8 70%, #1e3a5f 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white"
              style={{
                width: `${180 + i * 100}px`,
                height: `${180 + i * 100}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xl" style={{ fontWeight: 700 }}>DostWheels</span>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white/90 text-sm">Ride together, save together</span>
            </div>
            <h1 className="text-white" style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.1 }}>
              Your dost is<br />just a ride away
            </h1>
            <p className="text-white/75" style={{ fontSize: "1rem", fontWeight: 400, lineHeight: 1.7 }}>
              Share your bike commute with friends and save fuel, reduce traffic, and build community.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "12K+", label: "Riders" },
              { value: "48K+", label: "Rides shared" },
              { value: "₹2.4L", label: "Saved total" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center">
                <p className="text-white" style={{ fontWeight: 700, fontSize: "1.35rem" }}>{stat.value}</p>
                <p className="text-white/70" style={{ fontSize: "0.75rem" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          {["Riya", "Sameer", "Priya", "Dev"].map((name, i) => (
            <div
              key={name}
              className="w-9 h-9 rounded-full bg-white/30 backdrop-blur border-2 border-white/50 flex items-center justify-center"
              style={{ marginLeft: i > 0 ? "-10px" : "0", fontWeight: 600, fontSize: "0.75rem", color: "white" }}
            >
              {name[0]}
            </div>
          ))}
          <span className="text-white/80 text-sm ml-2">+2.4k friends riding</span>
        </div>
      </div>

      {/* Right panel — form (frosted glass) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12" style={{ background: "var(--glass-bg)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#3b82f6" }}>
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "#3b82f6" }}>DostWheels</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 style={{ fontWeight: 700, fontSize: "1.75rem", color: "var(--foreground)" }}>
              {tab === "login" ? "Welcome back! 👋" : "Join the crew 🚲"}
            </h2>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "0.95rem" }}>
              {tab === "login" ? "Sign in to continue your ride journey" : "Create your account and start pooling"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "var(--muted)" }}>
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded-lg transition-all duration-200"
                style={{
                  background: tab === t ? "var(--card)" : "transparent",
                  color: tab === t ? "var(--primary)" : "var(--muted-foreground)",
                  fontWeight: tab === t ? 600 : 400,
                  fontSize: "0.9rem",
                  boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl mb-4 border transition-all hover:shadow-md"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderColor: "var(--glass-border)",
              color: "var(--foreground)",
              fontWeight: 500,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>or continue with</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Method toggle */}
          <div className="flex gap-2 mb-4">
            {(["email", "phone"] as Method[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all"
                style={{
                  background: method === m ? "var(--secondary)" : "transparent",
                  borderColor: method === m ? "var(--primary)" : "var(--border)",
                  color: method === m ? "var(--primary)" : "var(--muted-foreground)",
                  fontWeight: method === m ? 600 : 400,
                  fontSize: "0.85rem",
                }}
              >
                {m === "email" ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                {m === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <InputField
                icon={<User className="w-4 h-4" />}
                placeholder="Full name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
            )}
            {method === "email" ? (
              <InputField
                icon={<Mail className="w-4 h-4" />}
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            ) : (
              <InputField
                icon={<Phone className="w-4 h-4" />}
                placeholder="Phone number"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            )}
            <div className="relative">
              <InputField
                icon={<Lock className="w-4 h-4" />}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {tab === "login" && (
              <div className="text-right">
                <button type="button" className="text-sm" style={{ color: "var(--primary)", fontWeight: 500 }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 600, fontSize: "1rem" }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {tab === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-muted-foreground" style={{ fontSize: "0.875rem" }}>
            {tab === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setTab(tab === "login" ? "register" : "login")}
              style={{ color: "var(--primary)", fontWeight: 600 }}
            >
              {tab === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon: React.ReactNode;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all focus-within:border-primary focus-within:shadow-sm"
      style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "var(--glass-border)" }}
    >
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        style={{ fontSize: "0.9rem" }}
      />
    </div>
  );
}
