// ─────────────────────────────────────────────────────────────────────────────
// WIDGET: StatWidget
// Renders a single large-number stat card.
// Handles: stat_open, stat_mine, stat_critical, stat_resolved,
//          stat_incidents, stat_requests
// ─────────────────────────────────────────────────────────────────────────────

import { useTokens } from "../core/hooks.js";
import { hrs } from "../core/utils.js";

export function StatWidget({ id, tickets, currentUser }) {
  const t = useTokens();
  const open = tickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status));

  const definitions = {
    stat_open:      { label: "Open Tickets",   value: open.length,                                                   color: t.text,      sub: "all teams"     },
    stat_mine:      { label: "Assigned to Me", value: open.filter((tk) => tk.assignee === currentUser.id).length,    color: t.accent,    sub: "need action"   },
    stat_critical:  { label: "Critical",       value: open.filter((tk) => tk.priority === "Critical").length,        color: t.red,       sub: "SLA at risk"   },
    stat_resolved:  { label: "Resolved (24h)", value: tickets.filter((tk) => tk.status === "Resolved" && tk.createdAt > hrs(24)).length, color: t.green, sub: "recently closed" },
    stat_incidents: { label: "Open Incidents", value: open.filter((tk) => tk.type === "Incident").length,            color: t.redText,   sub: "active"        },
    stat_requests:  { label: "Open Requests",  value: open.filter((tk) => tk.type === "Service Request").length,     color: t.greenText, sub: "pending"       },
  };

  const s = definitions[id];
  if (!s) return null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 90 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3 }}>
        {s.label}
      </span>
      <div>
        <div style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-1px" }}>
          {s.value}
        </div>
        <div style={{ fontSize: 10, color: t.text3, marginTop: 3 }}>{s.sub}</div>
      </div>
    </div>
  );
}
