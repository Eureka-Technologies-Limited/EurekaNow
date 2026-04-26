// ─────────────────────────────────────────────────────────────────────────────
// WIDGETS: CriticalList · SLARisk · MyTickets · KBRecent
// Each widget is its own exported component so it can be imported individually.
// ─────────────────────────────────────────────────────────────────────────────

import { useTokens } from "../core/hooks.js";
import { PRIORITIES } from "../core/constants.js";
import { slaPct, slaForPriority } from "../core/utils.js";
import { Avatar, PriorityBadge, StatusBadge, SLABar } from "../ui/primitives.jsx";

// ── CriticalList ──────────────────────────────────────────────────────────────
// Shows all currently open Critical tickets with a live SLA bar.

export function CriticalList({ tickets, onOpenTicket }) {
  const t = useTokens();
  const critical = tickets.filter(
    (tk) => tk.priority === "Critical" && !["Resolved", "Closed"].includes(tk.status)
  );

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
        Critical Alerts
      </div>
      {critical.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>All clear ✓</div>
      ) : (
        critical.map((tk) => (
          <button
            key={tk.id}
            onClick={() => onOpenTicket(tk)}
            style={{
              width: "100%", display: "flex", flexDirection: "column", gap: 5,
              padding: "9px 11px", background: t.redBg,
              border: `1px solid ${t.red}33`, borderRadius: 8,
              marginBottom: 7, cursor: "pointer", fontFamily: t.font, textAlign: "left",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: t.redText }}>{tk.title}</div>
            <SLABar priority={tk.priority} createdAt={tk.createdAt} />
          </button>
        ))
      )}
    </div>
  );
}

// ── SLARisk ───────────────────────────────────────────────────────────────────
// Shows open tickets where ≥50% of SLA time has elapsed, worst-first.

export function SLARisk({ tickets, onOpenTicket }) {
  const t = useTokens();
  const atRisk = tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => ({ ...tk, pct: slaPct(tk.createdAt, slaForPriority(tk.priority)) }))
    .filter((tk) => tk.pct >= 50)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
        SLA at Risk
      </div>
      {atRisk.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No SLA risk.</div>
      ) : (
        atRisk.map((tk) => (
          <button
            key={tk.id}
            onClick={() => onOpenTicket(tk)}
            style={{
              width: "100%", display: "flex", flexDirection: "column", gap: 5,
              padding: "7px 0", background: "none", border: "none",
              borderBottom: `1px solid ${t.border}`, cursor: "pointer",
              fontFamily: t.font, textAlign: "left", marginBottom: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{tk.title}</div>
            <SLABar priority={tk.priority} createdAt={tk.createdAt} />
          </button>
        ))
      )}
    </div>
  );
}

// ── MyTickets ─────────────────────────────────────────────────────────────────
// Shows open tickets assigned to the current user.

export function MyTickets({ tickets, currentUser, onOpenTicket }) {
  const t = useTokens();
  const mine = tickets.filter(
    (tk) => tk.assignee === currentUser.id && !["Resolved", "Closed"].includes(tk.status)
  );

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
        My Open Tickets
      </div>
      {mine.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No assigned tickets.</div>
      ) : (
        mine.map((tk, i) => (
          <button
            key={tk.id}
            onClick={() => onOpenTicket(tk)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
              background: "none", border: "none",
              borderTop: i > 0 ? `1px solid ${t.border}` : "none",
              cursor: "pointer", fontFamily: t.font, textAlign: "left", width: "100%",
            }}
          >
            <PriorityBadge priority={tk.priority} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: t.text, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {tk.title}
            </span>
            <StatusBadge status={tk.status} />
          </button>
        ))
      )}
    </div>
  );
}

// ── KBRecent ──────────────────────────────────────────────────────────────────
// Shows the 4 most recently created knowledge base articles.

export function KBRecent({ articles, users }) {
  const t = useTokens();
  const recent = [...articles].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
        Recent KB Articles
      </div>
      {recent.map((a, i) => {
        const author = users.find((u) => u.id === a.author);
        return (
          <div key={a.id} style={{ padding: "7px 0", borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{a.title}</div>
            <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>{a.category} · {author?.name}</div>
          </div>
        );
      })}
    </div>
  );
}
