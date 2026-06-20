// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: DesktopSidebar · MobileNav · Topbar · AppShell
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useTokens, useTheme, useBreakpoint } from "../core/hooks.js";
import { VIEW_LABELS, VIEW_TO_TYPE, PRIORITIES, DEFAULT_URGENCIES } from "../core/constants.js";
import {
  createArticle,
  createCatalogItem,
  createMember,
  createOrganisation,
  createApproval,
  updateCatalogItem,
  updateOrgPlan,
  createTeamRole,
  createTeam,
  createTicket,
  createTicketComment,
  createClosingTemplate,
  updateClosingTemplate,
  updateArticle,
  deleteClosingTemplate,
  fetchAppData,
  incrementArticleViews,
  savePostIncidentReview,
  updateMemberRoles,
  resolveApproval,
  upsertOrgSettings,
  upsertTeamSettings,
  upsertPirFieldConfig,
  updateTicketFields,
  fetchOrgInvitationsForUser,
  fetchUserOrgIds,
  acceptOrgInvitation,
  declineOrgInvitation,
} from "../core/api.js";
import { Avatar, Btn, Modal } from "../ui/primitives.jsx";
import { canDo, slaForPriority, slaPct } from "../core/utils.js";
import { I } from "../core/icons.jsx";
import { ToastContainer, useToasts } from "../ui/Toast.jsx";
import { UpgradeGate, PlansModal, PlanBadge } from "../ui/UpgradeGate.jsx";
import { normalizePlan, canFeature, subscribeToTicketUpdates, subscribeToTicketComments, subscribeToApprovals } from "../core/subscriptions.js";
import { DEFAULT_LAYOUT } from "../widgets/registry.js";
import { DashboardView, DashCustomiser } from "../widgets/DashboardView.jsx";
import { TicketListView }   from "../views/TicketListView.jsx";
import { TicketDetailPanel } from "../views/TicketDetailPanel.jsx";
import { NewTicketModal }   from "../views/NewTicketModal.jsx";
import { ServiceCatalogView, ApprovalsView } from "../views/ServiceNowViews.jsx";
import { TeamsView }        from "../views/TeamsView.jsx";
import { KBView }           from "../views/KBView.jsx";
import { KanbanView }       from "../views/KanbanView.jsx";
import { ReportsView }      from "../views/ReportsView.jsx";
import { ProfileView }      from "../views/ProfileView.jsx";
import { CommandPalette }  from "../ui/CommandPalette.jsx";
import { OnboardingTutorial, useOnboardingStatus } from "../ui/OnboardingTutorial.jsx";

const SIDEBAR_PREFS_KEY = (userId) => `sidebar_prefs_${userId || "global"}`;
const NOTIF_PREFS_KEY  = (userId) => `notif_prefs_${userId || "global"}`;
const NOTIF_READ_KEY   = (userId) => `notifs_read_${userId || "global"}`;
const SHELL_PREFS_KEY  = (userId) => `shell_prefs_${userId || "global"}`;
const DASH_LAYOUT_KEY  = (userId) => `dash_layout_${userId || "global"}`;
const DASH_SIZES_KEY   = (userId) => `dash_sizes_${userId || "global"}`;
const DEFAULT_SIDEBAR_ITEMS = ["dashboard", "incidents", "requests", "catalog", "approvals", "changes", "problems", "tasks", "all_tickets", "kanban", "teams", "kb", "reports", "profile"];
const DEFAULT_NOTIF_PREFS = { slaBreaches: true, slaRisk: true, newAssignments: true, comments: true };
const DEFAULT_SHELL_PREFS = { defaultView: "dashboard", restoreLastView: true, sidebarOpen: true, lastView: "dashboard" };

function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadShellPrefs(userId) {
  return { ...DEFAULT_SHELL_PREFS, ...safeParseJSON(localStorage.getItem(SHELL_PREFS_KEY(userId)), {}) };
}

function saveShellPrefs(userId, prefs) {
  try {
    localStorage.setItem(SHELL_PREFS_KEY(userId), JSON.stringify(prefs));
  } catch {}
}

function loadDashLayout(userId) {
  const raw = safeParseJSON(localStorage.getItem(DASH_LAYOUT_KEY(userId)), null);
  return Array.isArray(raw) && raw.length ? raw : DEFAULT_LAYOUT;
}

function saveDashLayout(userId, layout) {
  try {
    localStorage.setItem(DASH_LAYOUT_KEY(userId), JSON.stringify(layout));
  } catch {}
}

function loadDashSizes(userId) {
  const raw = safeParseJSON(localStorage.getItem(DASH_SIZES_KEY(userId)), {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function saveDashSizes(userId, sizes) {
  try {
    localStorage.setItem(DASH_SIZES_KEY(userId), JSON.stringify(sizes));
  } catch {}
}

function loadSidebarPrefs(userId) {
  try {
    const raw = localStorage.getItem(SIDEBAR_PREFS_KEY(userId));
    if (!raw) return DEFAULT_SIDEBAR_ITEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SIDEBAR_ITEMS;
    const allowed = new Set(DEFAULT_SIDEBAR_ITEMS);
    return parsed.filter((id) => allowed.has(id));
  } catch {
    return DEFAULT_SIDEBAR_ITEMS;
  }
}

function saveSidebarPrefs(userId, items) {
  try {
    localStorage.setItem(SIDEBAR_PREFS_KEY(userId), JSON.stringify(items));
  } catch {}
}

function userHasRole(user, roleName) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean);
  return roles.some((role) => String(role).toLowerCase() === String(roleName).toLowerCase());
}

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

export function DesktopSidebar({ view, setView, open, onToggle, currentUser, tickets, onLogout, visibleNavItems = DEFAULT_SIDEBAR_ITEMS, onCustomizeSidebar, plan = "Free", onShowPlans }) {
    const currentUserRoles = Array.isArray(currentUser.roles) && currentUser.roles.length
      ? currentUser.roles
      : [currentUser.role].filter(Boolean);
    const currentRoleSummary = currentUserRoles.length > 1
      ? `${currentUserRoles[0]} +${currentUserRoles.length - 1}`
      : (currentUserRoles[0] || "Member");

  const t = useTokens();
  const { dark, toggle } = useTheme();

  const openCount = tickets.filter((tk) => !["Resolved","Closed"].includes(tk.status)).length;

  const FREE_LOCKED = new Set(["kanban", "kb", "reports"]);
  const lockedForPlan = (id) => normalizePlan(plan) === "Free" && FREE_LOCKED.has(id);

  const navItems = [
    { id: "dashboard",   label: "Dashboard",       icon: "grid" },
    { id: "incidents",   label: "Incidents",        icon: "incident",
      count: tickets.filter((tk) => tk.type === "Incident" && !["Resolved","Closed"].includes(tk.status)).length,
      alert: tickets.some((tk) => tk.type === "Incident" && tk.priority === "Critical" && !["Resolved","Closed"].includes(tk.status)) },
    { id: "requests",    label: "Requests",         icon: "request",
      count: tickets.filter((tk) => tk.type === "Service Request" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "catalog",     label: "Service Catalog",  icon: "clipboard" },
    { id: "approvals",   label: "Approvals",        icon: "check" },
    { id: "changes",     label: "Changes",          icon: "change",
      count: tickets.filter((tk) => tk.type === "Change Request" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "problems",    label: "Problems",         icon: "problem",
      count: tickets.filter((tk) => tk.type === "Problem" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "tasks",       label: "Tasks",            icon: "task",
      count: tickets.filter((tk) => tk.type === "Task" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "all_tickets", label: "All Tickets",      icon: "ticket", count: openCount },
    { id: "kanban",      label: "Kanban Board",     icon: "kanban" },
    { id: "teams",       label: "Teams & Orgs",     icon: "teams" },
    { id: "kb",          label: "Knowledge Base",   icon: "kb"    },
    { id: "reports",     label: "Reports",          icon: "chart" },
    { id: "profile",     label: "My Profile",       icon: "user-circle" },
  ].filter((item) => visibleNavItems.includes(item.id));

  return (
    <aside style={{
      width: open ? 218 : 50, flexShrink: 0,
      background: dark ? "#0a0a09" : t.surface,
      borderRight: `1px solid ${t.border}`,
      display: "flex", flexDirection: "column",
      transition: "width 0.2s ease", overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: open ? "14px 14px" : "14px 9px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div style={{ width: 27, height: 27, borderRadius: 8, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontWeight: 900, fontSize: 13, color: "#0a0a09" }}>E</span>
        </div>
        {open && <span style={{ fontWeight: 800, fontSize: 14, color: t.text, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>EurekaNow</span>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 5px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
        {navItems.map((item) => {
          const active = view === item.id;
          const locked = lockedForPlan(item.id);
          return (
            <div key={item.id}>
              {item.id === "teams" && <div style={{ height: 1, background: t.border, margin: "7px 3px" }} />}
              <button
                onClick={() => setView(item.id)}
                title={!open ? (locked ? `${item.label} — Basic plan required` : item.label) : ""}
                style={{
                  background: active ? t.accentBg : "none",
                  border: `1px solid ${active ? t.accent + "44" : "transparent"}`,
                  borderRadius: 8, padding: open ? "8px 10px" : "8px 0",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  color: active ? t.accentText : locked ? t.text3 : t.text2,
                  width: "100%", justifyContent: open ? "flex-start" : "center",
                  fontFamily: t.font, transition: "background .1s",
                }}
              >
                <span style={{ flexShrink: 0 }}><I name={item.icon} size={14} /></span>
                {open && <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{item.label}</span>}
                {open && !locked && item.count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 99, background: item.alert ? t.red : t.surface3, color: item.alert ? "#fff" : t.text3 }}>
                    {item.count}
                  </span>
                )}
                {open && locked && (
                  <span style={{ color: t.text3, display: "flex", alignItems: "center" }}>
                    <I name="lock" size={10} />
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "9px 5px", borderTop: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 2 }}>
        {open && (
          <button
            onClick={onShowPlans}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: t.text2, padding: "7px 10px", borderRadius: 8, width: "100%", justifyContent: "flex-start", fontFamily: t.font }}
          >
            <I name="zap" size={13} />
            <span style={{ fontSize: 12, flex: 1, textAlign: "left" }}>Plans &amp; Billing</span>
            <PlanBadge plan={plan} />
          </button>
        )}
        {open && (
          <button
            onClick={onCustomizeSidebar}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: t.text2, padding: "7px 10px", borderRadius: 8, width: "100%", justifyContent: "flex-start", fontFamily: t.font }}
          >
            <I name="settings" size={13} />
            <span style={{ fontSize: 12 }}>Customize sidebar</span>
          </button>
        )}
        <button
          onClick={toggle}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: t.text2, padding: open ? "7px 10px" : "7px 0", borderRadius: 8, width: "100%", justifyContent: open ? "flex-start" : "center", fontFamily: t.font }}
        >
          <I name={dark ? "sun" : "moon"} size={13} />
          {open && <span style={{ fontSize: 12 }}>{dark ? "Light mode" : "Dark mode"}</span>}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: open ? "7px 10px" : "7px 0", borderRadius: 8, width: "100%", justifyContent: open ? "flex-start" : "center" }}>
          <Avatar name={currentUser.name} size={22} fs={8} />
          {open && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <div style={{ fontSize: 9, color: t.text3 }}>{currentRoleSummary}</div>
            </div>
          )}
          {open && (
            <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", color: t.text3 }}>
              <I name="logout" size={12} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE NAV — bottom tab bar + "More" drawer
// ═════════════════════════════════════════════════════════════════════════════

export function MobileNav({ view, setView, currentUser, tickets, onLogout, onNewTicket, visibleNavItems = DEFAULT_SIDEBAR_ITEMS, onCustomizeSidebar }) {
    const currentUserRoles = Array.isArray(currentUser.roles) && currentUser.roles.length
      ? currentUser.roles
      : [currentUser.role].filter(Boolean);
    const currentRoleSummary = currentUserRoles.length > 1
      ? `${currentUserRoles[0]} +${currentUserRoles.length - 1}`
      : (currentUserRoles[0] || "Member");

  const t = useTokens();
  const { dark, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tabs = [
    { id: "dashboard",   icon: "grid",     label: "Home" },
    { id: "incidents",   icon: "incident", label: "Incidents",
      alert: tickets.some((tk) => tk.type === "Incident" && tk.priority === "Critical" && !["Resolved","Closed"].includes(tk.status)) },
    { id: "all_tickets", icon: "ticket",   label: "Tickets",
      count: tickets.filter((tk) => !["Resolved","Closed"].includes(tk.status)).length },
    { id: "kb",          icon: "kb",       label: "KB" },
  ].filter((tab) => visibleNavItems.includes(tab.id));

  const drawerItems = [
    { id: "requests", label: "Service Requests",   icon: "request"     },
    { id: "catalog",  label: "Service Catalog",    icon: "clipboard"   },
    { id: "approvals",label: "Approvals",          icon: "check"       },
    { id: "changes",  label: "Change Requests",    icon: "change"      },
    { id: "problems", label: "Problems",           icon: "problem"     },
    { id: "tasks",    label: "Tasks",              icon: "task"        },
    { id: "teams",    label: "Teams & Orgs",       icon: "teams"       },
    { id: "reports",  label: "Reports & Analytics",icon: "chart"       },
    { id: "profile",  label: "My Profile",         icon: "user-circle" },
  ].filter((item) => visibleNavItems.includes(item.id));

  if (drawerItems.length > 0 && !tabs.some((tab) => tab.id === "__more")) {
    tabs.push({ id: "__more", icon: "more", label: "More" });
  }

  return (
    <>
      {/* Drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }}
        >
          <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                bottom: 64,
                left: 0,
                right: 0,
                background: t.surface,
                borderTop: `1px solid ${t.border}`,
                borderRadius: "20px 20px 0 0",
                padding: "12px 12px",
                boxSizing: "border-box",
                maxHeight: "calc(100vh - 64px - env(safe-area-inset-top,0px))",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 8px)",
              }}
            >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: t.border2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, wordBreak: "break-word" }}>
              {drawerItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id); setDrawerOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: view === item.id ? t.accentBg : "none", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: t.font, color: view === item.id ? t.accentText : t.text2 }}
                >
                  <I name={item.icon} size={18} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                </button>
              ))}
              <div style={{ height: 1, background: t.border, margin: "8px 0" }} />
              <button onClick={() => { setDrawerOpen(false); onCustomizeSidebar?.(); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: t.font, color: t.text2 }}>
                <I name="settings" size={18} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Customize sidebar</span>
              </button>
              <button onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: t.font, color: t.text2 }}>
                <I name={dark ? "sun" : "moon"} size={18} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{dark ? "Light mode" : "Dark mode"}</span>
              </button>
              <button onClick={() => { setDrawerOpen(false); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: t.font, color: t.redText }}>
                <I name="logout" size={18} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Sign out</span>
              </button>
            </div>
            {/* Current user */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 6px", borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
              <Avatar name={currentUser.name} size={32} fs={11} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{currentUser.name}</div>
                <div style={{ fontSize: 11, color: t.text3 }}>{currentRoleSummary} · {currentUser.email}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={onNewTicket}
        style={{ position: "fixed", bottom: 80, right: 18, width: 52, height: 52, borderRadius: "50%", background: t.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 100, color: "#0f0f0e" }}
      >
        <I name="plus" size={22} />
      </button>

      {/* Tab bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.border}`, display: "flex", zIndex: 150, paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
        {tabs.map((tab) => {
          const active = tab.id === "__more" ? drawerOpen : view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => tab.id === "__more" ? setDrawerOpen((d) => !d) : setView(tab.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", fontFamily: t.font, position: "relative" }}
            >
              <span style={{ color: active ? t.accent : t.text3, position: "relative" }}>
                <I name={tab.icon} size={20} />
                {tab.alert && <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: t.red, border: `1.5px solid ${t.surface}` }} />}
                {!tab.alert && tab.count > 0 && <span style={{ position: "absolute", top: -4, right: -6, fontSize: 8, fontWeight: 800, background: t.red, color: "#fff", borderRadius: 99, padding: "1px 4px", minWidth: 14, textAlign: "center" }}>{tab.count > 99 ? "99+" : tab.count}</span>}
              </span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? t.accent : t.text3, marginTop: 3 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═════════════════════════════════════════════════════════════════════════════

function relTime(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const NOTIF_STYLES = {
  sla_breach:  { icon: "incident",  colorKey: "red"    },
  sla_risk:    { icon: "clock",     colorKey: "orange"  },
  assigned:    { icon: "ticket",    colorKey: "blue"    },
  comment:     { icon: "send",      colorKey: "purple"  },
  invitation:  { icon: "teams",     colorKey: "green"   },
};

export function Topbar({ onToggle, view, tickets, onNewTicket, isMobile, notifications = [], unreadCount = 0, notifReadIds = new Set(), onMarkRead, onMarkAllRead, onOpenTicket, onOpenCommandPalette, currentUser, orgs = [], teams = [], selectedOrgId, selectedTeamId, onSelectOrg, onSelectTeam, onAcceptInvitation, onDeclineInvitation }) {
  const t = useTokens();
  const [notifOpen, setNotifOpen] = useState(false);
  const [orgTeamOpen, setOrgTeamOpen] = useState(false);
  const bellRef     = useRef(null);
  const dropdownRef = useRef(null);
  const orgTeamRef = useRef(null);
  const orgTeamBtnRef = useRef(null);

  const activeOrg = orgs.find((o) => o.id === selectedOrgId);
  const activeTeam = teams.find((tm) => tm.id === selectedTeamId && tm.orgId === selectedOrgId);
  const orgTeams = teams.filter((tm) => tm.orgId === selectedOrgId);

  const critCount = tickets.filter((tk) => tk.priority === "Critical" && !["Resolved","Closed"].includes(tk.status)).length;

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen && !orgTeamOpen) return;
    const handler = (e) => {
      if (notifOpen &&
        bellRef.current     && !bellRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setNotifOpen(false);
      
      if (orgTeamOpen &&
        orgTeamBtnRef.current && !orgTeamBtnRef.current.contains(e.target) &&
        orgTeamRef.current    && !orgTeamRef.current.contains(e.target)
      ) setOrgTeamOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, orgTeamOpen]);

  return (
    <header style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, height: 52, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0, position: "relative", zIndex: 50 }}>
      {!isMobile && (
        <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2, display: "flex" }}>
          <I name="menu" size={17} />
        </button>
      )}

      {/* Org/Team Selector */}
      {!isMobile && orgs.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            ref={orgTeamBtnRef}
            onClick={() => setOrgTeamOpen((o) => !o)}
            title={`${activeOrg?.name || "Org"} / ${activeTeam?.name || "Team"}`}
            style={{
              background: orgTeamOpen ? t.accentBg : t.surface2,
              border: `1px solid ${orgTeamOpen ? t.accent + "44" : t.border}`,
              borderRadius: 8,
              cursor: "pointer",
              color: t.text2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontFamily: t.font,
              fontSize: 12,
              fontWeight: 500,
              maxWidth: 220,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            <I name="org" size={14} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeOrg?.name || "—"} / {activeTeam?.name || "—"}
            </span>
            <I name="chevron-down" size={12} />
          </button>

          {orgTeamOpen && (
            <div
              ref={orgTeamRef}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                width: 320,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              {/* Organization Select */}
              <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Organization</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        onSelectOrg?.(org.id);
                        const firstTeam = teams.find((t) => t.orgId === org.id);
                        if (firstTeam) onSelectTeam?.(firstTeam.id);
                        setOrgTeamOpen(false);
                      }}
                      style={{
                        background: selectedOrgId === org.id ? t.accentBg : "transparent",
                        border: `1px solid ${selectedOrgId === org.id ? t.accent + "44" : "transparent"}`,
                        borderRadius: 6,
                        padding: "8px 10px",
                        cursor: "pointer",
                        fontFamily: t.font,
                        color: selectedOrgId === org.id ? t.accentText : t.text2,
                        fontSize: 12,
                        fontWeight: selectedOrgId === org.id ? 600 : 400,
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Select */}
              {orgTeams.length > 0 && (
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Team</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
                    {orgTeams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          onSelectTeam?.(team.id);
                          setOrgTeamOpen(false);
                        }}
                        style={{
                          background: selectedTeamId === team.id ? t.accentBg : "transparent",
                          border: `1px solid ${selectedTeamId === team.id ? t.accent + "44" : "transparent"}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontFamily: t.font,
                          color: selectedTeamId === team.id ? t.accentText : t.text2,
                          fontSize: 12,
                          fontWeight: selectedTeamId === team.id ? 600 : 400,
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <span style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: 1 }}>
        {VIEW_LABELS[view] || view}
      </span>
      {critCount > 0 && !isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 7, padding: "4px 10px" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.red, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: t.redText }}>{critCount} critical</span>
        </div>
      )}

      {/* Command palette trigger */}
      <button
        onClick={onOpenCommandPalette}
        title="Search (Ctrl+K)"
        style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 8, cursor: "pointer", color: t.text2, display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", fontFamily: t.font }}
      >
        <I name="search" size={14} />
        {!isMobile && <span style={{ fontSize: 10, color: t.text3, fontFamily: t.mono }}>Ctrl+K</span>}
      </button>

      {/* Notification bell */}
      <div style={{ position: "relative" }}>
        <button
          ref={bellRef}
          onClick={() => setNotifOpen((o) => !o)}
          title="Notifications"
          style={{ background: notifOpen ? t.accentBg : "none", border: `1px solid ${notifOpen ? t.accent + "44" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: unreadCount > 0 ? t.accent : t.text2, display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, position: "relative" }}
        >
          <I name="bell" size={16} />
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: t.red, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${t.surface}` }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            ref={dropdownRef}
            style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.25)", zIndex: 200, overflow: "hidden" }}
          >
            {/* Dropdown header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} style={{ fontSize: 11, color: t.text3, background: "none", border: "none", cursor: "pointer", fontFamily: t.font, padding: "2px 6px", borderRadius: 6 }}>
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: t.text3, fontSize: 12 }}>
                  <I name="bell" size={24} />
                  <div style={{ marginTop: 8 }}>You're all caught up!</div>
                </div>
              ) : (
                notifications.map((n) => {
                  const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.assigned;
                  const color = t[style.colorKey] || t.accent;
                  const isRead = notifReadIds.has(n.id);
                  const isInvite = n.type === "invitation";
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!isInvite) { onMarkRead(n.id); if (n.ticketId && onOpenTicket) { setNotifOpen(false); onOpenTicket(tickets.find((tk) => tk.id === n.ticketId)); } } }}
                      style={{ display: "flex", gap: 10, padding: "10px 14px", cursor: isInvite ? "default" : "pointer", borderBottom: `1px solid ${t.border}`, background: isRead ? "transparent" : t.accentBg + "44", transition: "background 0.1s" }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, marginTop: 2 }}>
                        <I name={style.icon} size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: isRead ? 500 : 700, color: t.text, lineHeight: 1.3 }}>{n.title}</span>
                          {!isRead && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.accent, flexShrink: 0, marginTop: 4 }} />}
                        </div>
                        <div style={{ fontSize: 11, color: t.text3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: t.text3, marginTop: 3 }}>{relTime(n.time)}</div>
                        {isInvite && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAcceptInvitation?.(n.invitationId); }}
                              style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "none", background: t.accent, color: "#fff", cursor: "pointer", fontFamily: t.font }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeclineInvitation?.(n.invitationId); }}
                              style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.surface2, color: t.text2, cursor: "pointer", fontFamily: t.font }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {!isMobile && (
        <Btn variant="primary" size="sm" onClick={onNewTicket}>
          <I name="plus" size={12} /> New Ticket
        </Btn>
      )}
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// APP SHELL — authenticated wrapper, owns all app-level state
// ═════════════════════════════════════════════════════════════════════════════

export function AppShell({ currentUser, onLogout }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  const [orgs,         setOrgs]         = useState([]);
  const [teams,        setTeams]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [tickets,      setTickets]      = useState([]);
  const [articles,     setArticles]     = useState([]);
  const [orgSettings,  setOrgSettings]  = useState([]);
  const [teamSettings, setTeamSettings] = useState([]);
  const [teamRoles,    setTeamRoles]    = useState([]);
  const [postReviews,  setPostReviews]  = useState([]);
  const [closingTemplates, setClosingTemplates] = useState([]);
  const [pirFieldConfigs,  setPirFieldConfigs]  = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [approvals,    setApprovals]    = useState([]);
  const [orgInvitations, setOrgInvitations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [shellPrefs,   setShellPrefs]   = useState(() => loadShellPrefs(currentUser?.id));
  const [view,         setView]         = useState(() => {
    const prefs = loadShellPrefs(currentUser?.id);
    return prefs.restoreLastView ? (prefs.lastView || prefs.defaultView || "dashboard") : (prefs.defaultView || "dashboard");
  });
  const [sidebarItems, setSidebarItems] = useState(() => loadSidebarPrefs(currentUser?.id));
  const [showSidebarPrefs, setShowSidebarPrefs] = useState(false);
  const [showPlansModal,   setShowPlansModal]   = useState(false);
  const [modal,        setModal]        = useState(null);   // "detail" | "new" | "customise"
  const [activeTicket, setActiveTicket] = useState(null);
  const [dashLayout,   setDashLayout]   = useState(() => loadDashLayout(currentUser?.id));
  const [dashSizes,    setDashSizes]    = useState(() => loadDashSizes(currentUser?.id));
  const [defaultType,  setDefaultType]  = useState(null);
  const [cmdOpen,      setCmdOpen]      = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { toasts, addToast, dismiss } = useToasts();
  const { isCompleted: isTutorialCompleted } = useOnboardingStatus(currentUser?.id);
  const slaToastShown = useRef(false);

  // ── Notification state ────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY(currentUser?.id))) }; }
    catch { return DEFAULT_NOTIF_PREFS; }
  });
  const [notifReadIds, setNotifReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY(currentUser?.id))) || []); }
    catch { return new Set(); }
  });

  useEffect(() => {
    const nextPrefs = loadShellPrefs(currentUser?.id);
    setShellPrefs(nextPrefs);
    setSidebarItems(loadSidebarPrefs(currentUser?.id));
    setView(nextPrefs.restoreLastView ? (nextPrefs.lastView || nextPrefs.defaultView || "dashboard") : (nextPrefs.defaultView || "dashboard"));
    setDashLayout(loadDashLayout(currentUser?.id));
    setDashSizes(loadDashSizes(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    saveShellPrefs(currentUser?.id, shellPrefs);
  }, [currentUser?.id, shellPrefs]);

  useEffect(() => {
    saveDashLayout(currentUser?.id, dashLayout);
  }, [currentUser?.id, dashLayout]);

  useEffect(() => {
    saveDashSizes(currentUser?.id, dashSizes);
  }, [currentUser?.id, dashSizes]);

  const handleUpdateNotifPrefs = (next) => {
    setNotifPrefs(next);
    try { localStorage.setItem(NOTIF_PREFS_KEY(currentUser?.id), JSON.stringify(next)); } catch {}
  };
  const handleMarkRead = (id) => {
    setNotifReadIds((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem(NOTIF_READ_KEY(currentUser?.id), JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const handleMarkAllRead = () => {
    setNotifReadIds((prev) => {
      const next = new Set([...prev, ...notifications.map((n) => n.id)]);
      try { localStorage.setItem(NOTIF_READ_KEY(currentUser?.id), JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const notifications = useMemo(() => {
    const result = [];
    const now = Date.now();
    tickets.forEach((tk) => {
      if (["Resolved", "Closed"].includes(tk.status)) return;
      const slaHours = slaForPriority(tk.priority);
      const pct      = slaPct(tk.createdAt, slaHours, tk.resolvedAt);

      if (tk.assignee === currentUser.id) {
        if (notifPrefs.slaBreaches && pct >= 100) {
          result.push({ id: `sla_breach_${tk.id}`, type: "sla_breach", ticketId: tk.id, title: "SLA Breached", message: `${tk.id}: ${(tk.title || "").slice(0, 55)}`, time: tk.createdAt + slaHours * 3600000, severity: "error" });
        } else if (notifPrefs.slaRisk && pct >= 75) {
          result.push({ id: `sla_risk_${tk.id}`, type: "sla_risk", ticketId: tk.id, title: "SLA At Risk", message: `${tk.id}: ${(tk.title || "").slice(0, 55)}`, time: now, severity: "warning" });
        }
        if (notifPrefs.newAssignments && now - tk.createdAt < 48 * 3600000) {
          result.push({ id: `assigned_${tk.id}`, type: "assigned", ticketId: tk.id, title: "Ticket Assigned", message: `${tk.id}: ${(tk.title || "").slice(0, 55)}`, time: tk.createdAt, severity: "info" });
        }
      }
      if (notifPrefs.comments && (tk.assignee === currentUser.id || tk.reporter === currentUser.id)) {
        tk.comments?.forEach((c) => {
          if (c.userId !== currentUser.id && now - c.createdAt < 24 * 3600000) {
            result.push({ id: `comment_${c.id}`, type: "comment", ticketId: tk.id, title: "New Comment", message: `On ${tk.id}: ${(c.text || "").slice(0, 45)}`, time: c.createdAt, severity: "info" });
          }
        });
      }
    });
    // Pending org invitations always appear at the top regardless of preferences
    orgInvitations.forEach((inv) => {
      const orgName = orgs.find((o) => o.id === inv.orgId)?.name || "an organization";
      result.unshift({ id: `invite_${inv.id}`, type: "invitation", invitationId: inv.id, title: "Organization Invite", message: `You've been invited to join ${orgName}`, time: inv.sentAt, severity: "info" });
    });
    return result.sort((a, b) => b.time - a.time).slice(0, 30);
  }, [tickets, currentUser.id, notifPrefs, orgInvitations, orgs]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = useMemo(() => notifications.filter((n) => !notifReadIds.has(n.id)).length, [notifications, notifReadIds]);
  const sidebarOpen = shellPrefs.sidebarOpen;

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const sidebarOptions = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "incidents", label: "Incidents", icon: "incident" },
    { id: "requests", label: "Requests", icon: "request" },
    { id: "catalog", label: "Service Catalog", icon: "clipboard" },
    { id: "approvals", label: "Approvals", icon: "check" },
    { id: "changes", label: "Changes", icon: "change" },
    { id: "problems", label: "Problems", icon: "problem" },
    { id: "tasks", label: "Tasks", icon: "task" },
    { id: "all_tickets", label: "All Tickets", icon: "ticket" },
    { id: "kanban",   label: "Kanban Board",       icon: "kanban"      },
    { id: "teams",    label: "Teams & Orgs",        icon: "teams"       },
    { id: "kb",       label: "Knowledge Base",      icon: "kb"          },
    { id: "reports",  label: "Reports & Analytics", icon: "chart"       },
    { id: "profile",  label: "My Profile",          icon: "user-circle" },
  ];

  useEffect(() => {
    const next = loadSidebarPrefs(currentUser?.id);
    setSidebarItems(next);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!sidebarItems.includes(view)) {
      setView(sidebarItems[0] || "dashboard");
    }
  }, [sidebarItems, view]);

  const updateSidebarItems = (next) => {
    const cleaned = next.filter((id) => DEFAULT_SIDEBAR_ITEMS.includes(id));
    const finalItems = cleaned.length ? cleaned : ["dashboard"];
    setSidebarItems(finalItems);
    saveSidebarPrefs(currentUser?.id, finalItems);
    if (!finalItems.includes(view)) setView(finalItems[0]);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const orgIds = await fetchUserOrgIds(currentUser.id, currentUser.email);
        const data = await fetchAppData({ orgIds });
        if (!mounted) return;
        setOrgs(data.orgs);
        setTeams(data.teams);
        setUsers(data.users);
        setTickets(data.tickets);
        setArticles(data.articles);
        setOrgSettings(data.orgSettings);
        setTeamSettings(data.teamSettings);
        setTeamRoles(data.teamRoles);
        setPostReviews(data.postIncidentReviews);
        setClosingTemplates(data.closingTemplates || []);
        setPirFieldConfigs(data.pirFieldConfigs || []);
        setCatalogItems(data.catalogItems || []);
        setApprovals(data.approvals || []);
        if (currentUser?.email) {
          fetchOrgInvitationsForUser(currentUser.email)
            .then((invites) => { if (mounted) setOrgInvitations(invites); })
            .catch(() => {});
        }
      } catch (err) {
        if (!mounted) return;
        setLoadError(err?.message || "Failed to load workspace data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When the active org changes, reset team selection to the first team in that org.
  // All org data is loaded upfront, so no reload is needed — just re-filter.
  useEffect(() => {
    if (!selectedOrgId) return;
    const firstTeam = teams.find((t) => t.orgId === selectedOrgId);
    setSelectedTeamId(firstTeam?.id || null);
  }, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up real-time subscriptions for live updates
  useEffect(() => {
    if (tickets.length === 0) return;
    
    // Subscribe to ticket updates
    const unsubscribeTickets = subscribeToTicketUpdates((update) => {
      const { type, ticket } = update;
      if (!ticket || ticket.org_id !== currentUser?.orgId) return;
      
      if (type === "insert") {
        setTickets((prev) => [ticket, ...prev]);
      } else if (type === "update") {
        setTickets((prev) => prev.map((t) => t.id === ticket.id ? ticket : t));
        // Update active ticket if it matches
        if (activeTicket?.id === ticket.id) {
          setActiveTicket(ticket);
        }
      } else if (type === "delete") {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      }
    });

    // Subscribe to comment updates
    const unsubscribeComments = subscribeToTicketComments(activeTicket?.id, (update) => {
      if (update.type === "insert" || update.type === "update") {
        setActiveTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: [
              ...(prev.comments || []).filter((c) => c.id !== update.comment.id),
              update.comment,
            ],
          };
        });
      }
    });

    // Subscribe to approval updates
    const unsubscribeApprovals = subscribeToApprovals((update) => {
      const { type, approval } = update;
      if (!approval || approval.org_id !== currentUser?.orgId) return;
      
      if (type === "insert" || type === "update") {
        setApprovals((prev) => [
          ...prev.filter((a) => a.id !== approval.id),
          approval,
        ]);
      } else if (type === "delete") {
        setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
      }
    });

    return () => {
      unsubscribeTickets?.();
      unsubscribeComments?.();
      unsubscribeApprovals?.();
    };
  }, [activeTicket?.id, tickets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize selected org/team on data load
  useEffect(() => {
    if (orgs.length === 0 || teams.length === 0) return;
    if (!selectedOrgId) {
      const userOrg = currentUser?.orgId || orgs[0]?.id;
      setSelectedOrgId(userOrg);
    }
    if (!selectedTeamId && selectedOrgId) {
      const userTeam = currentUser?.teamId || teams.find((t) => t.orgId === selectedOrgId)?.id;
      setSelectedTeamId(userTeam);
    }
  }, [orgs, teams, currentUser?.orgId, currentUser?.teamId, selectedOrgId, selectedTeamId]);

  // Show tutorial on first login if not completed
  useEffect(() => {
    if (loading) return;
    if (!isTutorialCompleted()) {
      setShowTutorial(true);
    }
  }, [loading, isTutorialCompleted]);

  // SLA breach toast — shown once after initial load
  useEffect(() => {
    if (loading || tickets.length === 0 || slaToastShown.current) return;
    slaToastShown.current = true;
    const cat = getPriorityCatalog(currentUser.orgId, currentUser.teamId);
    const now = Date.now();
    const breached = tickets.filter((tk) => {
      if (["Resolved", "Closed"].includes(tk.status)) return false;
      const cfg = cat[tk.priority];
      const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
      return (now - tk.createdAt) / 3600000 > slaHours;
    }).length;
    if (breached > 0) {
      addToast({
        type: "error",
        title: "SLA Breach Alert",
        message: `${breached} ticket${breached !== 1 ? "s have" : " has"} breached SLA. Check the dashboard for details.`,
        duration: 8000,
      });
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveUser = users.find((u) => u.id === currentUser.id) || currentUser;
  const currentOrg = orgs.find((o) => o.id === effectiveUser.orgId);
  const plan = normalizePlan(currentOrg?.plan);

  // Filter tickets to the selected org + team (all org data is merged in state)
  const visibleTickets = useMemo(() => {
    const orgTickets = selectedOrgId ? tickets.filter((tk) => tk.orgId === selectedOrgId) : tickets;
    if (!selectedTeamId) return orgTickets;
    return orgTickets.filter((tk) => tk.teamId === selectedTeamId);
  }, [tickets, selectedOrgId, selectedTeamId]);

  // Users scoped to the active org for assignee/reporter dropdowns
  const visibleUsers = useMemo(() => {
    if (!selectedOrgId) return users;
    const orgUsers = users.filter((u) => u.orgId === selectedOrgId);
    // Include the logged-in user even if they joined this org via invitation
    if (effectiveUser && !orgUsers.some((u) => u.id === effectiveUser.id)) {
      return [effectiveUser, ...orgUsers];
    }
    return orgUsers;
  }, [users, selectedOrgId, effectiveUser]);

  const isDefaultPriorityMap = (priorityMap = {}) => {
    const defaultEntries = Object.entries(PRIORITIES);
    const currentEntries = Object.entries(priorityMap || {});
    if (!currentEntries.length || currentEntries.length !== defaultEntries.length) return false;

    return defaultEntries.every(([name, cfg]) => {
      const current = priorityMap[name];
      return current && current.color === cfg.color && Number(current.sla) === Number(cfg.sla);
    });
  };

  const isDefaultUrgencies = (urgencies = []) => {
    if (!Array.isArray(urgencies) || urgencies.length !== DEFAULT_URGENCIES.length) return false;
    return urgencies.every((value, index) => value === DEFAULT_URGENCIES[index]);
  };

  const getPriorityCatalog = (orgId, teamId) => {
    const team = teamSettings.find((row) => row.teamId === teamId);
    const org = orgSettings.find((row) => row.orgId === orgId);

    const teamMap = team?.priorityMap || {};
    const orgMap = org?.priorityMap || {};
    const teamHasCustom = Object.keys(teamMap).length && !isDefaultPriorityMap(teamMap);

    if (teamHasCustom) return teamMap;
    if (Object.keys(orgMap).length) return orgMap;
    if (Object.keys(teamMap).length) return teamMap;
    return org?.priorityMap || {};
  };

  const getUrgencyLevels = (orgId, teamId) => {
    const team = teamSettings.find((row) => row.teamId === teamId);
    const org = orgSettings.find((row) => row.orgId === orgId);

    const teamUrgencies = team?.urgencies || [];
    const orgUrgencies = org?.urgencies || [];
    const teamHasCustom = teamUrgencies.length && !isDefaultUrgencies(teamUrgencies);

    if (teamHasCustom) return teamUrgencies;
    if (orgUrgencies.length) return orgUrgencies;
    if (teamUrgencies.length) return teamUrgencies;
    return ["Critical", "High", "Medium", "Low"];
  };

  const openTicket = (tk) => {
    const latest = tickets.find((row) => row.id === tk.id) || tk;
    setActiveTicket(latest);
    setModal("detail");
  };

  const handlePatchTicket = async (ticketId, fields) => {
    const saved = await updateTicketFields(ticketId, fields);
    setTickets((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
    setActiveTicket((current) => (current?.id === saved.id ? saved : current));
    return saved;
  };

  const handleAddComment = async (ticketId, payload) => {
    const comment = await createTicketComment(ticketId, payload);
    setTickets((rows) => rows.map((row) => {
      if (row.id !== ticketId) return row;
      return { ...row, comments: [...row.comments, comment] };
    }));
    setActiveTicket((current) => {
      if (current?.id !== ticketId) return current;
      return { ...current, comments: [...current.comments, comment] };
    });
    return comment;
  };

  const handleCreateTicket = async (payload) => {
    const created = await createTicket({ ...payload, reporter: effectiveUser.id });
    setTickets((rows) => [created, ...rows]);
    return created;
  };

  const handleCreateOrg = async (payload) => {
    const created = await createOrganisation(payload);
    setOrgs((rows) => [...rows, created]);
    return created;
  };

  const handleUpdateOrgPlan = async (orgId, plan) => {
    const updated = await updateOrgPlan(orgId, plan);
    setOrgs((rows) => rows.map((o) => o.id === orgId ? updated : o));
    return updated;
  };

  const handleCreateTeam = async (payload) => {
    const created = await createTeam(payload);
    setTeams((rows) => [...rows, created]);
    return created;
  };

  const handleSaveOrgSettings = async (payload) => {
    const saved = await upsertOrgSettings(payload);
    setOrgSettings((rows) => {
      const exists = rows.some((row) => row.orgId === saved.orgId);
      if (!exists) return [...rows, saved];
      return rows.map((row) => row.orgId === saved.orgId ? saved : row);
    });
    return saved;
  };

  const handleSaveTeamSettings = async (payload) => {
    const saved = await upsertTeamSettings(payload);
    setTeamSettings((rows) => {
      const exists = rows.some((row) => row.teamId === saved.teamId);
      if (!exists) return [...rows, saved];
      return rows.map((row) => row.teamId === saved.teamId ? saved : row);
    });
    return saved;
  };

  const handleCreateClosingTemplate = async (payload) => {
    const created = await createClosingTemplate(payload);
    setClosingTemplates((rows) => [...rows, created]);
    return created;
  };

  const handleUpdateClosingTemplate = async (id, payload) => {
    const updated = await updateClosingTemplate(id, payload);
    setClosingTemplates((rows) => rows.map((r) => r.id === updated.id ? updated : r));
    return updated;
  };

  const handleDeleteClosingTemplate = async (id) => {
    await deleteClosingTemplate(id);
    setClosingTemplates((rows) => rows.filter((r) => r.id !== id));
    return true;
  };

  const handleUpsertPirFieldConfig = async (payload) => {
    const saved = await upsertPirFieldConfig(payload);
    setPirFieldConfigs((rows) => {
      const exists = rows.some((r) => r.id === saved.id || (r.orgId === saved.orgId && r.teamId === saved.teamId));
      if (!exists) return [...rows, saved];
      return rows.map((r) => (r.id === saved.id || (r.orgId === saved.orgId && r.teamId === saved.teamId)) ? saved : r);
    });
    return saved;
  };

  const handleAddTeamRole = async (payload) => {
    const created = await createTeamRole(payload);
    setTeamRoles((rows) => [...rows, created]);
    return created;
  };

  const handleCreateMember = async (payload) => {
    const created = await createMember(payload);
    // If an invitation was sent, do not append a member row; return the invite marker
    if (created && created.inviteSent) {
      return created;
    }
    setUsers((rows) => [...rows, created]);
    return created;
  };

  const handleAcceptInvitation = async (invitationId) => {
    const result = await acceptOrgInvitation(invitationId);
    setOrgInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    const newOrgId = result?.orgId;
    if (!newOrgId) return;
    // Load the new org's data and MERGE into state — don't wipe the existing orgs
    const data = await fetchAppData({ orgIds: [newOrgId] });
    const byOrgId = (prev, next) => [...prev.filter((r) => r.orgId !== newOrgId), ...next];
    setOrgs((prev) => [...prev.filter((o) => o.id !== newOrgId), ...data.orgs]);
    setTeams((prev) => byOrgId(prev, data.teams));
    setUsers((prev) => byOrgId(prev, data.users));
    setTickets((prev) => byOrgId(prev, data.tickets));
    setArticles((prev) => byOrgId(prev, data.articles));
    setOrgSettings((prev) => byOrgId(prev, data.orgSettings));
    setTeamSettings((prev) => [
      ...prev.filter((s) => !data.teamSettings.some((ns) => ns.teamId === s.teamId)),
      ...data.teamSettings,
    ]);
    setTeamRoles((prev) => [
      ...prev.filter((r) => !data.teamRoles.some((nr) => nr.teamId === r.teamId)),
      ...data.teamRoles,
    ]);
    setPostReviews((prev) => byOrgId(prev, data.postIncidentReviews));
    setClosingTemplates((prev) => byOrgId(prev, data.closingTemplates || []));
    setPirFieldConfigs((prev) => byOrgId(prev, data.pirFieldConfigs || []));
    setCatalogItems((prev) => byOrgId(prev, data.catalogItems || []));
    setApprovals((prev) => byOrgId(prev, data.approvals || []));
    setSelectedOrgId(newOrgId);
  };

  const handleDeclineInvitation = async (invitationId) => {
    await declineOrgInvitation(invitationId);
    setOrgInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  };

  const handleUpdateMemberRoles = async (payload) => {
    const saved = await updateMemberRoles(payload.userId, payload.roles);
    setUsers((rows) => rows.map((row) => row.id === saved.id ? saved : row));
    return saved;
  };

  const handleCreateArticle = async (payload) => {
    const created = await createArticle(payload);
    setArticles((rows) => [created, ...rows]);
    return created;
  };

  const handleUpdateArticle = async (articleId, payload) => {
    const saved = await updateArticle(articleId, payload);
    setArticles((rows) => rows.map((row) => row.id === saved.id ? saved : row));
    return saved;
  };

  const handleSavePostIncidentReview = async (payload) => {
    const existing = postReviews.find((row) => row.ticketId === payload.ticketId);
    const saved = await savePostIncidentReview({ ...payload, id: existing?.id || payload.id });
    setPostReviews((rows) => {
      const exists = rows.some((row) => row.id === saved.id);
      if (!exists) return [saved, ...rows];
      return rows.map((row) => row.id === saved.id ? saved : row);
    });
    return saved;
  };

  const handleViewArticle = async (article) => {
    const nextViews = (article.views || 0) + 1;
    setArticles((rows) => rows.map((row) => row.id === article.id ? { ...row, views: nextViews } : row));
    try {
      const saved = await incrementArticleViews(article.id, nextViews);
      setArticles((rows) => rows.map((row) => row.id === saved.id ? saved : row));
    } catch {
      setArticles((rows) => rows.map((row) => row.id === article.id ? { ...row, views: article.views || 0 } : row));
    }
  };

  const handleBulkUpdate = async (updates) => {
    const normalized = (updates || [])
      .map((row) => ({
        id: row?.id || row?.ticketId,
        fields: row?.fields || row?.updates || {},
      }))
      .filter((row) => row.id && row.fields && Object.keys(row.fields).length > 0);

    if (normalized.length === 0) return;

    const results = await Promise.all(normalized.map(({ id, fields }) => updateTicketFields(id, fields)));
    setTickets((rows) => {
      const map = {};
      results.forEach((tk) => { map[tk.id] = tk; });
      return rows.map((row) => map[row.id] || row);
    });
  };

  const handleNew = (type) => { setDefaultType(type || null); setModal("new"); };
  const handleRequestCatalogItem = async (item, payload) => {
    const requesterId = payload.requestedFor || currentUser.id;
    const ticketTitle = String(payload.title || item?.name || "Service Request").trim() || "Service Request";
    const ticketDescription = String(payload.description || item?.description || "").trim();
    const needsApproval = Boolean(
      item.requiresApproval ||
      item.approverMode === "user" ||
      item.approverMode === "team" ||
      item.approverId ||
      item.approverTeamId
    );
    const createdTicket = await createTicket({
      type: payload.type || item.defaultType || "Service Request",
      title: ticketTitle,
      description: ticketDescription,
      catalogItemId: item.id,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      reporter: requesterId,
      assignee: "",
      priority: payload.priority || item.defaultPriority || "Medium",
      urgency: payload.urgency || item.defaultUrgency || "Medium",
      status: needsApproval ? "Awaiting Approval" : "Open",
      dueDate: payload.dueDate || null,
      estimateHours: payload.estimateHours || null,
      spentHours: 0,
      tags: ["catalog", item.id].filter(Boolean),
    });

    setTickets((rows) => [createdTicket, ...rows]);

    if (needsApproval) {
      // Build approval payload depending on approverMode: 'role'|'user'|'team'
      let approverId = "";
      let approverTeamId = "";
      let approverRole = item.approverRole || "Admin";

      if (item.approverMode === "user" && item.approverId) {
        const explicit = users.find((u) => u.id === item.approverId && u.orgId === payload.orgId);
        if (explicit) approverId = explicit.id;
      }

      if (item.approverMode === "team" && item.approverTeamId) {
        approverTeamId = item.approverTeamId;
      }

      if (!approverId && !approverTeamId) {
        // fallback: find a user by role within org/team or any org admin
        const approver = users.find((user) =>
          user.orgId === payload.orgId &&
          (payload.teamId ? user.teamId === payload.teamId : true) &&
          (userHasRole(user, item.approverRole) || userHasRole(user, "Admin"))
        ) || users.find((user) => user.orgId === payload.orgId && userHasRole(user, "Admin"));
        if (approver) approverId = approver.id;
      }

      const createdApproval = await createApproval({
        orgId: payload.orgId,
        teamId: payload.teamId || "",
        ticketId: createdTicket.id,
        catalogItemId: item.id,
        requestedBy: currentUser.id,
        requestedFor: requesterId,
        approverId: approverId || "",
        approverRole,
        approverMode: item.approverMode || "role",
        approverTeamId: approverTeamId || "",
        status: "Pending",
        dueAt: payload.dueDate || null,
      });

      setApprovals((rows) => [createdApproval, ...rows]);

      addToast({
        type: "info",
        title: "Request submitted",
        message: `${item.name} is waiting for approval.`,
        duration: 4500,
      });
      return { ticket: createdTicket, approval: createdApproval };
    }

    addToast({
      type: "success",
      title: "Request submitted",
      message: `${item.name} has been created as ${createdTicket.id}.`,
      duration: 4500,
    });
    return { ticket: createdTicket, approval: null };
  };
  const handleUpdateCatalogItem = async (itemId, updates) => {
    const saved = await updateCatalogItem(itemId, updates);
    setCatalogItems((rows) => rows.map((r) => r.id === saved.id ? saved : r));
    return saved;
  };
  const handleCreateCatalogItem = async (payload) => {
    const created = await createCatalogItem(payload);
    setCatalogItems((rows) => [created, ...rows]);
    return created;
  };
  const handleAddApprovalToTicket = async (ticketId, payload = {}) => {
    const ticket = tickets.find((row) => row.id === ticketId);
    if (!ticket) throw new Error("Ticket not found.");

    const createdApproval = await createApproval({
      orgId: ticket.orgId,
      teamId: ticket.teamId || "",
      ticketId,
      catalogItemId: ticket.catalogItemId || "",
      requestedBy: payload.requestedBy || effectiveUser.id,
      requestedFor: payload.requestedFor || ticket.requestedFor || ticket.reporter,
      approverId: payload.approverId || "",
      approverRole: payload.approverRole || "Admin",
      approverMode: payload.approverMode || "user",
      approverTeamId: payload.approverTeamId || "",
      status: "Pending",
      dueAt: payload.dueAt || ticket.dueDate || null,
      comments: payload.comments || "",
    });

    setApprovals((rows) => [createdApproval, ...rows]);

    if (!["Awaiting Approval", "Resolved", "Closed"].includes(ticket.status)) {
      const updatedTicket = await updateTicketFields(ticketId, { status: "Awaiting Approval" });
      setTickets((rows) => rows.map((row) => row.id === updatedTicket.id ? updatedTicket : row));
      setActiveTicket((current) => (current?.id === updatedTicket.id ? updatedTicket : current));
    }

    addToast({
      type: "info",
      title: "Approver added",
      message: `Approval ${createdApproval.id} was added to ${ticketId}.`,
      duration: 3500,
    });

    return createdApproval;
  };
  const handleResolveApproval = async (approvalId, decision, comments) => {
    const approval = approvals.find((row) => row.id === approvalId);
    if (!approval) throw new Error("Approval not found.");

    const resolved = await resolveApproval(approvalId, {
      status: decision === "Approved" ? "Approved" : "Rejected",
      decision,
      comments,
      approverId: currentUser.id,
    });

    const nextApprovals = approvals.map((row) => row.id === resolved.id ? resolved : row);
    setApprovals(nextApprovals);

    const orgSetting = orgSettings.find((row) => row.orgId === approval.orgId) || {};
    const approvalMode = orgSetting.approvalMode || "all";
    const ticketApprovals = nextApprovals.filter((row) => row.ticketId === approval.ticketId);
    let nextStatus = "Awaiting Approval";

    if (decision !== "Approved") {
      nextStatus = "Closed";
    } else if (approvalMode === "any") {
      nextStatus = "Open";
    } else {
      const hasRejected = ticketApprovals.some((row) => row.status === "Rejected");
      const hasPending = ticketApprovals.some((row) => row.status === "Pending");
      nextStatus = !hasRejected && !hasPending ? "Open" : "Awaiting Approval";
    }

    const updatedTicket = await updateTicketFields(approval.ticketId, { status: nextStatus });
    setTickets((rows) => rows.map((row) => row.id === updatedTicket.id ? updatedTicket : row));
    setActiveTicket((current) => (current?.id === updatedTicket.id ? updatedTicket : current));

    addToast({
      type: decision === "Approved" ? "success" : "warning",
      title: `Approval ${decision.toLowerCase()}`,
      message: nextStatus === "Awaiting Approval"
        ? `${approval.ticketId} is still awaiting remaining approvals.`
        : `${approval.ticketId} is now ${nextStatus.toLowerCase()}.`,
      duration: 4500,
    });

    return resolved;
  };
  const handleSetView = (nextView) => {
    setView(nextView);
    setShellPrefs((current) => ({ ...current, lastView: nextView }));
    if (isMobile) window.scrollTo(0, 0);
  };
  const handleToggleSidebar = () => {
    setShellPrefs((current) => ({ ...current, sidebarOpen: !current.sidebarOpen }));
  };
  const handleUpdateWorkspacePrefs = (patch) => {
    setShellPrefs((current) => ({ ...current, ...patch }));
  };
  const resetWorkspacePrefs = () => {
    setShellPrefs({ ...DEFAULT_SHELL_PREFS });
    setSidebarItems(DEFAULT_SIDEBAR_ITEMS);
    setDashLayout(DEFAULT_LAYOUT);
    setDashSizes({});
    setView("dashboard");
  };
  const toggleSidebarItem = (id) => {
    updateSidebarItems(
      sidebarItems.includes(id)
        ? sidebarItems.filter((item) => item !== id)
        : [...sidebarItems, id]
    );
  };

  // Type string for the "New Ticket" button in the topbar to pre-select
  const topbarType = VIEW_TO_TYPE[view] || null;

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", background: t.bg, color: t.text2, fontFamily: t.font }}>
        Loading workspace data...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", background: t.bg, fontFamily: t.font, padding: 24 }}>
        <div style={{ maxWidth: 640, textAlign: "center" }}>
          <h2 style={{ color: t.text, marginTop: 0 }}>Unable to load data</h2>
          <p style={{ color: t.text3, lineHeight: 1.6, marginBottom: 0 }}>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: t.bg, fontFamily: t.font }}>
      {!isMobile && (
        <DesktopSidebar
          view={view} setView={handleSetView}
          open={sidebarOpen} onToggle={handleToggleSidebar}
          currentUser={effectiveUser} tickets={visibleTickets} onLogout={onLogout}
          visibleNavItems={sidebarItems}
          onCustomizeSidebar={() => setShowSidebarPrefs(true)}
          plan={plan}
          onShowPlans={() => setShowPlansModal(true)}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Topbar
          onToggle={handleToggleSidebar}
          view={view} tickets={visibleTickets}
          onNewTicket={() => handleNew(topbarType)}
          isMobile={isMobile}
          notifications={notifications}
          unreadCount={unreadCount}
          notifReadIds={notifReadIds}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onOpenTicket={(tk) => tk && openTicket(tk)}
          onOpenCommandPalette={() => setCmdOpen(true)}
          currentUser={effectiveUser}
          orgs={orgs}
          teams={teams}
          selectedOrgId={selectedOrgId}
          selectedTeamId={selectedTeamId}
          onSelectOrg={setSelectedOrgId}
          onSelectTeam={setSelectedTeamId}
          onAcceptInvitation={handleAcceptInvitation}
          onDeclineInvitation={handleDeclineInvitation}
        />

        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "22px", paddingBottom: isMobile ? "80px" : "22px", WebkitOverflowScrolling: "touch" }}>
          {view === "dashboard" && (
            <DashboardView
              tickets={visibleTickets} articles={articles}
              users={visibleUsers} currentUser={effectiveUser}
              layout={dashLayout}
              sizeOverrides={dashSizes}
              onLayoutChange={setDashLayout}
              onSizeChange={(widgetId, size) => setDashSizes((prev) => ({ ...prev, [widgetId]: size }))}
              onCustomise={() => setModal("customise")}
              onOpenTicket={openTicket} onNewTicket={() => handleNew()}
              priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)}
            />
          )}

          {view === "catalog" && (
            <ServiceCatalogView
              items={catalogItems}
              currentUser={effectiveUser}
              users={visibleUsers}
              teams={teams}
              orgs={orgs}
                orgSettings={orgSettings}
              tickets={visibleTickets}
              onRequestItem={handleRequestCatalogItem}
              onCreateCatalogItem={handleCreateCatalogItem}
              onUpdateCatalogItem={handleUpdateCatalogItem}
            />
          )}

          {view === "approvals" && (
            <ApprovalsView
              approvals={approvals}
              catalogItems={catalogItems}
              tickets={visibleTickets}
              currentUser={effectiveUser}
              users={visibleUsers}
              orgSettings={orgSettings}
              teams={teams}
              onResolveApproval={handleResolveApproval}
              onOpenTicket={openTicket}
            />
          )}

          {/* Per-type ticket views */}
          {view === "all_tickets" && <TicketListView typeFilter={null}             tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew()} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}
          {view === "incidents"   && <TicketListView typeFilter="Incident"         tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew("Incident")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}
          {view === "requests"    && <TicketListView typeFilter="Service Request"  tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew("Service Request")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}
          {view === "changes"     && <TicketListView typeFilter="Change Request"   tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew("Change Request")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}
          {view === "problems"    && <TicketListView typeFilter="Problem"          tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew("Problem")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}
          {view === "tasks"       && <TicketListView typeFilter="Task"             tickets={visibleTickets} users={visibleUsers} currentUser={effectiveUser} onOpenTicket={openTicket} onNewTicket={() => handleNew("Task")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} onBulkUpdate={handleBulkUpdate} plan={plan} onUpgrade={() => setShowPlansModal(true)} />}

          {view === "kanban" && (
            canFeature(plan, "kanban") ? (
              <KanbanView
                tickets={visibleTickets}
                users={visibleUsers}
                currentUser={effectiveUser}
                priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)}
                onOpenTicket={openTicket}
                onPatchTicket={handlePatchTicket}
              />
            ) : (
              <UpgradeGate plan={plan} requiredPlan="Basic" featureName="Kanban Board" fullPage onUpgrade={() => setShowPlansModal(true)} />
            )
          )}

          {view === "teams" && (
            <TeamsView
              orgs={orgs}
              teams={teams}
              users={visibleUsers}
              tickets={tickets}
              orgSettings={orgSettings}
              teamSettings={teamSettings}
              closingTemplates={closingTemplates}
              pirFieldConfigs={pirFieldConfigs}
              teamRoles={teamRoles}
              plan={plan}
              onCreateOrg={handleCreateOrg}
              onCreateTeam={handleCreateTeam}
              onCreateMember={handleCreateMember}
              onUpdateMemberRoles={handleUpdateMemberRoles}
              onSaveOrgSettings={handleSaveOrgSettings}
              onSaveTeamSettings={handleSaveTeamSettings}
              onAddTeamRole={handleAddTeamRole}
              onCreateClosingTemplate={handleCreateClosingTemplate}
              onUpdateClosingTemplate={handleUpdateClosingTemplate}
              onDeleteClosingTemplate={handleDeleteClosingTemplate}
              onUpsertPirFieldConfig={handleUpsertPirFieldConfig}
              onUpgrade={() => setShowPlansModal(true)}
              onUpgradePlan={handleUpdateOrgPlan}
            />
          )}
          {view === "kb" && (
            canFeature(plan, "kb") ? (
              <KBView
                articles={articles}
                users={visibleUsers}
                currentUser={effectiveUser}
                orgSettings={orgSettings}
                plan={plan}
                onCreateArticle={handleCreateArticle}
                onUpdateArticle={handleUpdateArticle}
                onViewArticle={handleViewArticle}
                onUpgrade={() => setShowPlansModal(true)}
              />
            ) : (
              <UpgradeGate plan={plan} requiredPlan="Basic" featureName="Knowledge Base" fullPage onUpgrade={() => setShowPlansModal(true)} />
            )
          )}
          {view === "reports" && (
            !canFeature(plan, "reports") ? (
              <UpgradeGate plan={plan} requiredPlan="Basic" featureName="Reports & Analytics" fullPage onUpgrade={() => setShowPlansModal(true)} />
            ) : !canDo(effectiveUser, orgSettings.find((s) => s.orgId === effectiveUser?.orgId), "reports.view") ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 48, textAlign: "center", color: t.text3 }}>
                <I name="chart" size={40} />
                <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: t.text }}>Access Restricted</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>Your role doesn't have permission to view reports. Ask an Admin to grant the "View reports" permission.</div>
              </div>
            ) : (
              <ReportsView
                tickets={visibleTickets}
                users={visibleUsers}
                currentUser={effectiveUser}
                priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)}
              />
            )
          )}
          {view === "profile" && (
            <ProfileView
              currentUser={effectiveUser}
              tickets={visibleTickets}
              notifPrefs={notifPrefs}
              onUpdateNotifPrefs={handleUpdateNotifPrefs}
              launchView={shellPrefs.defaultView}
              onUpdateLaunchView={(nextView) => handleUpdateWorkspacePrefs({ defaultView: nextView })}
              restoreLastView={shellPrefs.restoreLastView}
              onToggleRestoreLastView={() => handleUpdateWorkspacePrefs({ restoreLastView: !shellPrefs.restoreLastView })}
              sidebarOpen={sidebarOpen}
              onUpdateSidebarOpen={(nextOpen) => handleUpdateWorkspacePrefs({ sidebarOpen: nextOpen })}
              onResetWorkspacePrefs={resetWorkspacePrefs}
              plan={plan}
              onShowPlans={() => setShowPlansModal(true)}
            />
          )}
        </main>
      </div>

      {isMobile && (
        <MobileNav
          view={view} setView={handleSetView}
          currentUser={effectiveUser} tickets={visibleTickets}
          onLogout={onLogout} onNewTicket={() => handleNew(topbarType)}
          visibleNavItems={sidebarItems}
          onCustomizeSidebar={() => setShowSidebarPrefs(true)}
        />
      )}

      {/* Global panels / modals */}
      {modal === "detail" && activeTicket && (
        <TicketDetailPanel
          ticket={activeTicket}
          users={visibleUsers}
          currentUser={effectiveUser}
          onClose={() => setModal(null)}
          onPatch={handlePatchTicket}
          onComment={handleAddComment}
          priorityCatalog={getPriorityCatalog(activeTicket.orgId, activeTicket.teamId)}
          urgencyLevels={getUrgencyLevels(activeTicket.orgId, activeTicket.teamId)}
          review={postReviews.find((row) => row.ticketId === activeTicket.id) || null}
          onSaveReview={handleSavePostIncidentReview}
          closingTemplates={closingTemplates.filter((tmpl) => tmpl.orgId === activeTicket.orgId && (!tmpl.teamId || tmpl.teamId === activeTicket.teamId))}
          pirFieldConfig={pirFieldConfigs.find((cfg) => cfg.orgId === activeTicket.orgId && (!cfg.teamId || cfg.teamId === activeTicket.teamId)) || null}
          allTickets={tickets}
          onOpenTicket={openTicket}
          plan={plan}
          onUpgrade={() => setShowPlansModal(true)}
          approvals={approvals.filter((a) => a.ticketId === activeTicket.id)}
          onResolveApproval={handleResolveApproval}
          onAddApproval={handleAddApprovalToTicket}
        />
      )}
      {modal === "new" && (
        <NewTicketModal
          users={visibleUsers}
          teams={teams}
          orgs={orgs}
          currentUser={effectiveUser}
          onClose={() => setModal(null)}
          onCreate={handleCreateTicket}
          defaultType={defaultType}
          priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)}
          urgencyLevels={getUrgencyLevels(effectiveUser.orgId, effectiveUser.teamId)}
          orgSettings={orgSettings}
          teamSettings={teamSettings}
          allTickets={tickets}
          plan={plan}
        />
      )}
      {modal === "customise" && (
        <DashCustomiser
          layout={dashLayout}
          onSave={setDashLayout}
          onReset={() => {
            setDashLayout(DEFAULT_LAYOUT);
            setDashSizes({});
          }}
          onClose={() => setModal(null)}
          plan={plan}
          onUpgrade={() => setShowPlansModal(true)}
        />
      )}

      {showSidebarPrefs && (
        <Modal title="Customize Sidebar" onClose={() => setShowSidebarPrefs(false)} width={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>
              Choose the sections you want to see in the sidebar. Your selection is saved for your account.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {sidebarOptions.map((item) => {
                const active = sidebarItems.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSidebarItem(item.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                      borderRadius: 10, border: `1px solid ${active ? t.accent : t.border}`,
                      background: active ? t.accentBg : t.surface2, cursor: "pointer",
                      color: active ? t.accentText : t.text, fontFamily: t.font, textAlign: "left",
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: active ? t.accent : t.surface3, color: active ? "#0f0f0e" : t.text2, flexShrink: 0 }}>
                      <I name={item.icon} size={14} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
              <Btn variant="secondary" size="sm" onClick={() => updateSidebarItems(DEFAULT_SIDEBAR_ITEMS)}>
                Reset Defaults
              </Btn>
              <Btn variant="primary" size="sm" onClick={() => setShowSidebarPrefs(false)}>
                Done
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        tickets={tickets}
        articles={articles}
        setView={handleSetView}
        onOpenTicket={openTicket}
        onNewTicket={() => handleNew()}
      />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {showTutorial && (
        <OnboardingTutorial
          userId={currentUser?.id}
          onClose={() => setShowTutorial(false)}
        />
      )}

      {showPlansModal && (
        <PlansModal
          currentPlan={plan}
          onClose={() => setShowPlansModal(false)}
          onSelectPlan={() => { setShowPlansModal(false); handleSetView("teams"); }}
        />
      )}
    </div>
  );
}
