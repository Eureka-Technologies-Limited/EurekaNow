// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — App.jsx (Entry Point)
//
// File structure:
//   src/
//     core/
//       constants.js   — PRIORITIES, STATUSES, TICKET_TYPES, etc.
//       utils.js       — uid, fmtTs, sla helpers
//       hooks.js       — useBreakpoint, ThemeProvider, useTheme, useTokens
//       icons.jsx      — icon map + <I> component
//       api.js         — Supabase-backed data and auth functions
//     ui/
//       primitives.jsx — Avatar, Badge, Btn, Input, Sel, Card, Label, SLABar, Modal
//                        PriorityBadge, StatusBadge, TypeBadge
//     widgets/
//       registry.js         — ALL_WIDGETS, DEFAULT_LAYOUT
//       StatWidget.jsx       — stat card (open, mine, critical, etc.)
//       BarChart.jsx         — ByStatusChart, ByPriorityChart, ByTypeChart
//       RecentTickets.jsx    — recent tickets list widget
//       ActivityWidgets.jsx  — CriticalList, SLARisk, MyTickets, KBRecent
//       DashWidget.jsx       — widget router (maps id → component)
//       DashboardView.jsx    — grid layout + DashCustomiser modal
//     views/
//       TicketListView.jsx   — shared ticket list (mobile cards / desktop table)
//       TicketDetailPanel.jsx— slide-over / full-screen ticket detail
//       NewTicketModal.jsx   — new ticket creation form
//       TeamsView.jsx        — org/team management
//       KBView.jsx           — knowledge base
//       PublicPages.jsx      — LandingPage + LoginPage
//     layout/
//       AppShell.jsx         — DesktopSidebar, MobileNav, Topbar, AppShell
//     App.jsx                — ThemeProvider + page router (this file)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { ThemeProvider, useTokens } from "./core/hooks.js";
import { loginWithEmailPassword, registerWithEmailPassword, getUserFromSession } from "./core/api.js";
import { supabase } from "./core/supabase.js";
import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { LoginPage, EmailConfirmationPage } from "./views/PublicPages.jsx";
import { AppShell } from "./layout/AppShell.jsx";

function Root() {
  const [page,         setPage]         = useState("login"); // "login"|"confirm-email"|"app"
  const [currentUser,  setCurrentUser]  = useState(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const t = useTokens();

  // On mount: restore any persisted Supabase session (handles page refresh).
  // Also subscribes to auth changes for OAuth callbacks and token expiry.
  useEffect(() => {
    let alive = true;

    // Bootstrap: check for an existing persisted session.
    // Runs silently — login page is already visible while this resolves.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive || !data?.session?.user) return;
      try {
        const user = await getUserFromSession(data.session);
        if (alive && user) {
          setCurrentUser(user);
          setPage("app");
          // Clean up any OAuth redirect hash
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.origin + "/");
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug("Session restore error:", err.message);
      }
    });

    // Subscribe to future auth events (OAuth redirect, token refresh, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (alive) {
          setCurrentUser(null);
          setPage((prev) => (prev === "app" ? "login" : prev));
        }
        return;
      }
      // Only handle here for OAuth/token-refresh cases.
      // Normal email/password login is handled directly in handleLogin below.
      getUserFromSession(session)
        .then((user) => {
          if (alive && user) {
            setCurrentUser(user);
            setPage("app");
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.debug("onAuthStateChange user lookup error:", err.message);
        });
    });

    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sync body background with the active theme
  useEffect(() => {
    document.body.style.margin     = "0";
    document.body.style.padding    = "0";
    document.body.style.background = t.bg;
    document.body.style.color      = t.text;
    document.documentElement.style.colorScheme = t.dark ? "dark" : "light";
  }, [t.bg, t.text, t.dark]);

  const handleLogin = async ({ email, password }) => {
    // loginWithEmailPassword returns the resolved app user on success.
    // We set state directly here — don't rely solely on onAuthStateChange
    // since that callback can fail silently if the DB lookup errors.
    const user = await loginWithEmailPassword(email, password);
    if (user) {
      setCurrentUser(user);
      setPage("app");
    }
  };

  const handleSignup = async (payload) => {
    const result = await registerWithEmailPassword(payload);
    if (result?.requiresEmailConfirmation) {
      setConfirmEmail(result.email);
      setPage("confirm-email");
      return;
    }
    // Auto-confirmed (email confirmation disabled in Supabase) →
    // onAuthStateChange fires and calls finishAuth automatically.
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    setCurrentUser(null);
    setPage("login");
  };

  try {
    return (
      <div style={{ width: "100%", background: t.bg, minHeight: "100vh" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body { margin: 0; padding: 0; overscroll-behavior: none; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-thumb { background: #3a3835; border-radius: 99px; }
          button { -webkit-tap-highlight-color: transparent; }
          input, textarea, select { -webkit-appearance: none; }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
          @media (max-width: 767px) {
            input, textarea, select { font-size: 16px !important; }
          }
        `}</style>

        {page === "login"         && <LoginPage onLogin={handleLogin} onSignUp={handleSignup} />}
        {page === "confirm-email" && <EmailConfirmationPage email={confirmEmail} onBack={() => setPage("login")} />}
        {page === "app"           && currentUser && <AppShell currentUser={currentUser} onLogout={handleLogout} />}
      </div>
    );
  } catch (err) {
    return (
      <div style={{ background: "#0b1a30", color: "#fff", padding: 20, fontFamily: "monospace", minHeight: "100vh" }}>
        <h2>Error in Root component:</h2>
        <pre>{err?.message}</pre>
        <pre>{err?.stack}</pre>
      </div>
    );
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
