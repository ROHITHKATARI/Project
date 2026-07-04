import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Mail, CheckCircle2 } from "lucide-react";
import { TandemBike } from "./ui/TandemBike";
import {
  registerWithEmail,
  loginWithEmail,
  confirmEmail,
  resendCode,
  signInWithGoogle,
} from "../../lib/auth";
import { upsertUserProfile } from "../../lib/userDb";

interface AuthScreenProps {
  onAuth: (user: { id: string; name: string; email: string; avatar?: string }) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

type Tab = "login" | "register" | "confirm";

interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

function FloatingInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  required = true,
}: FloatingInputProps) {
  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        required={required}
        className="peer w-full pt-5 pb-1.5 px-4 rounded-xl border border-border bg-card text-foreground text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder-transparent"
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-1.5 text-[10px] font-semibold text-muted-foreground pointer-events-none transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-primary"
      >
        {label}
      </label>
    </div>
  );
}

export function AuthScreen({ onAuth, isDark, toggleTheme }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", emailOrPhone: "", password: "" });
  const [confirmCode, setConfirmCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(false);

  const clearError = () => setError(null);

  // ─── Register ──────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!form.name.trim()) { setError("Please enter your full name."); return; }
    if (!form.emailOrPhone.trim()) { setError("Please enter your email address."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await registerWithEmail(form.name.trim(), form.emailOrPhone.trim(), form.password);
      setPendingEmail(form.emailOrPhone.trim());
      setPendingName(form.name.trim());
      setTab("confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Login ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!form.emailOrPhone.trim()) { setError("Please enter your email address."); return; }
    if (!form.password) { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      const authUser = await loginWithEmail(form.emailOrPhone.trim(), form.password);
      // Load or create profile in DynamoDB
      const profile = await upsertUserProfile(
        authUser.userId, authUser.name, authUser.email, "email"
      );
      onAuth({ id: profile.userId, name: profile.name, email: profile.email, avatar: profile.avatar });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Confirm email ─────────────────────────────────────────────────
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (confirmCode.trim().length !== 6) { setError("Please enter the 6-digit code sent to your email."); return; }
    setLoading(true);
    try {
      await confirmEmail(pendingEmail, confirmCode.trim());
      // Auto-sign in after confirmation
      const authUser = await loginWithEmail(pendingEmail, form.password);
      // Create profile in DynamoDB
      const profile = await upsertUserProfile(
        authUser.userId, pendingName || authUser.name, authUser.email, "email"
      );
      onAuth({ id: profile.userId, name: profile.name, email: profile.email });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend code ───────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown) return;
    setResendCooldown(true);
    clearError();
    try {
      await resendCode(pendingEmail);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    }
    setTimeout(() => setResendCooldown(false), 30000);
  };

  // ─── Google sign-in ────────────────────────────────────────────────
  const handleGoogle = async () => {
    clearError();
    setLoading(true);
    try {
      await signInWithGoogle(); // Redirects to Cognito Hosted UI
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handleSubmit = tab === "login" ? handleLogin : tab === "register" ? handleRegister : handleConfirm;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-background transition-colors duration-300">
      <div className="w-full max-w-5xl glass-card overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-2xl rounded-[28px]">
        
        {/* BRAND PANEL */}
        <div
          className="relative md:col-span-5 p-8 md:p-12 flex flex-col justify-between overflow-hidden min-h-[240px] md:min-h-[640px] text-white transition-all duration-300"
          style={{
            background: isDark
              ? "linear-gradient(165deg, #090d16 0%, #111827 55%, #1e3a8a 100%)"
              : "linear-gradient(165deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%)",
          }}
        >
          {/* Route path SVG */}
          <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 540 640" preserveAspectRatio="none">
            <path className="fill-none stroke-white/20 stroke-[2] stroke-dasharray-[6_10] stroke-linecap-round" d="M -40 420 C 140 320, 220 520, 420 380 S 700 180, 980 300" />
            <circle cx="-40" cy="420" r="4" className="fill-[#FFB020]" style={{ filter: "drop-shadow(0 0 6px rgba(255,176,32,0.8))" }} />
            <circle cx="420" cy="380" r="4" className="fill-[#FFB020]" style={{ filter: "drop-shadow(0 0 6px rgba(255,176,32,0.8))" }} />
          </svg>
          <div className="rider hidden md:block" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6 md:mb-10">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md">
                <TandemBike className="w-8.5 h-8.5" />
              </div>
              <span className="text-2xl font-bold font-['Space_Grotesk'] tracking-tight flex items-center">
                <span className="text-white">Dost</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFB020] to-[#FFF5D9]">Wheels</span>
              </span>
            </div>
            
            <div className="inline-flex items-center gap-2 bg-[#FFB020]/10 border border-[#FFB020]/30 text-[#FFB020] text-xs font-semibold tracking-wide px-3.5 py-1.5 rounded-full mb-4 md:mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFB020] animate-pulse" />
              <span>Ride together, save together</span>
            </div>

            <h1 className="font-['Space_Grotesk'] font-bold text-2xl md:text-3xl lg:text-[40px] leading-[1.08] tracking-tight max-w-sm">
              Your dost is<br />
              <span className="text-[#FFB020]">on the way</span>
            </h1>
            
            <p className="text-white/65 text-xs md:text-sm leading-relaxed max-w-xs mt-4 hidden md:block">
              Share your bike commute with friends and save fuel, reduce traffic, and build community.
            </p>
          </div>

          <div className="relative z-10 mt-6 md:mt-0">
            {/* Stats strip */}
            <div className="hidden md:flex border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md bg-white/5 mb-6">
              {[
                { value: "12K+", label: "Riders" },
                { value: "48K+", label: "Rides shared" },
                { value: "₹2.4L", label: "Saved total" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`flex-1 p-4 text-left ${
                    i > 0 ? "border-l border-white/10" : ""
                  }`}
                >
                  <div className="font-['Space_Grotesk'] text-lg md:text-xl font-bold text-white leading-none">
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-white/50 font-medium tracking-wider uppercase mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Avatars row */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex">
                {["R", "S", "P", "D"].map((initial, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-[#14122B] -ml-2 first:ml-0 flex items-center justify-center text-xs font-bold text-[#14122B]"
                    style={{
                      background: "linear-gradient(135deg, #FFB020, #FF6B6B)",
                    }}
                  >
                    {initial}
                  </div>
                ))}
              </div>
              <span className="text-white/60 text-xs font-medium">+2.4k friends riding</span>
            </div>
          </div>
        </div>

        {/* FORM PANEL */}
        <div className="relative md:col-span-7 flex flex-col justify-center p-6 md:p-12 bg-card/90 dark:bg-card/45 backdrop-blur-md border-t md:border-t-0 md:border-l border-border/40">
          <div className="w-full max-w-md mx-auto">
            {/* Header */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-foreground tracking-tight">
                  {tab === "login" && "Welcome back 👋"}
                  {tab === "register" && "Join the crew 🚲"}
                  {tab === "confirm" && "Check your email 📧"}
                </h2>
                <p className="text-muted-foreground text-xs md:text-sm mt-1.5">
                  {tab === "login" && "Sign in to continue your ride journey"}
                  {tab === "register" && "Create your account and start pooling"}
                  {tab === "confirm" && `We sent a 6-digit code to ${pendingEmail}`}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground flex-shrink-0"
                title="Toggle theme"
              >
                {isDark ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 3a6.8 6.8 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-xs font-medium">
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* ── CONFIRM EMAIL FORM ─────────────────────────────── */}
            {tab === "confirm" ? (
              <div>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--secondary)" }}>
                    <Mail className="w-8 h-8" style={{ color: "var(--primary)" }} />
                  </div>
                </div>
                <form onSubmit={handleConfirm} className="space-y-4">
                  <div className="relative">
                    <input
                      id="confirm-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmCode}
                      onChange={(e) => { setConfirmCode(e.target.value.replace(/\D/g, "")); clearError(); }}
                      placeholder="Enter 6-digit code"
                      className="w-full text-center text-2xl font-bold tracking-[0.5em] px-4 py-4 rounded-xl border border-border bg-card text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || confirmCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 shadow-lg shadow-primary/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Verify & Sign In
                      </>
                    )}
                  </button>
                </form>
                <p className="text-center mt-5 text-xs text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown}
                    className="text-primary hover:underline font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {resendCooldown ? "Resend in 30s..." : "Resend code"}
                  </button>
                </p>
                <p className="text-center mt-3 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => { setTab("register"); clearError(); }}
                    className="text-primary hover:underline font-semibold cursor-pointer"
                  >
                    ← Back to sign up
                  </button>
                </p>
              </div>
            ) : (
              /* ── LOGIN / REGISTER FORM ──────────────────────────── */
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {tab === "register" && (
                    <FloatingInput
                      id="name"
                      label="Full name"
                      value={form.name}
                      onChange={(v) => { setForm({ ...form, name: v }); clearError(); }}
                    />
                  )}

                  <FloatingInput
                    id="emailOrPhone"
                    label="Email address"
                    type="email"
                    value={form.emailOrPhone}
                    onChange={(v) => { setForm({ ...form, emailOrPhone: v }); clearError(); }}
                  />

                  <div className="relative">
                    <FloatingInput
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(v) => { setForm({ ...form, password: v }); clearError(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Remember & Forgot Row */}
                  <div className="flex items-center justify-between text-xs py-1">
                    <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary focus:ring-primary/20 accent-primary"
                      />
                      Remember me
                    </label>
                    {tab === "login" && (
                      <button
                        type="button"
                        className="text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-75 shadow-lg shadow-primary/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        {tab === "login" ? "Sign In" : "Create Account"}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5 text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                  <div className="flex-1 h-px bg-border/80" />
                  <span>or</span>
                  <div className="flex-1 h-px bg-border/80" />
                </div>

                {/* Google sign-in */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl border border-border bg-card text-foreground text-xs md:text-sm font-semibold hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg width="17" height="17" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.997 8.997 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.97 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l3.01-2.33z" />
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .96 4.97l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                  </svg>
                  Continue with Google
                </button>

                <p className="text-center mt-6 text-xs text-muted-foreground">
                  {tab === "login" ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => { setTab(tab === "login" ? "register" : "login"); clearError(); }}
                    className="text-primary hover:underline font-bold cursor-pointer"
                  >
                    {tab === "login" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
