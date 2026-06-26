// ─────────────────────────────────────────────────────────────────────────────
// VIEWS: LandingPage · LoginPage
// Public-facing pages shown before authentication.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useTheme, useBreakpoint } from "../core/hooks.js";
import { loginWithGoogle } from "../core/api.js";
import { supabase } from "../core/supabase.js";
import { Btn, Card, Input, Label } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════

export function LandingPage({ onSignIn }) {
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
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.4px", color: t.text }}>EurekaNow</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2, display: "flex", padding: 6 }}>
            <I name={dark ? "sun" : "moon"} size={15} />
          </button>
          {!isMobile && <Btn variant="secondary" size="sm" onClick={onSignIn}>Sign in</Btn>}
          <Btn variant="primary" size="sm" onClick={onSignIn}>Get started</Btn>
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
          <span style={{ color: t.accent }}>adapts to every workflow.</span>
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 17, color: t.text2, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>
          One platform for IT, clinical ops, engineering, and HR. Sign in to your workspace and tailor it to your team.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn variant="secondary" size={isMobile ? "md" : "lg"} onClick={onSignIn}>Sign in</Btn>
          <Btn variant="primary" size={isMobile ? "md" : "lg"} onClick={onSignIn}>Open the app →</Btn>
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
          Sign in with your workspace account to continue.
        </p>
        <Btn variant="primary" size="lg" onClick={onSignIn}>Open the app →</Btn>
      </div>

      <footer style={{ borderTop: `1px solid ${t.border}`, padding: "16px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: t.text3 }}>© {new Date().getFullYear()} EurekaNow — Eureka Technologies Ltd</span>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export function LoginPage({ onLogin, onSignUp }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const { isMobile } = useBreakpoint();

  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    setError("");
    setLoading(false);
    setGoogleLoading(false);
  }, [mode]);

  const attempt = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        await onSignUp({
          fullName,
          email,
          password,
          organizationName,
          teamName,
          title,
        });
      } else {
        await onLogin({ email, password });
      }
    } catch (err) {
      setError(err?.message || (mode === "signup" ? "Unable to create account." : "Unable to sign in."));
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: "#0f0f0e" }}>E</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.4px", color: t.text }}>EurekaNow</span>
        </div>
        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2 }}>
          <I name={dark ? "sun" : "moon"} size={14} />
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: t.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 900, fontSize: 20, color: "#0f0f0e" }}>E</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0, color: t.text }}>EurekaNow</h1>
            <p style={{ fontSize: 13, color: t.text2, marginTop: 5 }}>
              {mode === "signup" ? "Create your workspace account" : "Sign in to your workspace"}
            </p>
          </div>

          <Card style={{ marginBottom: 16, boxShadow: dark ? "0 16px 40px rgba(0,0,0,0.25)" : "0 16px 40px rgba(15, 34, 58, 0.08)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 6, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 4 }}>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 9,
                    padding: "8px 12px",
                    background: mode === "signin" ? t.accent : "transparent",
                    color: mode === "signin" ? "#0f0f0e" : t.text2,
                    fontFamily: t.font,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 9,
                    padding: "8px 12px",
                    background: mode === "signup" ? t.accent : "transparent",
                    color: mode === "signup" ? "#0f0f0e" : t.text2,
                    fontFamily: t.font,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Sign up
                </button>
              </div>

              {mode === "signup" && (
                <>
                  <div>
                    <Label>Full name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Smith" autoFocus />
                  </div>
                  <div>
                    <Label>Organisation name</Label>
                    <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Acme Health" />
                  </div>
                </>
              )}

              <div>
                <Label>Email address</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" type="email" autoFocus={mode === "signin"} onKeyDown={(e) => e.key === "Enter" && attempt()} />
              </div>
              {mode === "signup" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <div>
                    <Label>Team name</Label>
                    <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="General" />
                  </div>
                  <div>
                    <Label>Job title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Service Desk Manager" />
                  </div>
                </div>
              )}
              <div>
                <Label>Password</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={(e) => e.key === "Enter" && attempt()} />
              </div>
              {mode === "signup" && (
                <div>
                  <Label>Confirm password</Label>
                  <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={(e) => e.key === "Enter" && attempt()} />
                </div>
              )}
              {error && (
                <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>
                  {error}
                </div>
              )}
              <Btn
                variant="primary"
                onClick={attempt}
                disabled={
                  loading ||
                  !email ||
                  !password ||
                  (mode === "signup" && (!fullName || !organizationName || !confirmPassword))
                }
                full
              >
                {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : (mode === "signup" ? "Create account →" : "Sign in →")}
              </Btn>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 0" }}>
                <div style={{ flex: 1, height: "1px", background: t.border }} />
                <span style={{ fontSize: 11, color: t.text3, fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: "1px", background: t.border }} />
              </div>

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
                    e.currentTarget.style.boxShadow = dark
                      ? "0 4px 12px rgba(0,0,0,0.4)"
                      : "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = dark
                    ? "0 1px 3px rgba(0,0,0,0.3)"
                    : "0 1px 2px rgba(0,0,0,0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <I name="google" size={14} />
                {googleLoading ? "Signing in…" : "Sign in with Google"}
              </button>
              <div style={{ fontSize: 11, color: t.text3, textAlign: "center", lineHeight: 1.6 }}>
                {mode === "signup"
                  ? "We will create your organization, team, and user profile after you submit."
                  : "Use your workspace email and password to continue."}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL CONFIRMATION PAGE
// Shown after sign-up when Supabase requires email verification.
// ═════════════════════════════════════════════════════════════════════════════

export function EmailConfirmationPage({ email, onBack }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const [resent,   setResent]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,    setError]    = useState("");

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendError) throw resendError;
      setResent(true);
    } catch (err) {
      setError(err?.message || "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ fontFamily: t.font, background: t.bg, color: t.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: t.text2, fontFamily: t.font, fontSize: 13 }}>
          <I name="back" size={13} /> Back to sign in
        </button>
        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2 }}>
          <I name={dark ? "sun" : "moon"} size={14} />
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: t.accentBg, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <I name="kb" size={24} style={{ color: t.accent }} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 10px", color: t.text }}>
            Check your inbox
          </h1>
          <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.7, margin: "0 0 28px" }}>
            We sent a confirmation link to <strong style={{ color: t.text }}>{email}</strong>.
            Click it to activate your account and sign in.
          </p>

          <Card style={{ textAlign: "left", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Check spam / junk", "If you don't see it in 2 minutes, check your spam folder."],
                ["Link expires in 24h", "The confirmation link is valid for 24 hours."],
                ["One click to activate", "After confirming, you'll be signed in automatically."],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <I name="check" size={11} style={{ color: t.accent }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 11, color: t.text2 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {error && (
            <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {resent ? (
            <div style={{ background: t.greenBg, border: `1px solid ${t.green}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: t.greenText, marginBottom: 12 }}>
              ✓ Confirmation email resent to {email}
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              style={{ background: "none", border: "none", cursor: resending ? "not-allowed" : "pointer", color: t.accent, fontSize: 12, fontFamily: t.font, opacity: resending ? 0.6 : 1 }}
            >
              {resending ? "Resending…" : "Didn't receive it? Resend confirmation email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
