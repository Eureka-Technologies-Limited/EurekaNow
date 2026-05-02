import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Btn } from "./primitives.jsx";

export function BulkActionsBar({ selectedCount, onClearSelection, onBulkStatusChange, onBulkAssign, statuses, assignments }) {
  const t = useTokens();

  if (selectedCount === 0) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 16px",
      background: t.accentBg,
      borderRadius: 9,
      marginBottom: 12,
      border: `1px solid ${t.accent}`,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.accentText }}>
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          style={{
            fontSize: 11,
            background: "none",
            border: "none",
            color: t.accentText,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          onChange={(e) => e.target.value && onBulkStatusChange?.(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: `1px solid ${t.accent}`,
            borderRadius: 6,
            padding: "6px 9px",
            fontSize: 12,
            color: t.accentText,
            cursor: "pointer",
            outline: "none",
            fontFamily: t.font,
          }}
          defaultValue=""
        >
          <option value="">Change status...</option>
          {statuses?.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {assignments && (
          <select
            onChange={(e) => e.target.value && onBulkAssign?.(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: `1px solid ${t.accent}`,
              borderRadius: 6,
              padding: "6px 9px",
              fontSize: 12,
              color: t.accentText,
              cursor: "pointer",
              outline: "none",
              fontFamily: t.font,
            }}
            defaultValue=""
          >
            <option value="">Assign to...</option>
            <option value="">Unassign</option>
            {assignments?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        <Btn variant="ghost" size="sm" onClick={onClearSelection} style={{ color: t.accentText }}>
          <I name="close" size={12} />
        </Btn>
      </div>
    </div>
  );
}
