import { useState, useRef, useEffect } from "react";
import { useTokens } from "../core/hooks.js";
import { Avatar } from "./primitives.jsx";
import { checkSLAStatus } from "../core/api.js";
import { slaForPriority, findPriorityCfg } from "../core/utils.js";

export function SLAAlerts({ tickets, priorityCatalog, users }) {
  const t = useTokens();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const measureHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const height = rect.height;
        
        // Each alert is ~95px
        const itemHeight = 95;
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

  // Filter and sort issues - ONLY show breached or at-risk
  const allIssues = tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const cfg = findPriorityCfg(priorityCatalog, tk.priority);
      const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status };
    })
    .filter(({ slaStatus }) => slaStatus.isBreached || slaStatus.isRisk)
    .sort((a, b) => {
      if (a.slaStatus.isBreached !== b.slaStatus.isBreached) {
        return a.slaStatus.isBreached ? -1 : 1;
      }
      return a.slaStatus.hoursRemaining - b.slaStatus.hoursRemaining;
    });

  // Pagination
  const totalPages = Math.ceil(allIssues.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const pageItems = allIssues.slice(start, start + itemsPerPage);
  
  const breachedCount = allIssues.filter(x => x.slaStatus.isBreached).length;
  const atRiskCount = allIssues.filter(x => !x.slaStatus.isBreached).length;

  if (allIssues.length === 0) {
    return (
      <div style={{
        padding: 12,
        background: "#dcfce7",
        borderRadius: 8,
        border: "1px solid #86efac",
        color: "#166534",
        fontSize: 12,
        fontWeight: 500,
      }}>
        ✓ All SLAs on track
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, flexShrink: 0 }}>
        {breachedCount > 0 && <span style={{ color: t.red }}>{breachedCount} Breached</span>}
        {breachedCount > 0 && atRiskCount > 0 && <span> • </span>}
        {atRiskCount > 0 && <span style={{ color: t.yellow }}>{atRiskCount} At Risk</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflow: "hidden" }}>
        {pageItems.map(({ ticket, slaStatus }) => {
          const assignee = users?.find((u) => u.id === ticket.assignedTo);
          const priority = priorityCatalog?.[ticket.priority];
          const bgColor = slaStatus.isBreached ? "rgba(211, 59, 65, 0.1)" : "rgba(255, 209, 102, 0.1)";
          const borderColor = slaStatus.isBreached ? t.red : t.yellow;

          return (
            <div
              key={ticket.id}
              style={{
                padding: 12,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                backgroundColor: bgColor,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>
                    {ticket.title}
                  </div>
                  <div style={{ fontSize: 11, color: t.text2, marginTop: 4 }}>
                    #{ticket.id.slice(0, 8)} • {ticket.status}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    backgroundColor: priority?.color || t.accent,
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#fff",
                  }}
                >
                  {ticket.priority}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: t.text2 }}>
                <span style={{ color: borderColor, fontWeight: 500 }}>
                  {slaStatus.isBreached ? "⚠ Breached" : `⏱ ${Math.round(slaStatus.hoursRemaining)}h remaining`}
                </span>
                {assignee && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Avatar initials={assignee.name} size="sm" />
                    <span>{assignee.name}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
            Showing {start + 1}–{Math.min(start + itemsPerPage, allIssues.length)} of {allIssues.length}
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{
                background: page === 1 ? t.surface2 : t.surface3,
                border: `1px solid ${t.border}`,
                borderRadius: 5,
                padding: "4px 8px",
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontFamily: t.font,
                fontSize: 10,
                fontWeight: 600,
                color: page === 1 ? t.text3 : t.text2,
              }}
            >
              ← Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  background: page === p ? t.accent : t.surface2,
                  border: `1px solid ${page === p ? t.accent : t.border}`,
                  borderRadius: 4,
                  padding: "4px 8px",
                  minWidth: 28,
                  cursor: "pointer",
                  fontFamily: t.font,
                  fontSize: 10,
                  fontWeight: page === p ? 700 : 500,
                  color: page === p ? "#fff" : t.text2,
                }}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{
                background: page === totalPages ? t.surface2 : t.surface3,
                border: `1px solid ${t.border}`,
                borderRadius: 5,
                padding: "4px 8px",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                fontFamily: t.font,
                fontSize: 10,
                fontWeight: 600,
                color: page === totalPages ? t.text3 : t.text2,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
