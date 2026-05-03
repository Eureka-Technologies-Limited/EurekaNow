// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — UI PRIMITIVES
// Foundational building blocks used everywhere in the app.
// These components have no business logic — they only handle presentation.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useTheme } from "../core/hooks.js";
import { useBreakpoint } from "../core/hooks.js";
import { PRIORITIES } from "../core/constants.js";
import { slaPct, slaLeft, slaColor, slaForPriority, findPriorityCfg } from "../core/utils.js";

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  ["#3b1d8a","#c4b5fd"], ["#065f46","#6ee7b7"], ["#7c2d12","#fb923c"],
  ["#1e3a5f","#93c5fd"], ["#701a75","#f0abfc"], ["#1a3a2f","#86efac"],
];

export function Avatar({ name = "?", size = 28, fs = 10 }) {
  const i = (name.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  const [bg, fg] = AVATAR_PALETTES[i];
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: fs, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({ label, color, bg, size = 11 }) {
  return (
    <span style={{
      fontSize: size, fontWeight: 600, padding: "2px 7px",
      borderRadius: 99, background: bg, color,
      display: "inline-flex", alignItems: "center",
      whiteSpace: "nowrap", lineHeight: 1.6,
    }}>
      {label}
    </span>
  );
}

// ── Semantic Badges ───────────────────────────────────────────────────────────

export function PriorityBadge({ priority, catalog }) {
  const { dark } = useTheme();
  const cfg = findPriorityCfg(catalog, priority) || PRIORITIES[priority] || {};
  const col = cfg.color || "#888";
  const bg = cfg.bg || (dark ? col + "22" : col + "18");
  return <Badge label={priority} color={col} bg={bg} />;
}

export function StatusBadge({ status }) {
  const t = useTokens();
  const map = {
    "Open":         { color: t.blueText,   bg: t.blueBg   },
    "In Progress":  { color: t.purpleText, bg: t.purpleBg },
    "Pending":      { color: t.yellowText, bg: t.yellowBg },
    "Resolved":     { color: t.greenText,  bg: t.greenBg  },
    "Closed":       { color: t.grayText,   bg: t.grayBg   },
  };
  const { color, bg } = map[status] || { color: "#888", bg: "#eee" };
  return <Badge label={status} color={color} bg={bg} />;
}

export function TypeBadge({ type }) {
  const t = useTokens();
  const map = {
    "Incident":       { color: t.redText,    bg: t.redBg    },
    "Service Request":{ color: t.greenText,  bg: t.greenBg  },
    "Change Request": { color: t.orangeText, bg: t.orangeBg },
    "Problem":        { color: t.purpleText, bg: t.purpleBg },
    "Task":           { color: t.grayText,   bg: t.grayBg   },
  };
  const { color, bg } = map[type] || { color: "#888", bg: "#eee" };
  return <Badge label={type} color={color} bg={bg} />;
}

// ── SLA Bar ───────────────────────────────────────────────────────────────────

export function SLABar({ priority, createdAt, showLabel = true, slaHours }) {
  const t = useTokens();
  const h     = Number(slaHours) > 0 ? Number(slaHours) : slaForPriority(priority);
  const pct   = slaPct(createdAt, h);
  const left  = slaLeft(createdAt, h);
  const color = slaColor(createdAt, h, t);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
      <div style={{ flex: 1, height: 4, background: t.surface3, borderRadius: 99, overflow: "hidden", minWidth: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.2s ease" }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: "50px", textAlign: "right", flexShrink: 0 }}>
          {left}
        </span>
      )}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

export function Btn({ children, variant = "primary", size = "md", onClick, disabled, full, style: ex, ariaLabel, title }) {
  const t = useTokens();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const variants = {
    primary:   { background: t.accent, color: "#0f0f0e", border: "none" },
    secondary: { background: "transparent", color: t.text2, border: `1px solid ${t.border}` },
    ghost:     { background: "transparent", color: t.text2, border: "none" },
    danger:    { background: t.red, color: "#fff", border: "none" },
  };
  const sizes = {
    sm: { fontSize: 11, padding: "5px 11px" },
    md: { fontSize: 13, padding: "8px 15px" },
    lg: { fontSize: 15, padding: "11px 22px" },
  };
  const focusRing = focused ? { boxShadow: `0 0 0 4px ${t.accentBg}` } : {};
  const hoverLift = hovered ? { transform: "translateY(-1px)", boxShadow: focused ? `0 0 0 5px ${t.accentBg}` : "0 6px 18px rgba(0,0,0,0.08)" } : {};

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...variants[variant], ...sizes[size],
        borderRadius: 9, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        display: "inline-flex", alignItems: "center",
        justifyContent: "center", gap: 6,
        fontFamily: t.font, transition: "transform .12s, box-shadow .12s, opacity .12s",
        width: full ? "100%" : "auto",
        outline: "none",
        ...focusRing,
        ...hoverLift,
        ...ex,
      }}
    >
      {children}
    </button>
  );
}

// ── Input / Textarea ──────────────────────────────────────────────────────────

export function Input({ value, onChange, placeholder, type = "text", onKeyDown, autoFocus, multiline, rows = 3, style: ex }) {
  const t = useTokens();
  const base = {
    width: "100%", background: t.surface2, border: `1px solid ${t.border}`,
    borderRadius: 9, padding: "10px 13px", fontSize: 14, color: t.text,
    outline: "none", fontFamily: t.font, boxSizing: "border-box", ...ex,
  };
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} />
    : <input value={value} onChange={onChange} placeholder={placeholder} type={type} onKeyDown={onKeyDown} autoFocus={autoFocus} style={base} />;
}

// ── Select ────────────────────────────────────────────────────────────────────

export function Sel({ value, onChange, children, style: ex }) {
  const t = useTokens();
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        background: t.surface2, border: `1px solid ${t.border}`,
        borderRadius: 9, padding: "10px 13px", fontSize: 14, color: t.text,
        outline: "none", fontFamily: t.font, cursor: "pointer",
        width: "100%", boxSizing: "border-box", ...ex,
      }}
    >
      {children}
    </select>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, style: ex, onClick, noPad }) {
  const t = useTokens();
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: noPad ? 0 : "18px 20px",
        overflow: "hidden", cursor: onClick ? "pointer" : "default",
        ...ex,
      }}
    >
      {children}
    </div>
  );
}

// ── Label (field heading) ─────────────────────────────────────────────────────

export function Label({ children }) {
  const t = useTokens();
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
      textTransform: "uppercase", color: t.text3, marginBottom: 5,
    }}>
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
// Slides up from bottom on mobile, centres on desktop.

export function Modal({ title, onClose, children, width = 560 }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        background: t.surface, border: `1px solid ${t.border2}`,
        borderRadius: isMobile ? "18px 18px 0 0" : 16,
        width: "100%", maxWidth: isMobile ? "100%" : width,
        maxHeight: isMobile ? "92vh" : "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, position: "relative",
        }}>
          {isMobile && (
            <div style={{
              width: 36, height: 4, borderRadius: 99, background: t.border2,
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
            }} />
          )}
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: t.font }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 22, lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
