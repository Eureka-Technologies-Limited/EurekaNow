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
import { loginWithEmailPassword, getUserFromSession } from "./core/api.js";
import { supabase } from "./core/supabase.js";
import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { LandingPage, LoginPage } from "./views/PublicPages.jsx";
import { AppShell } from "./layout/AppShell.jsx";

function Root() {
  const [page,        setPage]        = useState("landing"); // "landing" | "login" | "app"
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady,   setAuthReady]   = useState(false);
  const t = useTokens();

  // Restore an existing auth session and react to Google OAuth redirects.
  useEffect(() => {
    let alive = true;

    const finishAuth = (session) => {
      try {
        if (session?.user) {
          getUserFromSession(session)
            .then((user) => {
              if (alive) {
                setCurrentUser(user);
                setPage("app");
              }
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.debug("Failed to get user from session:", err.message);
            });
        }
      } catch (err) {
        if (alive) {
          // eslint-disable-next-line no-console
          console.debug("Auth session not available:", err.message);
        }
      } finally {
        if (alive) {
          if (window.location.pathname !== "/" || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.origin + "/");
          }
          setAuthReady(true);
        }
      }
    };

    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          // eslint-disable-next-line no-console
          console.debug("Unable to read auth session:", error.message);
        }
        finishAuth(data?.session || null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug("Bootstrap error:", err.message);
        if (alive) {
          setAuthReady(true);
        }
      }
    };

    bootstrapSession();

    try {
      const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
        finishAuth(session);
      });

      return () => {
        alive = false;
        authSubscription.data?.subscription?.unsubscribe();
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("Auth subscription setup error:", err.message);
      return () => {
        alive = false;
      };
    }
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
    const user = await loginWithEmailPassword(email, password);
    setCurrentUser(user);
    setPage("app");
  };

  const handleLogout = ()     => { setCurrentUser(null); setPage("landing"); };

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

        {!authReady && (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: t.text2, fontFamily: t.font }}>
            Loading…
          </div>
        )}
        {authReady && page === "landing" && <LandingPage onLogin={() => setPage("login")} />}
        {authReady && page === "login"   && <LoginPage   onLogin={handleLogin} onBack={() => setPage("landing")} />}
        {authReady && page === "app"     && currentUser  && <AppShell currentUser={currentUser} onLogout={handleLogout} />}
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
