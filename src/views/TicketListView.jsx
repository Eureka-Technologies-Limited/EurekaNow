// ─────────────────────────────────────────────────────────────────────────────
// VIEW: TicketListView
// Shared list view for all ticket types (Incidents, Requests, etc).
// Shows a card list on mobile and a data table on desktop.
// typeFilter = null → All Tickets; typeFilter = "Incident" → Incidents only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, STATUSES } from "../core/constants.js";
import { slaPct } from "../core/utils.js";
import { Avatar, Btn, Card, PriorityBadge, StatusBadge, TypeBadge, SLABar } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

const TYPE_ICON = {
  Incident:        "incident",
  "Service Request":"request",
  "Change Request": "change",
  Problem:          "problem",
  Task:             "task",
};

export function TicketListView({ typeFilter, tickets, users, onOpenTicket, onNewTicket, priorityCatalog }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const catalog = (priorityCatalog && Object.keys(priorityCatalog).length) ? priorityCatalog : PRIORITIES;
  const priorityOrder = Object.keys(catalog);

  const [search,      setSearch]      = useState("");
  const [searchMode,  setSearchMode]  = useState("smart");
  const [fStatus,     setFStatus]     = useState("All");
  const [fPriority,   setFPriority]   = useState("All");
  const [sortBy,      setSortBy]      = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const label = typeFilter || "All Tickets";

  const filtered = tickets
    .filter((tk) => !typeFilter || tk.type === typeFilter)
    .filter((tk) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const reporter = users.find((u) => u.id === tk.reporter);
      const haystack = `${tk.id} ${tk.title} ${tk.description || ""} ${(tk.tags || []).join(" ")} ${reporter?.name || ""}`.toLowerCase();
      if (searchMode === "exact") return haystack.includes(search.trim().toLowerCase());
      if (searchMode === "id") return tk.id.toLowerCase().includes(q);
      if (searchMode === "tag") return (tk.tags || []).some((tag) => String(tag).toLowerCase().includes(q));
      if (searchMode === "reporter") return (reporter?.name || "").toLowerCase().includes(q);
      return haystack.includes(q);
    })
    .filter((tk) => fStatus   === "All" || tk.status   === fStatus)
    .filter((tk) => fPriority === "All" || tk.priority === fPriority)
    .sort((a, b) => {
      if (sortBy === "newest")   return b.createdAt - a.createdAt;
      if (sortBy === "oldest")   return a.createdAt - b.createdAt;
      if (sortBy === "priority") return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      if (sortBy === "sla")      return slaPct(b.createdAt, catalog[b.priority]?.sla ?? 24) - slaPct(a.createdAt, catalog[a.priority]?.sla ?? 24);
      return 0;
    });

  const inputStyle = { background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, color: t.text, outline: "none", fontFamily: t.font };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {typeFilter && <span style={{ color: t.text2 }}><I name={TYPE_ICON[typeFilter] || "ticket"} size={18} /></span>}
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, margin: 0, color: t.text }}>{label}</h1>
          <span style={{ fontSize: 12, color: t.text3 }}>({filtered.length})</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isMobile && (
            <Btn variant="secondary" size="sm" onClick={() => setShowFilters((f) => !f)}>
              <I name="filter" size={12} />
            </Btn>
          )}
          <Btn variant="primary" size="sm" onClick={onNewTicket}>
            <I name="plus" size={12} />
            {!isMobile && ` New ${typeFilter || "Ticket"}`}
          </Btn>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.text3 }}>
          <I name="search" size={13} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          ["smart", "Smart"],
          ["exact", "Exact phrase"],
          ["id", "Ticket ID"],
          ["tag", "Tag"],
          ["reporter", "Reporter"],
        ].map(([id, labelText]) => (
          <button
            key={id}
            onClick={() => setSearchMode(id)}
            style={{
              background: searchMode === id ? t.accentBg : t.surface2,
              color: searchMode === id ? t.accentText : t.text3,
              border: `1px solid ${searchMode === id ? t.accent : t.border}`,
              borderRadius: 99,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: t.font,
            }}
          >
            {labelText}
          </button>
        ))}
      </div>

      {/* Filters (collapsible on mobile) */}
      {(!isMobile || showFilters) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { v: fStatus,   s: setFStatus,   o: ["All", ...STATUSES]                    },
            { v: fPriority, s: setFPriority, o: ["All", ...Object.keys(catalog)]      },
            { v: sortBy,    s: setSortBy,     o: [["newest","Newest"],["oldest","Oldest"],["priority","Priority"],["sla","SLA Risk"]] },
          ].map((f, i) => (
            <select
              key={i}
              value={f.v}
              onChange={(e) => f.s(e.target.value)}
              style={{ ...inputStyle, flex: isMobile ? "1" : undefined, minWidth: isMobile ? 0 : 110 }}
            >
              {f.o.map((o) =>
                Array.isArray(o)
                  ? <option key={o[0]} value={o[0]}>{o[1]}</option>
                  : <option key={o}>{o}</option>
              )}
            </select>
          ))}
        </div>
      )}

      {/* ── MOBILE: card list ─────────────────────────────────────────────────── */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.text3, fontSize: 13 }}>
              No tickets match your filters.
            </div>
          )}
          {filtered.map((tk) => {
            const assignee = users.find((u) => u.id === tk.assignee);
            return (
              <button
                key={tk.id}
                onClick={() => onOpenTicket(tk)}
                style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: 12, padding: "12px 14px",
                  cursor: "pointer", fontFamily: t.font, textAlign: "left",
                  borderLeft: `3px solid ${PRIORITIES[tk.priority]?.color || "#888"}`,
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3, lineHeight: 1.3 }}>{tk.title}</div>
                    <div style={{ fontSize: 10, color: t.text3, fontFamily: t.mono }}>{tk.id}</div>
                  </div>
                  {assignee && <Avatar name={assignee.name} size={26} fs={9} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <TypeBadge type={tk.type} />
                  <PriorityBadge priority={tk.priority} />
                  <StatusBadge status={tk.status} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={catalog[tk.priority]?.sla} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── DESKTOP: data table ──────────────────────────────────────────────── */
        <Card noPad>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "3px 1fr 110px 90px 110px 90px 140px",
            padding: "10px 16px",
            borderBottom: `1px solid ${t.border}`,
            background: t.surface2,
          }}>
            {["", "Title", "Type", "Priority", "Status", "Agent", "SLA"].map((h) => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3 }}>
                {h}
              </span>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.text3, fontSize: 13 }}>
              No tickets match your filters.
            </div>
          )}

          {filtered.map((tk, i) => {
            const agent = users.find((u) => u.id === tk.assignee);
            return (
              <button
                key={tk.id}
                onClick={() => onOpenTicket(tk)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "3px 1fr 110px 90px 110px 90px 140px",
                  alignItems: "center",
                  padding: "11px 16px",
                  background: "none", border: "none",
                  borderTop: i > 0 ? `1px solid ${t.border}` : "none",
                  cursor: "pointer", fontFamily: t.font, textAlign: "left",
                }}
              >
                <span style={{ width: 3, height: 28, borderRadius: 99, background: catalog[tk.priority]?.color || "#888", display: "block" }} />
                <div style={{ paddingRight: 12, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tk.title}
                  </div>
                  <div style={{ fontSize: 10, color: t.text3, fontFamily: t.mono, marginTop: 1 }}>
                    {tk.id}
                  </div>
                </div>
                <span><TypeBadge type={tk.type} /></span>
                <span><PriorityBadge priority={tk.priority} /></span>
                <span><StatusBadge status={tk.status} /></span>
                <span>{agent ? <Avatar name={agent.name} size={24} fs={8} /> : <span style={{ color: t.text3 }}>—</span>}</span>
                <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={catalog[tk.priority]?.sla} />
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
