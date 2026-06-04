// ─────────────────────────────────────────────────────────────────────────────
// VIEWS: LoginPage
// Public-facing pages shown before authentication.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTokens, useTheme, useBreakpoint } from "../core/hooks.js";
import { DEMO_CREDENTIALS, loginWithGoogle } from "../core/api.js";
import { Btn, Card, Input, Label } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export function LoginPage({ onLogin }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const { isMobile } = useBreakpoint();

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const attempt = async () => {
    setError("");
    setLoading(true);
    try {
      await onLogin({ email, password });
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
      setLoading(false);
    }
  };

  const attemptGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Note: Google OAuth will redirect to callback URL
    } catch (err) {
      setError(err?.message || "Unable to sign in with Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: t.font, background: t.bg, color: t.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: isMobile ? "12px 16px" : "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2 }}>
          <I name={dark ? "sun" : "moon"} size={14} />
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: t.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 900, fontSize: 20, color: "#0f0f0e" }}>E</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0, color: t.text }}>EurekaNow</h1>
            <p style={{ fontSize: 13, color: t.text2, marginTop: 5 }}>Sign in to your workspace</p>
          </div>

          {/* Login form */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Label>Email address</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" type="email" autoFocus onKeyDown={(e) => e.key === "Enter" && attempt()} />
              </div>
              <div>
                <Label>Password</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={(e) => e.key === "Enter" && attempt()} />
              </div>
              {error && (
                <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>
                  {error}
                </div>
              )}
              <Btn variant="primary" onClick={attempt} disabled={!email || !password || loading} full>
                {loading ? "Signing in…" : "Sign in →"}
              </Btn>
              
              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 0" }}>
                <div style={{ flex: 1, height: "1px", background: t.border }} />
                <span style={{ fontSize: 11, color: t.text3, fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: "1px", background: t.border }} />
              </div>
              
              {/* Google Sign-In Button */}
              <button 
                onClick={attemptGoogle} 
                disabled={googleLoading}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: 8,
                  width: "100%",
                  padding: "10px 12px",
                  background: dark ? "#1f2937" : "#ffffff",
                  border: `1px solid ${dark ? "#4b5563" : "#e5e7eb"}`,
                  borderRadius: 8,
                  color: dark ? "#f3f4f6" : "#1f2937",
                  fontFamily: t.font,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: googleLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  opacity: googleLoading ? 0.7 : 1,
                  boxShadow: dark 
                    ? "0 1px 3px rgba(0,0,0,0.3)" 
                    : "0 1px 2px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  if (!googleLoading) {
                    e.target.style.boxShadow = dark 
                      ? "0 4px 12px rgba(0,0,0,0.4)" 
                      : "0 4px 12px rgba(0,0,0,0.1)";
                    e.target.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.boxShadow = dark 
                    ? "0 1px 3px rgba(0,0,0,0.3)" 
                    : "0 1px 2px rgba(0,0,0,0.05)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                <I name="google" size={14} />
                {googleLoading ? "Signing in…" : "Sign in with Google"}
              </button>
            </div>
          </Card>
          <div style={{ fontSize: 11, color: t.text3, textAlign: "center", lineHeight: 1.6 }}>
            Demo (no Supabase needed):<br />
            <span style={{ fontFamily: t.mono }}>{DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}</span>
            <br /><br />
            Supabase mode: run supabase/schema.sql, then sign in with<br />
            <span style={{ fontFamily: t.mono }}>admin@example.com / admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
