// ─────────────────────────────────────────────────────────────────────────────
// VIEWS: LandingPage · LoginPage
// Public-facing pages shown before authentication.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTokens, useTheme, useBreakpoint } from "../core/hooks.js";
import { DEMO_CREDENTIALS } from "../core/api.js";
import { Btn, Card, Input, Label } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════

export function LandingPage({ onLogin }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const { isMobile } = useBreakpoint();

  const features = [
    { icon: "incident", label: "Incident Management", desc: "Track, triage and resolve incidents with SLA timers across all teams." },
    { icon: "request",  label: "Service Requests",    desc: "Standardised request workflows for access, hardware, software and onboarding." },
    { icon: "change",   label: "Change Control",      desc: "Manage change requests with priority, approval chains and impact tracking." },
    { icon: "teams",    label: "Teams & Orgs",        desc: "Multi-org, multi-team structure. Assign roles and route tickets automatically." },
    { icon: "kb",       label: "Knowledge Base",      desc: "Self-service articles reduce repeat tickets. Searchable and categorised." },
    { icon: "grid",     label: "Custom Dashboards",   desc: "Every user builds their own dashboard — choose which widgets matter to them." },
  ];

  return (
    <div style={{ fontFamily: t.font, background: t.bg, color: t.text, minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${t.border}`, padding: isMobile ? "0 16px" : "0 40px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: t.bg, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: "#0f0f0e" }}>E</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.4px", color: t.text }}>EureakNow</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2, display: "flex", padding: 6 }}>
            <I name={dark ? "sun" : "moon"} size={15} />
          </button>
          {!isMobile && <Btn variant="secondary" size="sm" onClick={onLogin}>Sign in</Btn>}
          <Btn variant="primary" size="sm" onClick={onLogin}>Get started</Btn>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: isMobile ? "48px 20px 40px" : "80px 40px 60px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: t.accentBg, border: `1px solid ${t.accent}44`, borderRadius: 99, padding: "4px 14px", marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.accent }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: t.accentText, letterSpacing: "0.08em" }}>SERVICE DESK PLATFORM</span>
        </div>
        <h1 style={{ fontSize: isMobile ? "clamp(28px,8vw,40px)" : "clamp(36px,5vw,64px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-1.5px", lineHeight: 1.1, color: t.text }}>
          The service desk that<br />
          <span style={{ color: t.accent }}>works for everyone.</span>
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 17, color: t.text2, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>
          IT, clinical ops, engineering, HR — one platform, customised for each person.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn variant="primary" size={isMobile ? "md" : "lg"} onClick={onLogin}>Start free trial →</Btn>
          <Btn variant="secondary" size={isMobile ? "md" : "lg"} onClick={onLogin}>View demo</Btn>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: isMobile ? "20px 16px" : "28px 40px", display: "flex", justifyContent: "center", gap: isMobile ? "20px" : "60px", flexWrap: "wrap" }}>
        {[["99.9%","Uptime SLA"],["< 2min","Avg. first response"],["5 types","Ticket categories"],["Multi-org","Teams & roles"]].map(([v, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: t.accent, letterSpacing: "-0.5px" }}>{v}</div>
            <div style={{ fontSize: 11, color: t.text2, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: isMobile ? "32px 16px" : "60px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: isMobile ? 22 : 28, fontWeight: 800, marginBottom: 28, letterSpacing: "-0.5px", color: t.text }}>
          Everything your team needs
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {features.map((f) => (
            <Card key={f.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", color: t.accent }}>
                  <I name={f.icon} size={14} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{f.label}</span>
              </div>
              <p style={{ fontSize: 12, color: t.text2, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", padding: isMobile ? "40px 20px" : "60px 40px", borderTop: `1px solid ${t.border}` }}>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, marginBottom: 12, color: t.text }}>Ready to try it?</h2>
        <p style={{ color: t.text2, marginBottom: 24, fontSize: 13 }}>
          Instant demo login: <span style={{ fontFamily: t.mono }}>{DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}</span>
        </p>
        <Btn variant="primary" size="lg" onClick={onLogin}>Open the app →</Btn>
      </div>

      <footer style={{ borderTop: `1px solid ${t.border}`, padding: "16px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: t.text3 }}>© 2025 EureakNow — Eureka Technologies Ltd</span>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export function LoginPage({ onLogin, onBack }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const { isMobile } = useBreakpoint();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

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

  return (
    <div style={{ fontFamily: t.font, background: t.bg, color: t.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: isMobile ? "12px 16px" : "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: t.text2, fontFamily: t.font, fontSize: 13 }}>
          <I name="back" size={13} /> Back
        </button>
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
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0, color: t.text }}>EureakNow</h1>
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
