// ─────────────────────────────────────────────────────────────────────────────
// WIDGET: RecentTickets
// Shows recent tickets with pagination when overflow.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { useTokens } from "../core/hooks.js";
import { PRIORITIES } from "../core/constants.js";
import { Avatar, StatusBadge } from "../ui/primitives.jsx";

export function RecentTickets({ tickets, users, onOpenTicket, priorityCatalog }) {
  const t = useTokens();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const measureHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const height = rect.height;
        
        // Each ticket is ~50px
        const itemHeight = 50;
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

  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);

  const sorted = [...tickets].sort((a, b) => b.createdAt - a.createdAt);
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const items = sorted.slice(startIdx, endIdx);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, flexShrink: 0 }}>
        Recent Tickets
      </div>
      <div style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}>
        {items.length > 0 ? (
          items.map((tk, i) => {
            const assignee = users.find((u) => u.id === tk.assignee);
            return (
              <button
                key={tk.id}
                onClick={() => onOpenTicket(tk)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0", background: "none", border: "none",
                  borderTop: i > 0 ? `1px solid ${t.border}` : "none",
                  cursor: "pointer", fontFamily: t.font, textAlign: "left", width: "100%", flexShrink: 0,
                }}
              >
                <span style={{ width: 3, height: 26, borderRadius: 99, background: (priorityCatalog?.[tk.priority] || PRIORITIES[tk.priority])?.color || "#888", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tk.title}
                  </div>
                  <div style={{ fontSize: 10, color: t.text3, marginTop: 1 }}>{tk.id}</div>
                </div>
                <StatusBadge status={tk.status} />
                {assignee && <Avatar name={assignee.name} size={20} fs={7} />}
              </button>
            );
          })
        ) : (
          <div style={{ fontSize: 12, color: t.text3, padding: "20px 0", textAlign: "center" }}>
            No tickets yet
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: t.text3, textAlign: "center" }}>
            Showing {startIdx + 1}–{Math.min(endIdx, sorted.length)} of {sorted.length} tickets
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                background: currentPage === 1 ? t.surface2 : t.surface3,
                border: `1px solid ${t.border}`,
                borderRadius: 5,
                padding: "6px 10px",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontFamily: t.font,
                fontSize: 11,
                fontWeight: 600,
                color: currentPage === 1 ? t.text3 : t.text2,
                transition: "all 0.15s ease",
              }}
            >
              ← Prev
            </button>
            
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    background: currentPage === page ? t.accent : t.surface2,
                    border: `1px solid ${currentPage === page ? t.accent : t.border}`,
                    borderRadius: 5,
                    padding: "6px 10px",
                    minWidth: 32,
                    cursor: "pointer",
                    fontFamily: t.font,
                    fontSize: 11,
                    fontWeight: currentPage === page ? 700 : 500,
                    color: currentPage === page ? "#fff" : t.text2,
                    transition: "all 0.15s ease",
                  }}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: currentPage === totalPages ? t.surface2 : t.surface3,
                border: `1px solid ${t.border}`,
                borderRadius: 5,
                padding: "6px 10px",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                fontFamily: t.font,
                fontSize: 11,
                fontWeight: 600,
                color: currentPage === totalPages ? t.text3 : t.text2,
                transition: "all 0.15s ease",
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
