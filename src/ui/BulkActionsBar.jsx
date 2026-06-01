import { useState } from "react";
import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Btn } from "./primitives.jsx";

export function BulkActionsBar({ selectedCount, onClearSelection, onBulkStatusChange, onBulkAssign, statuses, assignments }) {
  const t = useTokens();
  const [nextStatus, setNextStatus] = useState("");
  const [nextAssignee, setNextAssignee] = useState("");

  const selectWrapStyle = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    minWidth: 170,
  };

  const selectStyle = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    background: t.surface,
    border: `1px solid ${t.border2 || t.border}`,
    borderRadius: 8,
    padding: "7px 32px 7px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: t.text,
    cursor: "pointer",
    outline: "none",
    fontFamily: t.font,
    lineHeight: 1.2,
    minHeight: 32,
    width: "100%",
    boxSizing: "border-box",
  };

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
        <div style={selectWrapStyle}>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="">Change status...</option>
            {statuses?.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span style={{
            position: "absolute",
            right: 10,
            pointerEvents: "none",
            color: t.text3,
            display: "inline-flex",
            alignItems: "center",
          }}>
            <I name="chev-down" size={12} />
          </span>
        </div>
        <Btn
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!nextStatus) return;
            onBulkStatusChange?.(nextStatus);
            setNextStatus("");
          }}
          disabled={!nextStatus}
          style={{ color: t.accentText, borderColor: t.accent }}
        >
          Apply
        </Btn>

        {assignments && (
          <>
            <div style={selectWrapStyle}>
              <select
                value={nextAssignee}
                onChange={(e) => setNextAssignee(e.target.value)}
                style={selectStyle}
              >
                <option value="">Assign to...</option>
                <option value="__unassign">Unassign</option>
                {assignments?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span style={{
                position: "absolute",
                right: 10,
                pointerEvents: "none",
                color: t.text3,
                display: "inline-flex",
                alignItems: "center",
              }}>
                <I name="chev-down" size={12} />
              </span>
            </div>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!nextAssignee) return;
                onBulkAssign?.(nextAssignee);
                setNextAssignee("");
              }}
              disabled={!nextAssignee}
              style={{ color: t.accentText, borderColor: t.accent }}
            >
              Apply
            </Btn>
          </>
        )}

        <Btn variant="ghost" size="sm" onClick={onClearSelection} style={{ color: t.accentText }}>
          <I name="close" size={12} />
        </Btn>
      </div>
    </div>
  );
}

export default BulkActionsBar;
