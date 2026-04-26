// ─────────────────────────────────────────────────────────────────────────────
// WIDGET: RecentTickets
// Shows the 5 most recently created tickets with status and assignee.
// ─────────────────────────────────────────────────────────────────────────────

import { useTokens } from "../core/hooks.js";
import { PRIORITIES } from "../core/constants.js";
import { Avatar, StatusBadge } from "../ui/primitives.jsx";

export function RecentTickets({ tickets, users, onOpenTicket }) {
  const t = useTokens();
  const items = [...tickets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
        Recent Tickets
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((tk, i) => {
          const assignee = users.find((u) => u.id === tk.assignee);
          return (
            <button
              key={tk.id}
              onClick={() => onOpenTicket(tk)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", background: "none", border: "none",
                borderTop: i > 0 ? `1px solid ${t.border}` : "none",
                cursor: "pointer", fontFamily: t.font, textAlign: "left", width: "100%",
              }}
            >
              <span style={{ width: 3, height: 26, borderRadius: 99, background: PRIORITIES[tk.priority]?.color || "#888", flexShrink: 0 }} />
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
        })}
      </div>
    </div>
  );
}
