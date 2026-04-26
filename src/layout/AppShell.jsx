// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: DesktopSidebar · MobileNav · Topbar · AppShell
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useTheme, useBreakpoint } from "../core/hooks.js";
import { VIEW_LABELS, VIEW_TO_TYPE } from "../core/constants.js";
import {
  createArticle,
  createMember,
  createOrganisation,
  createTeamRole,
  createTeam,
  createTicket,
  createTicketComment,
  fetchAppData,
  incrementArticleViews,
  savePostIncidentReview,
  updateMemberRoles,
  upsertOrgSettings,
  upsertTeamSettings,
  updateTicketFields,
} from "../core/api.js";
import { Avatar, Btn } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { DEFAULT_LAYOUT } from "../widgets/registry.js";
import { DashboardView, DashCustomiser } from "../widgets/DashboardView.jsx";
import { TicketListView }   from "../views/TicketListView.jsx";
import { TicketDetailPanel } from "../views/TicketDetailPanel.jsx";
import { NewTicketModal }   from "../views/NewTicketModal.jsx";
import { TeamsView }        from "../views/TeamsView.jsx";
import { KBView }           from "../views/KBView.jsx";

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

export function DesktopSidebar({ view, setView, open, onToggle, currentUser, tickets, onLogout }) {
    const currentUserRoles = Array.isArray(currentUser.roles) && currentUser.roles.length
      ? currentUser.roles
      : [currentUser.role].filter(Boolean);
    const currentRoleSummary = currentUserRoles.length > 1
      ? `${currentUserRoles[0]} +${currentUserRoles.length - 1}`
      : (currentUserRoles[0] || "Member");

  const t = useTokens();
  const { dark, toggle } = useTheme();

  const openCount = tickets.filter((tk) => !["Resolved","Closed"].includes(tk.status)).length;

  const navItems = [
    { id: "dashboard",   label: "Dashboard",       icon: "grid" },
    { id: "incidents",   label: "Incidents",        icon: "incident",
      count: tickets.filter((tk) => tk.type === "Incident" && !["Resolved","Closed"].includes(tk.status)).length,
      alert: tickets.some((tk) => tk.type === "Incident" && tk.priority === "Critical" && !["Resolved","Closed"].includes(tk.status)) },
    { id: "requests",    label: "Requests",         icon: "request",
      count: tickets.filter((tk) => tk.type === "Service Request" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "changes",     label: "Changes",          icon: "change",
      count: tickets.filter((tk) => tk.type === "Change Request" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "problems",    label: "Problems",         icon: "problem",
      count: tickets.filter((tk) => tk.type === "Problem" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "tasks",       label: "Tasks",            icon: "task",
      count: tickets.filter((tk) => tk.type === "Task" && !["Resolved","Closed"].includes(tk.status)).length },
    { id: "all_tickets", label: "All Tickets",      icon: "ticket", count: openCount },
    { id: "teams",       label: "Teams & Orgs",     icon: "teams" },
    { id: "kb",          label: "Knowledge Base",   icon: "kb"    },
  ];

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
        {open && <span style={{ fontWeight: 800, fontSize: 14, color: t.text, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>EureakNow</span>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 5px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <div key={item.id}>
              {item.id === "teams" && <div style={{ height: 1, background: t.border, margin: "7px 3px" }} />}
              <button
                onClick={() => setView(item.id)}
                title={!open ? item.label : ""}
                style={{
                  background: active ? t.accentBg : "none",
                  border: `1px solid ${active ? t.accent + "44" : "transparent"}`,
                  borderRadius: 8, padding: open ? "8px 10px" : "8px 0",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  color: active ? t.accentText : t.text2,
                  width: "100%", justifyContent: open ? "flex-start" : "center",
                  fontFamily: t.font, transition: "background .1s",
                }}
              >
                <span style={{ flexShrink: 0 }}><I name={item.icon} size={14} /></span>
                {open && <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{item.label}</span>}
                {open && item.count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 99, background: item.alert ? t.red : t.surface3, color: item.alert ? "#fff" : t.text3 }}>
                    {item.count}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "9px 5px", borderTop: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 2 }}>
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

export function MobileNav({ view, setView, currentUser, tickets, onLogout, onNewTicket }) {
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
    { id: "__more",      icon: "more",     label: "More" },
  ];

  const drawerItems = [
    { id: "requests", label: "Service Requests", icon: "request" },
    { id: "changes",  label: "Change Requests",  icon: "change"  },
    { id: "problems", label: "Problems",         icon: "problem" },
    { id: "tasks",    label: "Tasks",            icon: "task"    },
    { id: "teams",    label: "Teams & Orgs",     icon: "teams"   },
  ];

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
            style={{ position: "absolute", bottom: 64, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.border}`, borderRadius: "20px 20px 0 0", padding: "16px 16px 8px" }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: t.border2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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

export function Topbar({ onToggle, view, tickets, onNewTicket, isMobile }) {
  const t = useTokens();
  const critCount = tickets.filter((tk) => tk.priority === "Critical" && !["Resolved","Closed"].includes(tk.status)).length;

  return (
    <header style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, height: 52, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
      {!isMobile && (
        <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", color: t.text2, display: "flex" }}>
          <I name="menu" size={17} />
        </button>
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
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState("");
  const [view,         setView]         = useState("dashboard");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [modal,        setModal]        = useState(null);   // "detail" | "new" | "customise"
  const [activeTicket, setActiveTicket] = useState(null);
  const [dashLayout,   setDashLayout]   = useState(DEFAULT_LAYOUT);
  const [dashSizes,    setDashSizes]    = useState({});
  const [defaultType,  setDefaultType]  = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await fetchAppData();
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
      } catch (err) {
        if (!mounted) return;
        setLoadError(err?.message || "Failed to load workspace data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const effectiveUser = users.find((u) => u.id === currentUser.id) || currentUser;

  const getPriorityCatalog = (orgId, teamId) => {
    const team = teamSettings.find((row) => row.teamId === teamId);
    if (team?.priorityMap && Object.keys(team.priorityMap).length) return team.priorityMap;
    const org = orgSettings.find((row) => row.orgId === orgId);
    return org?.priorityMap || {};
  };

  const getUrgencyLevels = (orgId, teamId) => {
    const team = teamSettings.find((row) => row.teamId === teamId);
    if (team?.urgencies?.length) return team.urgencies;
    const org = orgSettings.find((row) => row.orgId === orgId);
    return org?.urgencies || ["Critical", "High", "Medium", "Low"];
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

  const handleAddTeamRole = async (payload) => {
    const created = await createTeamRole(payload);
    setTeamRoles((rows) => [...rows, created]);
    return created;
  };

  const handleCreateMember = async (payload) => {
    const created = await createMember(payload);
    setUsers((rows) => [...rows, created]);
    return created;
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

  const handleNew = (type) => { setDefaultType(type || null); setModal("new"); };
  const handleSetView = (v) => { setView(v); if (isMobile) window.scrollTo(0, 0); };

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
          open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)}
          currentUser={effectiveUser} tickets={tickets} onLogout={onLogout}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Topbar
          onToggle={() => setSidebarOpen((o) => !o)}
          view={view} tickets={tickets}
          onNewTicket={() => handleNew(topbarType)}
          isMobile={isMobile}
        />

        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "22px", paddingBottom: isMobile ? "80px" : "22px", WebkitOverflowScrolling: "touch" }}>
          {view === "dashboard" && (
            <DashboardView
              tickets={tickets} articles={articles}
              users={users} currentUser={effectiveUser}
              layout={dashLayout}
              sizeOverrides={dashSizes}
              onLayoutChange={setDashLayout}
              onSizeChange={(widgetId, size) => setDashSizes((prev) => ({ ...prev, [widgetId]: size }))}
              onCustomise={() => setModal("customise")}
              onOpenTicket={openTicket} onNewTicket={() => handleNew()}
            />
          )}

          {/* Per-type ticket views */}
          {view === "all_tickets" && <TicketListView typeFilter={null}             tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew()} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}
          {view === "incidents"   && <TicketListView typeFilter="Incident"         tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew("Incident")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}
          {view === "requests"    && <TicketListView typeFilter="Service Request"  tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew("Service Request")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}
          {view === "changes"     && <TicketListView typeFilter="Change Request"   tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew("Change Request")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}
          {view === "problems"    && <TicketListView typeFilter="Problem"          tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew("Problem")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}
          {view === "tasks"       && <TicketListView typeFilter="Task"             tickets={tickets} users={users} onOpenTicket={openTicket} onNewTicket={() => handleNew("Task")} priorityCatalog={getPriorityCatalog(effectiveUser.orgId, effectiveUser.teamId)} />}

          {view === "teams" && (
            <TeamsView
              orgs={orgs}
              teams={teams}
              users={users}
              tickets={tickets}
              orgSettings={orgSettings}
              teamSettings={teamSettings}
              teamRoles={teamRoles}
              onCreateOrg={handleCreateOrg}
              onCreateTeam={handleCreateTeam}
              onCreateMember={handleCreateMember}
              onUpdateMemberRoles={handleUpdateMemberRoles}
              onSaveOrgSettings={handleSaveOrgSettings}
              onSaveTeamSettings={handleSaveTeamSettings}
              onAddTeamRole={handleAddTeamRole}
            />
          )}
          {view === "kb" && (
            <KBView
              articles={articles}
              users={users}
              currentUser={effectiveUser}
              onCreateArticle={handleCreateArticle}
              onViewArticle={handleViewArticle}
            />
          )}
        </main>
      </div>

      {isMobile && (
        <MobileNav
          view={view} setView={handleSetView}
          currentUser={effectiveUser} tickets={tickets}
          onLogout={onLogout} onNewTicket={() => handleNew(topbarType)}
        />
      )}

      {/* Global panels / modals */}
      {modal === "detail" && activeTicket && (
        <TicketDetailPanel
          ticket={activeTicket}
          users={users}
          currentUser={effectiveUser}
          onClose={() => setModal(null)}
          onPatch={handlePatchTicket}
          onComment={handleAddComment}
          priorityCatalog={getPriorityCatalog(activeTicket.orgId, activeTicket.teamId)}
          urgencyLevels={getUrgencyLevels(activeTicket.orgId, activeTicket.teamId)}
          review={postReviews.find((row) => row.ticketId === activeTicket.id) || null}
          onSaveReview={handleSavePostIncidentReview}
        />
      )}
      {modal === "new" && (
        <NewTicketModal
          users={users}
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
        />
      )}
      {modal === "customise" && (
        <DashCustomiser layout={dashLayout} onSave={setDashLayout} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
