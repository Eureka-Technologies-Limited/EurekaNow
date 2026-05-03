import { useState } from "react";
import { useTokens } from "../core/hooks.js";
import { Btn, Modal } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

const SWATCH_COLORS = [
  "#3182ce", "#805ad5", "#d69e2e", "#e53e3e",
  "#38a169", "#718096", "#dd6b20", "#319795",
  "#d53f8c", "#2c7a7b", "#744210", "#1a365d",
];

const CARD_FIELD_OPTIONS = [
  { id: "priority", label: "Priority badge"   },
  { id: "type",     label: "Ticket type"       },
  { id: "status",   label: "Status badge"      },
  { id: "assignee", label: "Assignee avatar"   },
  { id: "sla",      label: "SLA progress bar"  },
];

// ── ColorSwatch ───────────────────────────────────────────────────────────────

function ColorSwatch({ value, onChange, colors }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 24, height: 24, borderRadius: 6, background: value,
          border: "none", cursor: "pointer", flexShrink: 0,
          boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,0.15)",
        }}
      />
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{
            position: "absolute", top: 30, left: 0, zIndex: 20,
            background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "grid", gridTemplateColumns: "repeat(4, 24px)", gap: 5,
          }}>
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                style={{
                  width: 24, height: 24, borderRadius: 5, background: c, border: "none", cursor: "pointer",
                  outline: c === value ? "2px solid #1a202c" : "none", outlineOffset: 1,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── ColumnRow ─────────────────────────────────────────────────────────────────

function ColumnRow({ col, statuses, isFirst, isLast, onChange, onToggleStatus, onRemove, onMove }) {
  const t = useTokens();

  return (
    <div style={{
      border: `1px solid ${t.border}`, borderRadius: 10,
      background: t.surface2, overflow: "hidden",
    }}>
      {/* Collapsed row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        <ColorSwatch value={col.color} onChange={(c) => onChange({ color: c })} colors={SWATCH_COLORS} />

        <input
          value={col.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 13, fontWeight: 600, color: t.text, fontFamily: t.font,
            minWidth: 0,
          }}
          placeholder="Column name"
        />

        {/* Status map chips */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 2 }}>
          {statuses.map((s) => {
            const on = col.statusMap.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggleStatus(s)}
                style={{
                  padding: "2px 8px", borderRadius: 99, fontSize: 10, cursor: "pointer",
                  fontFamily: t.font, fontWeight: on ? 700 : 400,
                  background: on ? col.color + "22" : t.surface3,
                  color: on ? col.color : t.text3,
                  border: `1px solid ${on ? col.color + "55" : "transparent"}`,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* WIP limit */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: t.text3 }}>WIP</span>
          <input
            type="number"
            min={1}
            value={col.wipLimit ?? ""}
            onChange={(e) => onChange({ wipLimit: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="∞"
            style={{
              width: 40, padding: "3px 5px", borderRadius: 5,
              border: `1px solid ${t.border}`, background: t.surface,
              fontSize: 11, color: t.text, fontFamily: t.font, textAlign: "center",
            }}
          />
        </div>

        {/* Move + remove */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={() => onMove(-1)} disabled={isFirst} style={{ background: "none", border: "none", cursor: isFirst ? "not-allowed" : "pointer", color: isFirst ? t.border : t.text3, padding: "2px 4px", borderRadius: 4 }}>↑</button>
          <button onClick={() => onMove(1)}  disabled={isLast}  style={{ background: "none", border: "none", cursor: isLast  ? "not-allowed" : "pointer", color: isLast  ? t.border : t.text3, padding: "2px 4px", borderRadius: 4 }}>↓</button>
          <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, padding: "2px 4px", borderRadius: 4 }}>
            <I name="x" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KanbanConfig ──────────────────────────────────────────────────────────────

export function KanbanConfig({ board, onSave, onClose, statuses, ticketTypes, priorities }) {
  const t = useTokens();
  const [tab,        setTab]        = useState("columns");
  const [name,       setName]       = useState(board.name);
  const [columns,    setColumns]    = useState(() => board.columns.map((c) => ({ ...c, statusMap: [...c.statusMap] })));
  const [autoAdd,    setAutoAdd]    = useState(() => ({ types: [...board.autoAdd.types], priorities: [...board.autoAdd.priorities] }));
  const [cardFields, setCardFields] = useState(() => [...board.cardFields]);

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        id:        "col_" + Date.now(),
        name:      "New Column",
        color:     SWATCH_COLORS[prev.length % SWATCH_COLORS.length],
        statusMap: [],
        wipLimit:  null,
      },
    ]);
  };

  const removeColumn = (id) => setColumns((prev) => prev.filter((c) => c.id !== id));

  const updateColumn = (id, patch) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const toggleStatusMap = (colId, status) =>
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== colId) return c;
        const map = c.statusMap.includes(status)
          ? c.statusMap.filter((s) => s !== status)
          : [...c.statusMap, status];
        return { ...c, statusMap: map };
      })
    );

  const moveColumn = (idx, dir) =>
    setColumns((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const toggleFilter = (key, value) =>
    setAutoAdd((prev) => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });

  const toggleField = (id) =>
    setCardFields((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const handleSave = () => onSave({ name, columns, autoAdd, cardFields });

  const inputStyle = {
    background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
    padding: "9px 11px", fontSize: 13, color: t.text, fontFamily: t.font, outline: "none", width: "100%", boxSizing: "border-box",
  };

  const chipStyle = (active, color) => ({
    padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
    fontFamily: t.font, fontWeight: active ? 700 : 500,
    background: active ? (color || t.accentBg) : t.surface2,
    color: active ? (color ? "#fff" : t.accentText) : t.text2,
    border: `1px solid ${active ? (color || t.accent) : t.border}`,
  });

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        background: "none", border: "none",
        borderBottom: tab === id ? `2px solid ${t.accent}` : "2px solid transparent",
        padding: "8px 16px 9px", marginBottom: -1, cursor: "pointer",
        fontFamily: t.font, fontSize: 12, fontWeight: tab === id ? 700 : 500,
        color: tab === id ? t.accent : t.text2,
      }}
    >
      {label}
    </button>
  );

  return (
    <Modal title="Configure Kanban Board" onClose={onClose} width={700}>
      {/* Board name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
          Board Name
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Sprint Board" />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${t.border}`, marginBottom: 20, display: "flex" }}>
        {tabBtn("columns", "Columns")}
        {tabBtn("filters", "Auto-Add Filters")}
        {tabBtn("fields",  "Card Fields")}
      </div>

      {/* ── COLUMNS TAB ──────────────────────────────────────────────────────── */}
      {tab === "columns" && (
        <div>
          <p style={{ fontSize: 12, color: t.text2, marginTop: 0, marginBottom: 14 }}>
            Each column maps to one or more ticket statuses. Dragging a card into a column sets the ticket's status to the first mapped status. Set a WIP limit to highlight when a column is over capacity.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {columns.map((col, idx) => (
              <ColumnRow
                key={col.id}
                col={col}
                statuses={statuses}
                isFirst={idx === 0}
                isLast={idx === columns.length - 1}
                onChange={(patch) => updateColumn(col.id, patch)}
                onToggleStatus={(s) => toggleStatusMap(col.id, s)}
                onRemove={() => removeColumn(col.id)}
                onMove={(dir) => moveColumn(idx, dir)}
              />
            ))}
          </div>
          <Btn variant="secondary" size="sm" onClick={addColumn}>
            <I name="plus" size={11} /> Add Column
          </Btn>
        </div>
      )}

      {/* ── FILTERS TAB ──────────────────────────────────────────────────────── */}
      {tab === "filters" && (
        <div>
          <p style={{ fontSize: 12, color: t.text2, marginTop: 0, marginBottom: 20 }}>
            Control which tickets automatically appear on this board. Leaving a category empty includes everything. Useful for creating focused boards like "Incidents only" or "Critical &amp; High priority".
          </p>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Ticket Types &nbsp;
              <span style={{ fontWeight: 400, color: t.text3 }}>
                ({autoAdd.types.length === 0 ? "all types" : `${autoAdd.types.length} selected`})
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ticketTypes.map((type) => (
                <button key={type} onClick={() => toggleFilter("types", type)} style={chipStyle(autoAdd.types.includes(type))}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Priority &nbsp;
              <span style={{ fontWeight: 400, color: t.text3 }}>
                ({autoAdd.priorities.length === 0 ? "all priorities" : `${autoAdd.priorities.length} selected`})
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {priorities.map((p) => (
                <button key={p} onClick={() => toggleFilter("priorities", p)} style={chipStyle(autoAdd.priorities.includes(p))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CARD FIELDS TAB ──────────────────────────────────────────────────── */}
      {tab === "fields" && (
        <div>
          <p style={{ fontSize: 12, color: t.text2, marginTop: 0, marginBottom: 20 }}>
            Choose which information appears on each card. Keep it lean for at-a-glance scanning, or show everything for richer context.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CARD_FIELD_OPTIONS.map(({ id, label }) => {
              const active = cardFields.includes(id);
              return (
                <label
                  key={id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                    background: active ? t.accentBg : t.surface2,
                    border: `1.5px solid ${active ? t.accent : t.border}`,
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: active ? t.accent : t.surface3,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <I name="check" size={10} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? t.accentText : t.text }}>
                    {label}
                  </span>
                  <input type="checkbox" checked={active} onChange={() => toggleField(id)} style={{ display: "none" }} />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 20, marginTop: 20, borderTop: `1px solid ${t.border}` }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save Board</Btn>
      </div>
    </Modal>
  );
}
