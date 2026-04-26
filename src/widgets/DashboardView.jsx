// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD: Customiser modal + DashboardView layout
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { Card, Btn, Modal } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { ALL_WIDGETS } from "./registry.js";
import { DashWidget } from "./DashWidget.jsx";

// ── DashCustomiser ────────────────────────────────────────────────────────────
// Modal that lets users toggle which widgets appear on their dashboard.

export function DashCustomiser({ layout, onSave, onClose }) {
  const t = useTokens();
  const [selected, setSelected] = useState(new Set(layout));
  const categories = [...new Set(ALL_WIDGETS.map((w) => w.cat))];

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Modal title="Customise Dashboard" onClose={onClose} width={580}>
      <p style={{ fontSize: 13, color: t.text2, marginTop: 0, marginBottom: 20 }}>
        Choose which widgets appear on your dashboard. Changes are saved to your profile.
      </p>

      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10 }}>
            {cat}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {ALL_WIDGETS.filter((w) => w.cat === cat).map((w) => {
              const active = selected.has(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggle(w.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 13px",
                    background: active ? t.accentBg : t.surface2,
                    border: `1.5px solid ${active ? t.accent : t.border}`,
                    borderRadius: 9, cursor: "pointer", fontFamily: t.font, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: active ? t.accent : t.surface3,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {active && <I name="check" size={10} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? t.accentText : t.text }}>
                      {w.label}
                    </div>
                    <div style={{ fontSize: 9, color: t.text3 }}>
                      {w.size === "sm" ? "Stat card" : w.size === "md" ? "Chart" : "List widget"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { onSave([...selected]); onClose(); }}>Save Layout</Btn>
      </div>
    </Modal>
  );
}

// ── DashboardView ─────────────────────────────────────────────────────────────
// The main dashboard page. Renders the widget grid from the user's layout.

export function DashboardView({ tickets, articles, users, currentUser, layout, onCustomise, onOpenTicket, onNewTicket }) {
  const t = useTokens();
  const { isMobile, isTablet } = useBreakpoint();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const cols = isMobile ? 1 : isTablet ? 2 : 4;

  return (
    <div>
      {/* Page header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "flex-end",
        justifyContent: "space-between", marginBottom: 20,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, margin: 0, letterSpacing: "-0.5px", color: t.text }}>
            {greeting}, {currentUser.name.split(" ")[0]}
          </h1>
          <p style={{ fontSize: 12, color: t.text3, marginTop: 4 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={onCustomise}>
            <I name="settings" size={12} /> Customise
          </Btn>
          <Btn variant="primary" size="sm" onClick={onNewTicket}>
            <I name="plus" size={12} /> New Ticket
          </Btn>
        </div>
      </div>

      {/* Widget grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
        {layout.map((id) => {
          const w = ALL_WIDGETS.find((ww) => ww.id === id);
          if (!w) return null;
          const span = isMobile ? 1 : w.size === "sm" ? 1 : Math.min(2, cols);
          return (
            <Card key={id} style={{ gridColumn: `span ${span}`, minHeight: w.size === "sm" ? 100 : 240 }}>
              <DashWidget
                id={id}
                tickets={tickets}
                articles={articles}
                users={users}
                currentUser={currentUser}
                onOpenTicket={onOpenTicket}
              />
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {layout.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: t.text3 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Dashboard is empty</div>
          <Btn variant="primary" onClick={onCustomise}>Add widgets</Btn>
        </div>
      )}
    </div>
  );
}
