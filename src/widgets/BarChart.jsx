// ─────────────────────────────────────────────────────────────────────────────
// WIDGET: BarChart
// Generic horizontal progress-bar chart for categorical data.
// Used by: by_status, by_priority, by_type widgets.
//
// Props:
//   label  — section heading string
//   data   — Array<{ label: string, count: number, color?: string }>
// ─────────────────────────────────────────────────────────────────────────────

import { useTokens } from "../core/hooks.js";
import { STATUSES, PRIORITIES, TICKET_TYPES } from "../core/constants.js";

export function BarChart({ data, label }) {
  const t = useTokens();
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d) => (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: t.text2 }}>{d.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{d.count}</span>
            </div>
            <div style={{ height: 5, background: t.surface3, borderRadius: 99 }}>
              <div style={{ width: `${(d.count / max) * 100}%`, height: "100%", background: d.color || t.accent, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pre-wired chart variants ──────────────────────────────────────────────────

export function ByStatusChart({ tickets }) {
  const STATUS_COLORS = {
    "Open": "#3182ce", "In Progress": "#805ad5",
    "Pending": "#d69e2e", "Resolved": "#38a169", "Closed": "#718096",
  };
  const data = STATUSES.map((s) => ({
    label: s,
    count: tickets.filter((tk) => tk.status === s).length,
    color: STATUS_COLORS[s],
  }));
  return <BarChart data={data} label="By Status" />;
}

export function ByPriorityChart({ tickets }) {
  const open = tickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status));
  const data = Object.entries(PRIORITIES).map(([p, cfg]) => ({
    label: p,
    count: open.filter((tk) => tk.priority === p).length,
    color: cfg.color,
  }));
  return <BarChart data={data} label="Open by Priority" />;
}

export function ByTypeChart({ tickets }) {
  const open = tickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status));
  const data = TICKET_TYPES.map((tp) => ({
    label: tp,
    count: open.filter((tk) => tk.type === tp).length,
  }));
  return <BarChart data={data} label="By Type" />;
}
