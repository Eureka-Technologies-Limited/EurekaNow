import { useEffect, useMemo, useRef, useState } from "react";
import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";

const NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",        icon: "grid"        },
  { id: "incidents",   label: "Incidents",         icon: "incident"    },
  { id: "requests",    label: "Service Requests",  icon: "request"     },
  { id: "changes",     label: "Change Requests",   icon: "change"      },
  { id: "problems",    label: "Problems",          icon: "problem"     },
  { id: "tasks",       label: "Tasks",             icon: "task"        },
  { id: "all_tickets", label: "All Tickets",       icon: "ticket"      },
  { id: "kanban",      label: "Kanban Board",      icon: "kanban"      },
  { id: "teams",       label: "Teams & Orgs",      icon: "teams"       },
  { id: "kb",          label: "Knowledge Base",    icon: "kb"          },
  { id: "reports",     label: "Reports",           icon: "chart"       },
  { id: "profile",     label: "My Profile",        icon: "user-circle" },
];

export function CommandPalette({ open, onClose, tickets, articles, setView, onOpenTicket, onNewTicket }) {
  const t = useTokens();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        { type: "action", id: "new_ticket", label: "Create New Ticket", sub: "Open the new ticket form", icon: "plus" },
        ...NAV_ITEMS.slice(0, 5).map((n) => ({ type: "nav", id: `nav_${n.id}`, label: n.label, sub: "Navigate to page", icon: n.icon, view: n.id })),
        ...tickets
          .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
          .slice(0, 5)
          .map((tk) => ({ type: "ticket", id: tk.id, label: tk.title, sub: `${tk.number} · ${tk.status} · ${tk.priority}`, ticket: tk })),
      ];
    }
    const ticketResults = tickets
      .filter((tk) =>
        tk.title.toLowerCase().includes(q) ||
        tk.number.toLowerCase().includes(q) ||
        (tk.description || "").toLowerCase().includes(q)
      )
      .slice(0, 7)
      .map((tk) => ({ type: "ticket", id: tk.id, label: tk.title, sub: `${tk.number} · ${tk.status} · ${tk.priority}`, ticket: tk }));
    const articleResults = articles
      .filter((a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
      .slice(0, 4)
      .map((a) => ({ type: "article", id: `a_${a.id}`, label: a.title, sub: `KB · ${a.category}`, article: a }));
    const navResults = NAV_ITEMS
      .filter((n) => n.label.toLowerCase().includes(q))
      .map((n) => ({ type: "nav", id: `nav_${n.id}`, label: n.label, sub: "Navigate to page", icon: n.icon, view: n.id }));
    return [...ticketResults, ...articleResults, ...navResults];
  }, [query, tickets, articles]);

  useEffect(() => { setCursor(0); }, [results]);

  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const handleSelect = (item) => {
    if (item.type === "ticket")  { onOpenTicket(item.ticket); onClose(); }
    else if (item.type === "article") { setView("kb"); onClose(); }
    else if (item.type === "nav")     { setView(item.view); onClose(); }
    else if (item.type === "action")  { onNewTicket(); onClose(); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape")    { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && results[cursor]) { handleSelect(results[cursor]); }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, calc(100vw - 32px))", background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: 14,
          boxShadow: "0 30px 80px rgba(0,0,0,0.3)", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${t.border}` }}>
          <span style={{ color: t.text3, flexShrink: 0, display: "flex" }}><I name="search" size={17} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tickets, articles, navigate…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: t.text, fontFamily: t.font }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, padding: 0, display: "flex", lineHeight: 1 }}>
              <I name="x" size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 380, overflowY: "auto", padding: "4px 0" }}>
          {results.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: t.text3, fontSize: 13 }}>No results for &ldquo;{query}&rdquo;</div>
          ) : (
            results.map((item, i) => {
              const isActive = cursor === i;
              const iconName = item.type === "ticket" ? "ticket" : item.type === "article" ? "kb" : (item.icon || "chev-right");
              const iconColor = item.type === "action" ? (isActive ? t.accentText : t.accent) : (isActive ? t.accentText : t.text2);
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "9px 14px", cursor: "pointer",
                    background: isActive ? t.accentBg : "transparent",
                    transition: "background 0.07s",
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? t.accent + "22" : t.surface2, color: iconColor }}>
                    <I name={iconName} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: t.text3, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.sub}</div>
                  </div>
                  {isActive && (
                    <span style={{ flexShrink: 0, background: t.accent + "22", border: `1px solid ${t.accent}44`, borderRadius: 4, padding: "1px 6px", fontSize: 11, color: t.accentText, fontWeight: 700 }}>↵</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard hints */}
        <div style={{ padding: "7px 14px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 14, fontSize: 11, color: t.text3 }}>
          {[["↑↓", "navigate"], ["↵", "open"], ["ESC", "close"]].map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <kbd style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 4, padding: "1px 5px", fontFamily: t.mono, fontSize: 10, color: t.text2 }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
