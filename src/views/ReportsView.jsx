// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & ANALYTICS VIEW
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useTokens } from "../core/hooks.js";
import { useBreakpoint } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { slaForPriority } from "../core/utils.js";

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({ data, color, height = 120 }) {
  const t = useTokens();
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: t.text3 }}>
        Not enough data for selected range
      </div>
    );
  }
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const W = 600, H = height;
  const padX = 4, padY = 14;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2 - 14; // 14px for x-axis labels

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padY + chartH).toFixed(1)} L ${padX} ${(padY + chartH).toFixed(1)} Z`;

  // Show at most 7 x-axis labels
  const labelStep = Math.ceil(data.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="rpt-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padX} y1={(padY + chartH * (1 - frac)).toFixed(1)}
          x2={W - padX} y2={(padY + chartH * (1 - frac)).toFixed(1)}
          stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
        />
      ))}
      <path d={areaD} fill="url(#rpt-area-grad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill={color} />
      ))}
      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null;
        return (
          <text key={`lbl-${i}`} x={points[i].x.toFixed(1)} y={H - 1} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45" fontFamily="system-ui">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────

function HBarChart({ items, color }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) {
    return <div style={{ color: t.text3, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No data for selected range</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: isMobile ? 80 : 110, fontSize: 11, color: t.text2, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.label}
          </span>
          <div style={{ flex: 1, height: 18, background: t.surface3, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(item.value / maxVal) * 100}%`, height: "100%", background: color, borderRadius: 4, minWidth: item.value > 0 ? 4 : 0, transition: "width 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.text, width: 28, textAlign: "right", flexShrink: 0 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ segments, size = 90 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: "50%", background: "#8882", flexShrink: 0 }} />;

  const cx = size / 2, cy = size / 2, r = size * 0.38, innerR = size * 0.22;
  let currentAngle = -Math.PI / 2;

  const slices = segments.map((seg) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
    return { ...seg, d };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 10, color: t.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        {icon && <span style={{ color: color || t.accent }}><I name={icon} size={15} /></span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || t.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.text3 }}>{sub}</div>}
    </div>
  );
}

// ── Section Container ─────────────────────────────────────────────────────────

function Section({ title, sub, children }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{title}</h3>
        {sub && <p style={{ margin: "3px 0 0", fontSize: 11, color: t.text3 }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ items }) {
  const t = useTokens();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
      {items.map((s) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: t.text2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{s.value}</span>
        </div>
      ))}
      {items.length === 0 && <span style={{ fontSize: 11, color: t.text3 }}>No data</span>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═════════════════════════════════════════════════════════════════════════════

export function ReportsView({ tickets, users }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [range, setRange] = useState(30);

  const now = Date.now();
  const rangeMs = range * 24 * 3600 * 1000;
  const rangeStart = now - rangeMs;

  // ── Raw data (no color tokens) ──────────────────────────────────────────────
  const raw = useMemo(() => {
    const inRange = tickets.filter((tk) => tk.createdAt >= rangeStart);
    const resolvedInRange = inRange.filter((tk) => ["Resolved", "Closed"].includes(tk.status));
    const openInRange = inRange.filter((tk) => !["Resolved", "Closed"].includes(tk.status));

    const slaBreachedCount = inRange.filter((tk) => {
      if (["Resolved", "Closed"].includes(tk.status)) return false;
      const slaHours = slaForPriority(tk.priority);
      return (now - tk.createdAt) / 3600000 > slaHours;
    }).length;

    const slaCompliance = inRange.length > 0
      ? Math.round(((inRange.length - slaBreachedCount) / inRange.length) * 100)
      : 100;

    // Volume by day — bucket into ≤30 slots
    const bucketCount = Math.min(range, 30);
    const bucketSize = rangeMs / bucketCount;
    const volumeData = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = rangeStart + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const count = inRange.filter((tk) => tk.createdAt >= bucketStart && tk.createdAt < bucketEnd).length;
      const label = new Date(bucketStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { label, value: count };
    });

    // Status / Priority / Type counts
    const statusCounts = {}, priorityCounts = {}, typeCounts = {}, categoryCounts = {};
    inRange.forEach((tk) => {
      statusCounts[tk.status]     = (statusCounts[tk.status]     || 0) + 1;
      priorityCounts[tk.priority] = (priorityCounts[tk.priority] || 0) + 1;
      typeCounts[tk.type]         = (typeCounts[tk.type]         || 0) + 1;
      const cat = tk.category || "Other";
      categoryCounts[cat]         = (categoryCounts[cat]         || 0) + 1;
    });

    // Agent workload — open tickets (all time, not just range)
    const agentOpen = {};
    tickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status)).forEach((tk) => {
      if (tk.assignee) agentOpen[tk.assignee] = (agentOpen[tk.assignee] || 0) + 1;
    });
    const agentItems = Object.entries(agentOpen)
      .map(([id, value]) => ({ label: users.find((u) => u.id === id)?.name || id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const categoryItems = Object.entries(categoryCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      total: inRange.length,
      resolved: resolvedInRange.length,
      open: openInRange.length,
      slaCompliance,
      slaBreachedCount,
      volumeData,
      statusCounts,
      priorityCounts,
      typeCounts,
      agentItems,
      categoryItems,
    };
  }, [tickets, users, rangeStart, rangeMs, range, now]);

  // ── Apply colour tokens (outside memo) ─────────────────────────────────────
  const STATUS_COLORS  = { "Open": t.blue, "In Progress": t.purple, "Pending": t.yellow, "Awaiting Approval": t.yellow, "Resolved": t.green, "Closed": t.gray };
  const PRIORITY_COLORS = { Critical: t.red, High: t.orange, Medium: t.yellow, Low: t.blue };
  const TYPE_COLORS    = { "Incident": t.red, "Service Request": t.green, "Change Request": t.orange, "Problem": t.purple, "Task": t.gray };

  const statusSegs   = Object.entries(raw.statusCounts).map(([k, v])   => ({ label: k, value: v, color: STATUS_COLORS[k]   || "#888" }));
  const prioritySegs = Object.entries(raw.priorityCounts).map(([k, v]) => ({ label: k, value: v, color: PRIORITY_COLORS[k] || "#888" }));
  const typeSegs     = Object.entries(raw.typeCounts).map(([k, v])     => ({ label: k, value: v, color: TYPE_COLORS[k]     || "#888" }));

  const slaColor = raw.slaCompliance >= 90 ? t.green : raw.slaCompliance >= 70 ? t.yellow : t.red;
  const resRate  = raw.total > 0 ? Math.round((raw.resolved / raw.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>Reports & Analytics</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: t.text3 }}>Ticket metrics and performance overview</p>
        </div>
        <div style={{ display: "flex", gap: 3, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: 3 }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              style={{
                background: range === d ? t.accent : "none",
                color: range === d ? "#0f0f0e" : t.text2,
                border: "none", borderRadius: 6, padding: "5px 12px",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: t.font,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Tickets" value={raw.total}         sub={`Created in last ${range} days`}          icon="ticket" />
        <StatCard label="Resolved"      value={raw.resolved}      sub={`${resRate}% resolution rate`}            icon="check"  color={t.green}  />
        <StatCard label="SLA Compliant" value={`${raw.slaCompliance}%`} sub={`${raw.slaBreachedCount} active breaches`} icon="clock"  color={slaColor} />
        <StatCard label="Open Tickets"  value={raw.open}          sub="Currently unresolved"                    icon="chart"  color={t.blue}   />
      </div>

      {/* Volume over time */}
      <Section title="Ticket Volume" sub={`Tickets created per day — last ${range} days`}>
        <LineChart data={raw.volumeData} color={t.accent} height={130} />
      </Section>

      {/* Distribution charts */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
        <Section title="By Status">
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}>
            <DonutChart segments={statusSegs} size={isMobile ? 72 : 90} />
            <Legend items={statusSegs} />
          </div>
        </Section>
        <Section title="By Priority">
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}>
            <DonutChart segments={prioritySegs} size={isMobile ? 72 : 90} />
            <Legend items={prioritySegs} />
          </div>
        </Section>
        <Section title="By Type">
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}>
            <DonutChart segments={typeSegs} size={isMobile ? 72 : 90} />
            <Legend items={typeSegs} />
          </div>
        </Section>
      </div>

      {/* Agent workload + Category */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Section title="Agent Workload" sub="Open tickets currently assigned per agent">
          <HBarChart items={raw.agentItems} color={t.accent} />
        </Section>
        <Section title="By Category" sub={`Ticket categories — last ${range} days`}>
          <HBarChart items={raw.categoryItems} color={t.blue} />
        </Section>
      </div>
    </div>
  );
}
