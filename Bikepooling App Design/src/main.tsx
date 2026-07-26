import { createRoot } from "react-dom/client";
import { Component, type ReactNode, type ErrorInfo } from "react";
import "./lib/aws-config"; // ← Initialize Amplify before anything else
import App from "./app/App.tsx";
import "./styles/index.css";

// ─── Global Error Boundary ────────────────────────────────────────────
// Catches any unhandled React render errors and shows a recovery screen
// instead of a blank white page (which is the default when no boundary exists).
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: "" });
    // Force a full reload so Capacitor / Amplify can re-initialise cleanly
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#F3F2F8",
            fontFamily: "'Inter', sans-serif",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: 48 }}>🛠️</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#14122B", margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#6B7280", maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
            The app ran into an unexpected error. Tap below to reload.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <p
              style={{
                fontSize: "0.75rem",
                background: "#1B1836",
                color: "#e2e8f0",
                padding: "10px 16px",
                borderRadius: 12,
                maxWidth: 320,
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {this.state.error}
            </p>
          )}
          <button
            onClick={this.handleReload}
            style={{
              background: "#2E5BFF",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "12px 32px",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Mount ────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);