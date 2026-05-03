// ─────────────────────────────────────────────────────────────────────────────
// WIDGETS: CriticalList · SLARisk · MyTickets · KBRecent
// Each widget is its own exported component so it can be imported individually.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { useTokens } from "../core/hooks.js";
import { slaPct, slaForPriority, findPriorityCfg } from "../core/utils.js";
import { PriorityBadge, StatusBadge, SLABar, Btn } from "../ui/primitives.jsx";
import { PRIORITIES } from "../core/constants.js";

// ── CriticalList ──────────────────────────────────────────────────────────────
// Shows all currently open Critical tickets with a live SLA bar. PAGINATED: dynamic per page based on widget height

export function CriticalList({ tickets, onOpenTicket, priorityCatalog }) {
  const t = useTokens();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const measureHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const height = rect.height;
        
        // Each alert item is ~85px + 8px gap
        const itemHeight = 93;
        const overhead = 80; // header + pagination
        const available = Math.max(0, height - overhead);
        const calculated = Math.max(1, Math.floor(available / itemHeight));
        setItemsPerPage(calculated);
      }
    };

    // Measure on mount
    const timer = setTimeout(measureHeight, 0);
    
    // Measure on resize
    const observer = new ResizeObserver(measureHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => { setPage(1); }, [itemsPerPage]);

  const catalog = Object.keys(priorityCatalog || {}).length ? priorityCatalog : PRIORITIES;
  const highestPriority = Object.entries(catalog).sort((a, b) => a[1].sla - b[1].sla)[0]?.[0] || "Critical";

  const critical = tickets.filter(
    (tk) => tk.priority === highestPriority && !["Resolved", "Closed"].includes(tk.status)
  );

  const totalPages = Math.ceil(critical.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const pageItems = critical.slice(start, start + itemsPerPage);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, flexShrink: 0, marginBottom: 10 }}>
        Critical Alerts
      </div>
      {critical.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>All clear ✓</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "hidden" }}>
            {pageItems.map((tk) => (
              <button
                key={tk.id}
                onClick={() => onOpenTicket(tk)}
                style={{
                  width: "100%", display: "flex", flexDirection: "column", gap: 5,
                  padding: "9px 11px", background: t.redBg,
                  border: `1px solid ${t.red}33`, borderRadius: 8,
                  cursor: "pointer", fontFamily: t.font, textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.redText, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tk.title}</div>
                  <StatusBadge status={tk.status} />
                </div>
                <div style={{ fontSize: 10, color: t.text3 }}>{tk.id}</div>
                <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={(findPriorityCfg(catalog, tk.priority) && Number(findPriorityCfg(catalog, tk.priority).sla) > 0) ? Number(findPriorityCfg(catalog, tk.priority).sla) : slaForPriority(tk.priority)} />
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
                Showing {start + 1}–{Math.min(start + itemsPerPage, critical.length)} of {critical.length} critical alerts
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: "4px 8px" }}>← Prev</Btn>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  p === page
                    ? <Btn key={p} variant="primary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                    : <Btn key={p} variant="secondary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                ))}

                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: "4px 8px" }}>Next →</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SLARisk ───────────────────────────────────────────────────────────────────
// Shows open tickets where ≥50% of SLA time has elapsed, worst-first. PAGINATED.

export function SLARisk({ tickets, onOpenTicket, priorityCatalog }) {
  const t = useTokens();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.getBoundingClientRect().height;
      // Each row: title (~18px) + SLABar (~16px) + padding (14px) + border = ~60px
      setItemsPerPage(Math.max(1, Math.floor((height - 80) / 60)));
    };
    const timer = setTimeout(measure, 0);
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => { setPage(1); }, [itemsPerPage]);

  const catalog = Object.keys(priorityCatalog || {}).length ? priorityCatalog : PRIORITIES;
  const atRisk = tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const cfg = findPriorityCfg(catalog, tk.priority);
      const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
      return { ...tk, pct: slaPct(tk.createdAt, slaHours) };
    })
    .filter((tk) => tk.pct >= 50)
    .sort((a, b) => b.pct - a.pct);

  const totalPages = Math.ceil(atRisk.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const pageItems = atRisk.slice(start, start + itemsPerPage);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, flexShrink: 0 }}>
        SLA at Risk
      </div>
      {atRisk.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No SLA risk.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {pageItems.map((tk) => (
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
                <div style={{ fontSize: 12, fontWeight: 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tk.title}</div>
                <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={(findPriorityCfg(catalog, tk.priority) && Number(findPriorityCfg(catalog, tk.priority).sla) > 0) ? Number(findPriorityCfg(catalog, tk.priority).sla) : slaForPriority(tk.priority)} />
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
                {start + 1}–{Math.min(start + itemsPerPage, atRisk.length)} of {atRisk.length}
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: "4px 8px" }}>← Prev</Btn>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  p === page
                    ? <Btn key={p} variant="primary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                    : <Btn key={p} variant="secondary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                ))}
                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: "4px 8px" }}>Next →</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MyTickets ─────────────────────────────────────────────────────────────────
// Shows open tickets assigned to the current user. PAGINATED.

export function MyTickets({ tickets, currentUser, onOpenTicket }) {
  const t = useTokens();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.getBoundingClientRect().height;
      // Each row: single line + padding 8px top+bottom + border = ~44px
      setItemsPerPage(Math.max(1, Math.floor((height - 80) / 44)));
    };
    const timer = setTimeout(measure, 0);
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => { setPage(1); }, [itemsPerPage]);

  const mine = tickets.filter(
    (tk) => tk.assignee === currentUser.id && !["Resolved", "Closed"].includes(tk.status)
  );

  const totalPages = Math.ceil(mine.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const pageItems = mine.slice(start, start + itemsPerPage);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, flexShrink: 0 }}>
        My Open Tickets
      </div>
      {mine.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No assigned tickets.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {pageItems.map((tk, i) => (
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
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
                {start + 1}–{Math.min(start + itemsPerPage, mine.length)} of {mine.length}
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: "4px 8px" }}>← Prev</Btn>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  p === page
                    ? <Btn key={p} variant="primary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                    : <Btn key={p} variant="secondary" size="sm" onClick={() => setPage(p)} style={{ padding: "4px 8px", minWidth: 28 }}>{p}</Btn>
                ))}
                <Btn variant="secondary" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: "4px 8px" }}>Next →</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KBRecent ──────────────────────────────────────────────────────────────────
// Shows the most recently created knowledge base articles. PAGINATED.

export function KBRecent({ articles, users }) {
  const t = useTokens();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.getBoundingClientRect().height;
      // Each row: title (~18px) + subtitle (~16px) + padding (14px) + border = ~50px
      setItemsPerPage(Math.max(1, Math.floor((height - 80) / 50)));
    };
    const timer = setTimeout(measure, 0);
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => { setPage(1); }, [itemsPerPage]);

  const sorted = [...articles].sort((a, b) => b.createdAt - a.createdAt);
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const pageItems = sorted.slice(start, start + itemsPerPage);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, flexShrink: 0 }}>
        Recent KB Articles
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No articles yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {pageItems.map((a, i) => {
              const author = users.find((u) => u.id === a.author);
              return (
                <div key={a.id} style={{ padding: "7px 0", borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>{a.category} · {author?.name}</div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
                {start + 1}–{Math.min(start + itemsPerPage, sorted.length)} of {sorted.length}
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ background: page === 1 ? t.surface2 : t.surface3, border: `1px solid ${t.border}`, borderRadius: 5, padding: "4px 8px", cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: t.font, fontSize: 10, fontWeight: 600, color: page === 1 ? t.text3 : t.text2 }}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} style={{ background: page === p ? t.accent : t.surface2, border: `1px solid ${page === p ? t.accent : t.border}`, borderRadius: 4, padding: "4px 8px", minWidth: 28, cursor: "pointer", fontFamily: t.font, fontSize: 10, fontWeight: page === p ? 700 : 500, color: page === p ? "#fff" : t.text2 }}>{p}</button>
                ))}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ background: page === totalPages ? t.surface2 : t.surface3, border: `1px solid ${t.border}`, borderRadius: 5, padding: "4px 8px", cursor: page === totalPages ? "not-allowed" : "pointer", fontFamily: t.font, fontSize: 10, fontWeight: 600, color: page === totalPages ? t.text3 : t.text2 }}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
