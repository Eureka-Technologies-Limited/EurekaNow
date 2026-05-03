import { useEffect, useState } from "react";
import { useTokens } from "../core/hooks.js";

const TYPE_STYLES = {
  error:   { icon: "⚠", accent: "#e53e3e", bg: "rgba(229,83,62,0.08)"   },
  warning: { icon: "⏱", accent: "#d69e2e", bg: "rgba(214,158,46,0.08)"  },
  success: { icon: "✓", accent: "#38a169", bg: "rgba(56,161,105,0.08)"  },
  info:    { icon: "i", accent: "#3182ce", bg: "rgba(49,130,206,0.08)"  },
};

function Toast({ id, title, message, type = "info", onDismiss }) {
  const t = useTokens();
  const s = TYPE_STYLES[type] || TYPE_STYLES.info;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(show);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(id), 200);
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px",
        background: t.surface,
        border: `1px solid ${s.accent}44`,
        borderLeft: `3px solid ${s.accent}`,
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(24px)",
        pointerEvents: "all",
        maxWidth: 340,
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        background: s.bg, border: `1px solid ${s.accent}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, color: s.accent, flexShrink: 0, marginTop: 1,
      }}>
        {s.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.4 }}>{message}</div>
      </div>
      <button
        onClick={handleDismiss}
        style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0, marginTop: -1 }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = ({ title, message, type = "info", duration = 5000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    }
  };

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, dismiss };
}
