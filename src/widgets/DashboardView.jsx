// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD: Customiser modal + DashboardView layout
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
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

export function DashboardView({ tickets, articles, users, currentUser, layout, sizeOverrides = {}, onLayoutChange, onSizeChange, onCustomise, onOpenTicket, onNewTicket }) {
  const t = useTokens();
  const { isMobile, isTablet } = useBreakpoint();
  const [arrangeMode, setArrangeMode] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const gridRef = useRef(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const cols = isMobile ? 1 : isTablet ? 2 : 4;
  const gridGap = 12;
  const baseRowHeight = 116;

  const moveWidget = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = layout.indexOf(fromId);
    const toIndex = layout.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...layout];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onLayoutChange?.(next);
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getDefaultSizing = (size) => {
    if (size === "sm") return { colSpan: 1, rowSpan: 1 };
    if (size === "md") return { colSpan: 2, rowSpan: 2 };
    if (size === "lg") return { colSpan: 3, rowSpan: 2 };
    if (size === "xl") return { colSpan: 4, rowSpan: 3 };
    return { colSpan: 2, rowSpan: 2 };
  };

  const getWidgetSizing = (widgetId, baseSize) => {
    const defaults = getDefaultSizing(baseSize);
    const override = sizeOverrides[widgetId];

    // Backward compatibility for old size string overrides.
    if (typeof override === "string") {
      const fromString = getDefaultSizing(override);
      return {
        colSpan: clamp(isMobile ? 1 : fromString.colSpan, 1, cols),
        rowSpan: clamp(fromString.rowSpan, 1, 4),
      };
    }

    const next = {
      colSpan: clamp(Number(override?.colSpan || defaults.colSpan), 1, cols),
      rowSpan: clamp(Number(override?.rowSpan || defaults.rowSpan), 1, 4),
    };

    if (isMobile) next.colSpan = 1;
    return next;
  };

  useEffect(() => {
    if (!resizing) return undefined;

    const onMouseMove = (event) => {
      const gridWidth = gridRef.current?.clientWidth || 1;
      const colWidth = (gridWidth - (gridGap * (cols - 1))) / cols;
      const colUnit = colWidth + gridGap;
      const rowUnit = baseRowHeight + gridGap;

      const dx = event.clientX - resizing.startX;
      const dy = event.clientY - resizing.startY;
      const nextColSpan = clamp(resizing.startColSpan + Math.round(dx / colUnit), 1, cols);
      const nextRowSpan = clamp(resizing.startRowSpan + Math.round(dy / rowUnit), 1, 4);

      onSizeChange?.(resizing.widgetId, { colSpan: isMobile ? 1 : nextColSpan, rowSpan: nextRowSpan });
    };

    const onMouseUp = () => setResizing(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [baseRowHeight, cols, gridGap, isMobile, onSizeChange, resizing]);

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
          <Btn variant="secondary" size="sm" onClick={() => setArrangeMode((v) => !v)}>
            <I name="grid" size={12} /> {arrangeMode ? "Done" : "Arrange"}
          </Btn>
          <Btn variant="secondary" size="sm" onClick={onCustomise}>
            <I name="settings" size={12} /> Customise
          </Btn>
          <Btn variant="primary" size="sm" onClick={onNewTicket}>
            <I name="plus" size={12} /> New Ticket
          </Btn>
        </div>
      </div>

      {/* Widget grid */}
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoFlow: "row dense",
          gridAutoRows: `${baseRowHeight}px`,
          gap: 12,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 12,
          background: t.surface2,
        }}
      >
        {layout.map((id) => {
          const w = ALL_WIDGETS.find((ww) => ww.id === id);
          if (!w) return null;
          const sizing = getWidgetSizing(id, w.size);
          const canResize = !isMobile && w.size !== "sm";
          const isDragTarget = arrangeMode && overId === id && dragId && dragId !== id;

          return (
            <div
              key={id}
              draggable={arrangeMode && !resizing}
              onDragStart={() => setDragId(id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => {
                if (!arrangeMode || !dragId || dragId === id) return;
                e.preventDefault();
                setOverId(id);
              }}
              onDrop={(e) => {
                if (!arrangeMode) return;
                e.preventDefault();
                moveWidget(dragId, id);
                setDragId(null);
                setOverId(null);
              }}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gridColumn: `span ${sizing.colSpan}`,
                gridRow: `span ${sizing.rowSpan}`,
                opacity: arrangeMode && dragId === id ? 0.55 : 1,
                transform: isDragTarget ? "scale(1.01)" : "scale(1)",
                transition: "opacity 0.12s ease, transform 0.12s ease",
                cursor: arrangeMode ? "grab" : "default",
              }}
            >
              <Card style={{
                height: "100%",
                flex: 1,
                minHeight: 0,
                border: arrangeMode ? `1px dashed ${isDragTarget ? t.accent : t.border2}` : undefined,
                boxShadow: arrangeMode && isDragTarget ? `0 0 0 1px ${t.accent}` : undefined,
              }}>
              <DashWidget
                id={id}
                tickets={tickets}
                articles={articles}
                users={users}
                currentUser={currentUser}
                onOpenTicket={onOpenTicket}
              />
              </Card>
              {arrangeMode && (
                <div style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  display: "grid",
                  placeItems: "center",
                  color: t.text3,
                  zIndex: 3,
                  pointerEvents: "none",
                }}>
                  <I name="menu" size={10} />
                </div>
              )}
              {arrangeMode && canResize && (
                <div
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setResizing({
                      widgetId: id,
                      startX: event.clientX,
                      startY: event.clientY,
                      startColSpan: sizing.colSpan,
                      startRowSpan: sizing.rowSpan,
                    });
                  }}
                  title="Drag to resize"
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 8,
                    width: 14,
                    height: 14,
                    borderRight: `2px solid ${t.text3}`,
                    borderBottom: `2px solid ${t.text3}`,
                    borderRadius: 2,
                    cursor: "nwse-resize",
                    opacity: 0.9,
                    zIndex: 3,
                  }}
                />
              )}
            </div>
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
