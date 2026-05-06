// ─────────────────────────────────────────────────────────────────────────────
// PROFILE & SETTINGS VIEW
// ─────────────────────────────────────────────────────────────────────────────

import { useTokens, useTheme } from "../core/hooks.js";
import { useBreakpoint } from "../core/hooks.js";
import { I } from "../core/icons.jsx";

const AVATAR_PALETTES = [
  ["#3b1d8a","#c4b5fd"], ["#065f46","#6ee7b7"], ["#7c2d12","#fb923c"],
  ["#1e3a5f","#93c5fd"], ["#701a75","#f0abfc"], ["#1a3a2f","#86efac"],
];

function BigAvatar({ name = "?", size = 64 }) {
  const i = (name.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  const [bg, fg] = AVATAR_PALETTES[i];
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function StatTile({ label, value, sub, color }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: t.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || t.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, sub, children }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "20px" }}>
      <h3 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: t.text }}>{title}</h3>
      {sub && <p style={{ margin: "0 0 16px", fontSize: 12, color: t.text3 }}>{sub}</p>}
      {!sub && <div style={{ marginBottom: 16 }} />}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  const t = useTokens();
  return (
    <div
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 99, cursor: "pointer", flexShrink: 0,
        background: checked ? t.accent : t.surface3,
        position: "relative", transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: checked ? "#0f0f0e" : t.text3,
        transition: "left 0.2s",
      }} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═════════════════════════════════════════════════════════════════════════════

export function ProfileView({ currentUser, tickets, notifPrefs, onUpdateNotifPrefs }) {
  const t = useTokens();
  const { dark, toggle } = useTheme();
  const { isMobile } = useBreakpoint();

  const myTickets      = tickets.filter((tk) => tk.assignee === currentUser.id);
  const myOpenTickets  = myTickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status));
  const myResolved     = myTickets.filter((tk) => ["Resolved", "Closed"].includes(tk.status));
  const myCreated      = tickets.filter((tk) => tk.reporter === currentUser.id);
  const myComments     = tickets.reduce((sum, tk) => sum + (tk.comments?.filter((c) => c.userId === currentUser.id).length || 0), 0);
  const criticalOpen   = myOpenTickets.filter((tk) => tk.priority === "Critical").length;

  const roles = (Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role]).filter(Boolean);

  const NOTIF_OPTIONS = [
    { key: "slaBreaches",    label: "SLA Breach Alerts",       desc: "When a ticket assigned to you breaches its SLA" },
    { key: "slaRisk",        label: "SLA At Risk Warnings",    desc: "When a ticket reaches 75%+ of its SLA window" },
    { key: "newAssignments", label: "New Ticket Assignments",  desc: "When a ticket is assigned to you" },
    { key: "comments",       label: "New Comments",            desc: "When someone comments on your tickets" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>

      {/* Profile card */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <BigAvatar name={currentUser.name} size={64} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>{currentUser.name}</h2>
            <div style={{ fontSize: 12, color: t.text3, marginTop: 3 }}>{currentUser.email}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {roles.map((role) => (
                <span key={role} style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: t.accentBg, color: t.accentText }}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Critical alert */}
      {criticalOpen > 0 && (
        <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: t.red, flexShrink: 0 }}><I name="incident" size={16} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.redText }}>
            {criticalOpen} critical ticket{criticalOpen !== 1 ? "s" : ""} assigned to you require immediate attention.
          </span>
        </div>
      )}

      {/* My activity stats */}
      <Section title="My Activity" sub={null}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
          <StatTile label="Assigned"  value={myTickets.length}  sub={`${myOpenTickets.length} open`}  color={t.blue}   />
          <StatTile label="Resolved"  value={myResolved.length} sub="tickets closed by me"            color={t.green}  />
          <StatTile label="Created"   value={myCreated.length}  sub="tickets reported"                color={t.accent} />
          <StatTile label="Comments"  value={myComments}        sub="total comments added"            color={t.purple} />
        </div>
      </Section>

      {/* Notification preferences */}
      <Section title="Notification Preferences" sub="Choose which in-app notifications you receive.">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {NOTIF_OPTIONS.map((pref) => (
            <div
              key={pref.key}
              onClick={() => onUpdateNotifPrefs({ ...notifPrefs, [pref.key]: !notifPrefs[pref.key] })}
              style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}`, transition: "border-color 0.15s" }}
            >
              <Toggle checked={!!notifPrefs[pref.key]} onChange={() => onUpdateNotifPrefs({ ...notifPrefs, [pref.key]: !notifPrefs[pref.key] })} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{pref.label}</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{pref.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" sub="Customize how the app looks.">
        <button
          onClick={toggle}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
            cursor: "pointer", fontFamily: t.font, color: t.text,
          }}
        >
          <I name={dark ? "sun" : "moon"} size={16} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{dark ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
        </button>
      </Section>

    </div>
  );
}
