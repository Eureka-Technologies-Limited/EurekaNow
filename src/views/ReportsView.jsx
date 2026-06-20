// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & ANALYTICS VIEW
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useTokens } from "../core/hooks.js";
import { useBreakpoint } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Btn, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { slaForPriority, uid } from "../core/utils.js";
import { STATUSES, TICKET_TYPES, CATEGORIES } from "../core/constants.js";

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
  const chartH = H - padY * 2 - 14;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padY + chartH).toFixed(1)} L ${padX} ${(padY + chartH).toFixed(1)} Z`;
  const labelStep = Math.ceil(data.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="rpt-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line key={frac} x1={padX} y1={(padY + chartH * (1 - frac)).toFixed(1)} x2={W - padX} y2={(padY + chartH * (1 - frac)).toFixed(1)} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#rpt-area-grad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill={color} />)}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null;
        return <text key={`lbl-${i}`} x={points[i].x.toFixed(1)} y={H - 1} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45" fontFamily="system-ui">{d.label}</text>;
      })}
    </svg>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────

function HBarChart({ items, color }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <div style={{ color: t.text3, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No data for selected range</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: isMobile ? 80 : 110, fontSize: 11, color: t.text2, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          <div style={{ flex: 1, height: 18, background: t.surface3, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(item.value / maxVal) * 100}%`, height: "100%", background: item.color || color, borderRadius: 4, minWidth: item.value > 0 ? 4 : 0, transition: "width 0.3s ease" }} />
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
    currentAngle += angle;
    const endAngle = currentAngle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle),   iy2 = cy + innerR * Math.sin(endAngle);
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

function Section({ title, sub, children, action }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{title}</h3>
          {sub && <p style={{ margin: "3px 0 0", fontSize: 11, color: t.text3 }}>{sub}</p>}
        </div>
        {action}
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
// CUSTOM REPORTS ENGINE
// ═════════════════════════════════════════════════════════════════════════════

const PALETTE = [
  "#6366f1","#06b6d4","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16",
  "#64748b","#0ea5e9","#a855f7","#fb923c","#22d3ee",
];

const GROUP_OPTIONS = [
  { value: "status",   label: "Status",       isTime: false },
  { value: "priority", label: "Priority",     isTime: false },
  { value: "type",     label: "Ticket Type",  isTime: false },
  { value: "category", label: "Category",     isTime: false },
  { value: "assignee", label: "Assigned To",  isTime: false },
  { value: "reporter", label: "Opened By",    isTime: false },
  { value: "day",      label: "Day",          isTime: true  },
  { value: "week",     label: "Week",         isTime: true  },
  { value: "month",    label: "Month",        isTime: true  },
];

const DATE_FIELD_OPTIONS = [
  { value: "createdAt",  label: "Date Opened"   },
  { value: "resolvedAt", label: "Date Resolved"  },
];

const CHART_TYPES = [
  { value: "bar",   label: "Bar",   icon: "chart"  },
  { value: "donut", label: "Donut", icon: "pie"    },
  { value: "line",  label: "Line",  icon: "change" },
  { value: "table", label: "Table", icon: "kb"     },
];

const LS_KEY = "eureka_custom_reports";

function loadSavedReports() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function persistReports(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function makeDefaultConfig() {
  return {
    name: "",
    chartType: "bar",
    groupBy: "status",
    dateField: "createdAt",
    dateRange: { type: "last", days: 30 },
    filters: { status: [], priority: [], type: [], category: [], assignee: [], reporter: [] },
    sortDir: "desc",
    limit: 10,
  };
}

// ── Data computation ──────────────────────────────────────────────────────────

function buildTimeSeries(rows, groupBy, from, to, dateField) {
  if (groupBy === "month") {
    const result = [];
    const cursor = new Date(from);
    cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= to) {
      const start = cursor.getTime();
      cursor.setMonth(cursor.getMonth() + 1);
      const end = cursor.getTime();
      const label = new Date(start).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      result.push({ label, value: rows.filter(tk => (tk[dateField] ?? tk.createdAt) >= start && (tk[dateField] ?? tk.createdAt) < end).length });
    }
    return result;
  }
  const step = groupBy === "week" ? 604800000 : 86400000;
  const buckets = [];
  for (let ts = from; ts < to; ts += step) {
    const label = new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    buckets.push({ label, value: rows.filter(tk => (tk[dateField] ?? tk.createdAt) >= ts && (tk[dateField] ?? tk.createdAt) < ts + step).length });
  }
  return buckets.slice(0, 60);
}

function computeReportData(tickets, users, config) {
  const now = Date.now();
  const { dateField = "createdAt", groupBy = "status", filters = {}, sortDir = "desc", limit = 10 } = config;

  // Date bounds
  let from, to;
  if (config.dateRange?.type === "custom" && config.dateRange.from) {
    from = config.dateRange.from;
    to = config.dateRange.to || now;
  } else {
    const days = config.dateRange?.days ?? 30;
    from = now - days * 86400000;
    to = now;
  }

  // Date filter — for resolvedAt, include tickets where field exists in range
  let rows = tickets.filter(tk => {
    const ts = tk[dateField] ?? tk.createdAt;
    return ts != null && ts >= from && ts <= to;
  });

  // Field filters
  if (filters.status?.length)   rows = rows.filter(tk => filters.status.includes(tk.status));
  if (filters.priority?.length) rows = rows.filter(tk => filters.priority.includes(tk.priority));
  if (filters.type?.length)     rows = rows.filter(tk => filters.type.includes(tk.type));
  if (filters.category?.length) rows = rows.filter(tk => filters.category.includes(tk.category));
  if (filters.assignee?.length) rows = rows.filter(tk => filters.assignee.includes(tk.assignee));
  if (filters.reporter?.length) rows = rows.filter(tk => filters.reporter.includes(tk.reporter));

  const isTime = GROUP_OPTIONS.find(o => o.value === groupBy)?.isTime;
  if (isTime) {
    const data = buildTimeSeries(rows, groupBy, from, to, dateField);
    return { kind: "timeseries", data, total: rows.length };
  }

  const counts = {};
  rows.forEach(tk => {
    let key;
    if (groupBy === "assignee") key = users.find(u => u.id === tk.assignee)?.name || (tk.assignee ? "Unknown Agent" : "Unassigned");
    else if (groupBy === "reporter") key = users.find(u => u.id === tk.reporter)?.name || "Unknown";
    else key = tk[groupBy] || "Other";
    counts[key] = (counts[key] || 0) + 1;
  });

  let items = Object.entries(counts).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  items.sort((a, b) => sortDir === "asc" ? a.value - b.value : b.value - a.value);
  if (limit > 0) items = items.slice(0, limit);

  return { kind: "categorical", items, total: rows.length };
}

// ── Multi-checkbox filter ─────────────────────────────────────────────────────

function MultiFilter({ label, options, selected, onChange }) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: open ? "8px 8px 0 0" : 8, padding: "7px 10px", cursor: "pointer", fontFamily: t.font }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{label}</span>
        <span style={{ fontSize: 11, color: allSelected ? t.text3 : t.accent }}>
          {allSelected ? "All" : `${selected.length} selected`}
          <span style={{ marginLeft: 6, color: t.text3 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div style={{ border: `1px solid ${t.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: t.surface, padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" onClick={() => onChange([])} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, border: `1px solid ${allSelected ? t.accent : t.border}`, background: allSelected ? t.accentBg : t.surface2, color: allSelected ? t.accent : t.text2, cursor: "pointer", fontFamily: t.font }}>All</button>
          {options.map(opt => {
            const on = selected.includes(opt.value ?? opt);
            return (
              <button
                key={opt.value ?? opt}
                type="button"
                onClick={() => onChange(on ? selected.filter(s => s !== (opt.value ?? opt)) : [...selected, opt.value ?? opt])}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 99, border: `1px solid ${on ? t.accent : t.border}`, background: on ? t.accentBg : t.surface2, color: on ? t.accent : t.text2, cursor: "pointer", fontFamily: t.font }}
              >
                {opt.label ?? opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Report chart renderer ─────────────────────────────────────────────────────

function ReportChart({ chartType, data, compact }) {
  const t = useTokens();
  const height = compact ? 110 : 180;

  if (!data) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: t.text3, fontSize: 12 }}>Configure report to see preview</div>;

  if (chartType === "table") {
    const rows = data.kind === "timeseries" ? data.data : data.items;
    const total = data.total;
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${t.border}` }}>
              <th style={{ textAlign: "left", padding: "6px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>Label</th>
              <th style={{ textAlign: "right", padding: "6px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>Count</th>
              <th style={{ textAlign: "right", padding: "6px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${t.border}22` }}>
                <td style={{ padding: "6px 10px", color: t.text }}>{row.label}</td>
                <td style={{ padding: "6px 10px", color: t.text, textAlign: "right", fontWeight: 700 }}>{row.value}</td>
                <td style={{ padding: "6px 10px", color: t.text3, textAlign: "right" }}>{total > 0 ? `${Math.round((row.value / total) * 100)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.kind === "timeseries") {
    return <LineChart data={data.data} color={t.accent} height={height} />;
  }

  if (chartType === "donut") {
    const size = compact ? 80 : 110;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <DonutChart segments={data.items} size={size} />
        <Legend items={data.items} />
      </div>
    );
  }

  // bar
  return <HBarChart items={data.items} color={t.accent} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM REPORT BUILDER MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CustomReportBuilder({ initial, tickets, users, onSave, onCancel }) {
  const t = useTokens();
  const [cfg, setCfg] = useState(() => ({ ...makeDefaultConfig(), ...(initial || {}) }));
  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));
  const setFilter = (field, val) => setCfg(prev => ({ ...prev, filters: { ...prev.filters, [field]: val } }));
  const setDateRange = (patch) => setCfg(prev => ({ ...prev, dateRange: { ...prev.dateRange, ...patch } }));

  const isTimeSeries = GROUP_OPTIONS.find(o => o.value === cfg.groupBy)?.isTime ?? false;

  // Auto-switch chart type when groupBy changes to/from time series
  const handleGroupByChange = (val) => {
    const iT = GROUP_OPTIONS.find(o => o.value === val)?.isTime;
    const next = { ...cfg, groupBy: val };
    if (iT && cfg.chartType === "donut") next.chartType = "line";
    if (!iT && cfg.chartType === "line") next.chartType = "bar";
    setCfg(next);
  };

  // Unique values from ticket data for filter dropdowns
  const uniqueCategories = useMemo(() => [...new Set(tickets.map(tk => tk.category).filter(Boolean))].sort(), [tickets]);
  const assigneeOptions = useMemo(() => users.filter(u => tickets.some(tk => tk.assignee === u.id)).map(u => ({ value: u.id, label: u.name })), [tickets, users]);
  const reporterOptions = useMemo(() => users.filter(u => tickets.some(tk => tk.reporter === u.id)).map(u => ({ value: u.id, label: u.name })), [tickets, users]);

  // Live preview data
  const previewData = useMemo(() => {
    try { return computeReportData(tickets, users, cfg); } catch { return null; }
  }, [tickets, users, cfg]);

  const canSave = cfg.name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...cfg, name: cfg.name.trim() });
  };

  const S = { fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 16 };
  const allowedChartTypes = CHART_TYPES.filter(ct => {
    if (isTimeSeries && ct.value === "donut") return false;
    if (!isTimeSeries && ct.value === "line") return false;
    return true;
  });

  return (
    <Modal title={initial?.id ? "Edit Report" : "New Custom Report"} onClose={onCancel} width={1000}>
      <div style={{ display: "flex", gap: 0, minHeight: 520 }}>

        {/* ── Left: config panel ── */}
        <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${t.border}`, paddingRight: 20, overflowY: "auto", maxHeight: 600 }}>

          {/* Name */}
          <div style={S}>Report Name</div>
          <Input value={cfg.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Weekly Incident Volume" autoFocus />

          {/* Visualization type */}
          <div style={S}>Visualization</div>
          <div style={{ display: "flex", gap: 6 }}>
            {allowedChartTypes.map(ct => (
              <button
                key={ct.value}
                type="button"
                onClick={() => set("chartType", ct.value)}
                style={{
                  flex: 1, padding: "8px 4px", border: `2px solid ${cfg.chartType === ct.value ? t.accent : t.border}`,
                  borderRadius: 8, background: cfg.chartType === ct.value ? t.accentBg : t.surface2,
                  color: cfg.chartType === ct.value ? t.accent : t.text2, cursor: "pointer", fontFamily: t.font,
                  fontSize: 11, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <I name={ct.icon} size={16} />
                {ct.label}
              </button>
            ))}
          </div>

          {/* Group by */}
          <div style={S}>Group By</div>
          <Sel value={cfg.groupBy} onChange={e => handleGroupByChange(e.target.value)}>
            <optgroup label="Category">
              {GROUP_OPTIONS.filter(o => !o.isTime).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Over Time">
              {GROUP_OPTIONS.filter(o => o.isTime).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          </Sel>

          {/* Date field */}
          <div style={S}>Date Field</div>
          <Sel value={cfg.dateField} onChange={e => set("dateField", e.target.value)}>
            {DATE_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Sel>

          {/* Date range */}
          <div style={S}>Date Range</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[7, 30, 90, 365].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDateRange({ type: "last", days: d })}
                style={{ flex: 1, padding: "5px 2px", fontSize: 11, fontWeight: 700, border: `1px solid ${cfg.dateRange?.type === "last" && cfg.dateRange?.days === d ? t.accent : t.border}`, borderRadius: 6, background: cfg.dateRange?.type === "last" && cfg.dateRange?.days === d ? t.accentBg : t.surface2, color: cfg.dateRange?.type === "last" && cfg.dateRange?.days === d ? t.accent : t.text2, cursor: "pointer", fontFamily: t.font }}
              >
                {d === 365 ? "1y" : `${d}d`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDateRange({ type: "custom", from: Date.now() - 30 * 86400000, to: Date.now() })}
              style={{ flex: 1, padding: "5px 2px", fontSize: 11, fontWeight: 700, border: `1px solid ${cfg.dateRange?.type === "custom" ? t.accent : t.border}`, borderRadius: 6, background: cfg.dateRange?.type === "custom" ? t.accentBg : t.surface2, color: cfg.dateRange?.type === "custom" ? t.accent : t.text2, cursor: "pointer", fontFamily: t.font }}
            >
              Custom
            </button>
          </div>
          {cfg.dateRange?.type === "custom" && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>From</Label>
                <input type="date" value={cfg.dateRange.from ? new Date(cfg.dateRange.from).toISOString().slice(0, 10) : ""} onChange={e => setDateRange({ from: e.target.value ? new Date(e.target.value).getTime() : null })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 12, fontFamily: t.font }} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>To</Label>
                <input type="date" value={cfg.dateRange.to ? new Date(cfg.dateRange.to).toISOString().slice(0, 10) : ""} onChange={e => setDateRange({ to: e.target.value ? new Date(e.target.value).getTime() + 86399999 : null })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface2, color: t.text, fontSize: 12, fontFamily: t.font }} />
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={S}>Filters</div>
          <MultiFilter label="Status"   options={STATUSES.map(s => ({ value: s, label: s }))}                  selected={cfg.filters.status}   onChange={v => setFilter("status", v)} />
          <MultiFilter label="Priority" options={["Critical","High","Medium","Low"].map(p => ({ value: p, label: p }))} selected={cfg.filters.priority} onChange={v => setFilter("priority", v)} />
          <MultiFilter label="Type"     options={TICKET_TYPES.map(tp => ({ value: tp, label: tp }))}            selected={cfg.filters.type}     onChange={v => setFilter("type", v)} />
          <MultiFilter label="Category" options={uniqueCategories.map(c => ({ value: c, label: c }))}           selected={cfg.filters.category} onChange={v => setFilter("category", v)} />
          {assigneeOptions.length > 0 && <MultiFilter label="Assigned To" options={assigneeOptions} selected={cfg.filters.assignee} onChange={v => setFilter("assignee", v)} />}
          {reporterOptions.length > 0 && <MultiFilter label="Opened By"   options={reporterOptions} selected={cfg.filters.reporter} onChange={v => setFilter("reporter", v)} />}

          {/* Sort & limit (only for categorical) */}
          {!isTimeSeries && (
            <>
              <div style={S}>Sort & Limit</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Label>Order</Label>
                  <Sel value={cfg.sortDir} onChange={e => set("sortDir", e.target.value)}>
                    <option value="desc">Highest first</option>
                    <option value="asc">Lowest first</option>
                  </Sel>
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Show top</Label>
                  <Sel value={cfg.limit} onChange={e => set("limit", Number(e.target.value))}>
                    {[5, 10, 15, 20, 50, 0].map(n => <option key={n} value={n}>{n === 0 ? "All" : n}</option>)}
                  </Sel>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right: live preview ── */}
        <div style={{ flex: 1, paddingLeft: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{cfg.name || "Untitled Report"}</div>
              <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>
                {previewData ? `${previewData.total} ticket${previewData.total !== 1 ? "s" : ""} match your filters` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={!canSave}>Save Report</Btn>
            </div>
          </div>

          <div style={{ flex: 1, background: t.surface2, borderRadius: 10, border: `1px solid ${t.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {previewData && previewData.total === 0 ? (
              <div style={{ textAlign: "center", color: t.text3, fontSize: 13 }}>
                <I name="search" size={28} />
                <div style={{ marginTop: 8 }}>No tickets match your current filters</div>
              </div>
            ) : (
              <ReportChart chartType={cfg.chartType} data={previewData} />
            )}
          </div>

          {/* Data table preview below chart */}
          {previewData?.kind === "categorical" && previewData.items.length > 0 && cfg.chartType !== "table" && (
            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    <th style={{ textAlign: "left", padding: "5px 8px", color: t.text3, fontWeight: 700, fontSize: 11 }}>
                      {GROUP_OPTIONS.find(o => o.value === cfg.groupBy)?.label || cfg.groupBy}
                    </th>
                    <th style={{ textAlign: "right", padding: "5px 8px", color: t.text3, fontWeight: 700, fontSize: 11 }}>Count</th>
                    <th style={{ textAlign: "right", padding: "5px 8px", color: t.text3, fontWeight: 700, fontSize: 11 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.items.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${t.border}18` }}>
                      <td style={{ padding: "5px 8px", color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                        {row.label}
                      </td>
                      <td style={{ padding: "5px 8px", color: t.text, textAlign: "right", fontWeight: 700 }}>{row.value}</td>
                      <td style={{ padding: "5px 8px", color: t.text3, textAlign: "right" }}>{previewData.total > 0 ? `${Math.round((row.value / previewData.total) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT RUN MODAL (full saved-report viewer)
// ─────────────────────────────────────────────────────────────────────────────

function ReportRunModal({ report, tickets, users, onClose }) {
  const t = useTokens();
  const data = useMemo(() => {
    try { return computeReportData(tickets, users, report); } catch { return null; }
  }, [tickets, users, report]);

  const groupLabel = GROUP_OPTIONS.find(o => o.value === report.groupBy)?.label || report.groupBy;
  const dateLabel  = DATE_FIELD_OPTIONS.find(o => o.value === report.dateField)?.label || "Date";
  const rangeLabel = report.dateRange?.type === "custom"
    ? `${new Date(report.dateRange.from).toLocaleDateString("en-GB")} – ${new Date(report.dateRange.to).toLocaleDateString("en-GB")}`
    : `Last ${report.dateRange?.days ?? 30} days`;

  return (
    <Modal title={report.name} onClose={onClose} width={860}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Group by",   val: groupLabel  },
          { label: dateLabel,    val: rangeLabel   },
          { label: "Total",      val: data ? `${data.total} tickets` : "—" },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 10, color: t.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 16 }}>
        {data && data.total === 0 ? (
          <div style={{ textAlign: "center", color: t.text3, padding: 24, fontSize: 13 }}>No tickets match this report's filters.</div>
        ) : (
          <ReportChart chartType={report.chartType} data={data} />
        )}
      </div>

      {/* Full data table */}
      {data && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                <th style={{ textAlign: "left", padding: "7px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>{groupLabel}</th>
                <th style={{ textAlign: "right", padding: "7px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>Count</th>
                <th style={{ textAlign: "right", padding: "7px 10px", color: t.text3, fontWeight: 700, fontSize: 11 }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.kind === "categorical" ? data.items : data.data).map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.border}22`, background: i % 2 === 0 ? "transparent" : t.surface2 + "44" }}>
                  <td style={{ padding: "7px 10px", color: t.text }}>
                    {row.color && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: row.color, marginRight: 8, verticalAlign: "middle" }} />}
                    {row.label}
                  </td>
                  <td style={{ padding: "7px 10px", color: t.text, textAlign: "right", fontWeight: 700 }}>{row.value}</td>
                  <td style={{ padding: "7px 10px", color: t.text3, textAlign: "right" }}>
                    {data.total > 0 ? `${Math.round((row.value / data.total) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═════════════════════════════════════════════════════════════════════════════

export function ReportsView({ tickets, users }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [range, setRange] = useState(30);

  // Custom reports state
  const [savedReports, setSavedReports] = useState(() => loadSavedReports());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);

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

    const bucketCount = Math.min(range, 30);
    const bucketSize = rangeMs / bucketCount;
    const volumeData = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = rangeStart + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const count = inRange.filter((tk) => tk.createdAt >= bucketStart && tk.createdAt < bucketEnd).length;
      const label = new Date(bucketStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { label, value: count };
    });

    const statusCounts = {}, priorityCounts = {}, typeCounts = {}, categoryCounts = {};
    inRange.forEach((tk) => {
      statusCounts[tk.status]     = (statusCounts[tk.status]     || 0) + 1;
      priorityCounts[tk.priority] = (priorityCounts[tk.priority] || 0) + 1;
      typeCounts[tk.type]         = (typeCounts[tk.type]         || 0) + 1;
      categoryCounts[tk.category || "Other"] = (categoryCounts[tk.category || "Other"] || 0) + 1;
    });

    const agentOpen = {};
    tickets.filter((tk) => !["Resolved", "Closed"].includes(tk.status)).forEach((tk) => {
      if (tk.assignee) agentOpen[tk.assignee] = (agentOpen[tk.assignee] || 0) + 1;
    });
    const agentItems = Object.entries(agentOpen)
      .map(([id, value]) => ({ label: users.find((u) => u.id === id)?.name || id, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    const categoryItems = Object.entries(categoryCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    return { total: inRange.length, resolved: resolvedInRange.length, open: openInRange.length, slaCompliance, slaBreachedCount, volumeData, statusCounts, priorityCounts, typeCounts, agentItems, categoryItems };
  }, [tickets, users, rangeStart, rangeMs, range, now]);

  const STATUS_COLORS   = { "Open": t.blue, "In Progress": t.purple, "Pending": t.yellow, "Awaiting Approval": t.yellow, "Resolved": t.green, "Closed": t.gray };
  const PRIORITY_COLORS = { Critical: t.red, High: t.orange, Medium: t.yellow, Low: t.blue };
  const TYPE_COLORS     = { "Incident": t.red, "Service Request": t.green, "Change Request": t.orange, "Problem": t.purple, "Task": t.gray };

  const statusSegs   = Object.entries(raw.statusCounts).map(([k, v])   => ({ label: k, value: v, color: STATUS_COLORS[k]   || "#888" }));
  const prioritySegs = Object.entries(raw.priorityCounts).map(([k, v]) => ({ label: k, value: v, color: PRIORITY_COLORS[k] || "#888" }));
  const typeSegs     = Object.entries(raw.typeCounts).map(([k, v])     => ({ label: k, value: v, color: TYPE_COLORS[k]     || "#888" }));

  const slaColor = raw.slaCompliance >= 90 ? t.green : raw.slaCompliance >= 70 ? t.yellow : t.red;
  const resRate  = raw.total > 0 ? Math.round((raw.resolved / raw.total) * 100) : 0;

  // ── Custom report handlers ──────────────────────────────────────────────────

  const handleSaveReport = (config) => {
    const isEdit = !!editingReport?.id;
    const report = {
      ...config,
      id: isEdit ? editingReport.id : `rpt_${uid()}`,
      createdAt: isEdit ? editingReport.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    const next = isEdit
      ? savedReports.map(r => r.id === report.id ? report : r)
      : [report, ...savedReports];
    setSavedReports(next);
    persistReports(next);
    setBuilderOpen(false);
    setEditingReport(null);
  };

  const handleDeleteReport = (id) => {
    const next = savedReports.filter(r => r.id !== id);
    setSavedReports(next);
    persistReports(next);
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    setBuilderOpen(true);
  };

  const CHART_ICON = { bar: "chart", donut: "pie", line: "change", table: "kb" };

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
            <button key={d} onClick={() => setRange(d)} style={{ background: range === d ? t.accent : "none", color: range === d ? "#0f0f0e" : t.text2, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: t.font }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Tickets"  value={raw.total}               sub={`Created in last ${range} days`}          icon="ticket" />
        <StatCard label="Resolved"       value={raw.resolved}            sub={`${resRate}% resolution rate`}            icon="check"  color={t.green}  />
        <StatCard label="SLA Compliant"  value={`${raw.slaCompliance}%`} sub={`${raw.slaBreachedCount} active breaches`} icon="clock"  color={slaColor} />
        <StatCard label="Open Tickets"   value={raw.open}                sub="Currently unresolved"                     icon="chart"  color={t.blue}   />
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

      {/* ── Custom Reports ── */}
      <Section
        title="Custom Reports"
        sub="Build reports with any combination of filters, groupings, and chart types"
        action={
          <Btn variant="primary" size="sm" onClick={() => { setEditingReport(null); setBuilderOpen(true); }}>
            <I name="plus" size={12} /> New Report
          </Btn>
        }
      >
        {savedReports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: t.text3 }}>
            <I name="chart" size={32} />
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: t.text }}>No custom reports yet</div>
            <div style={{ marginTop: 4, fontSize: 12 }}>Click "New Report" to build your first report</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {savedReports.map(report => {
              const groupLabel = GROUP_OPTIONS.find(o => o.value === report.groupBy)?.label || report.groupBy;
              const rangeLabel = report.dateRange?.type === "custom" ? "Custom range" : `Last ${report.dateRange?.days ?? 30}d`;
              const activeFilters = Object.entries(report.filters || {}).filter(([, v]) => v?.length > 0).length;
              return (
                <div key={report.id} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden" }}>
                  {/* Mini chart preview */}
                  <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${t.border}22` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.name}</div>
                        <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>
                          {groupLabel} · {rangeLabel}{activeFilters > 0 ? ` · ${activeFilters} filter${activeFilters > 1 ? "s" : ""}` : ""}
                        </div>
                      </div>
                      <span style={{ color: t.text3, flexShrink: 0 }}>
                        <I name={CHART_ICON[report.chartType] || "chart"} size={14} />
                      </span>
                    </div>
                    <ReportChart
                      chartType={report.chartType}
                      data={computeReportData(tickets, users, report)}
                      compact
                    />
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 0 }}>
                    <button onClick={() => setViewingReport(report)} style={{ flex: 1, padding: "9px 6px", fontSize: 12, fontWeight: 600, background: "none", border: "none", borderRight: `1px solid ${t.border}22`, color: t.accent, cursor: "pointer", fontFamily: t.font }}>
                      <I name="search" size={12} /> View
                    </button>
                    <button onClick={() => handleEditReport(report)} style={{ flex: 1, padding: "9px 6px", fontSize: 12, fontWeight: 600, background: "none", border: "none", borderRight: `1px solid ${t.border}22`, color: t.text2, cursor: "pointer", fontFamily: t.font }}>
                      <I name="settings" size={12} /> Edit
                    </button>
                    <button onClick={() => handleDeleteReport(report.id)} style={{ flex: 1, padding: "9px 6px", fontSize: 12, fontWeight: 600, background: "none", border: "none", color: t.red, cursor: "pointer", fontFamily: t.font }}>
                      <I name="trash" size={12} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Builder modal */}
      {builderOpen && (
        <CustomReportBuilder
          initial={editingReport}
          tickets={tickets}
          users={users}
          onSave={handleSaveReport}
          onCancel={() => { setBuilderOpen(false); setEditingReport(null); }}
        />
      )}

      {/* Run/view modal */}
      {viewingReport && (
        <ReportRunModal
          report={viewingReport}
          tickets={tickets}
          users={users}
          onClose={() => setViewingReport(null)}
        />
      )}
    </div>
  );
}
