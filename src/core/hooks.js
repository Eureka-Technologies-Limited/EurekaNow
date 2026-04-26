// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — THEME & BREAKPOINT HOOKS
// All React context and responsive hooks. Import from here, not inline.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, createContext, useContext } from "react";

// ── Breakpoint ────────────────────────────────────────────────────────────────

export function useBreakpoint() {
  const [w, setW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return {
    isMobile:  w < 768,
    isTablet:  w >= 768 && w < 1024,
    isDesktop: w >= 1024,
    w,
  };
}

// ── Theme context ─────────────────────────────────────────────────────────────

const ThemeCtx = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true);
  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);

// ── Design tokens ─────────────────────────────────────────────────────────────
// All colour and typography decisions live here.
// Adding a new semantic colour: add a key below in both branches.

export function useTokens() {
  const { dark } = useTheme();
  return {
    dark,
    // Surfaces
    bg:         dark ? "#0f0f0e" : "#f5f4f0",
    surface:    dark ? "#1a1917" : "#ffffff",
    surface2:   dark ? "#222120" : "#f8f7f4",
    surface3:   dark ? "#2a2927" : "#f0ede6",
    border:     dark ? "#2e2c2a" : "#e4e1d8",
    border2:    dark ? "#3a3835" : "#d4d0c8",
    // Text
    text:       dark ? "#f0ede6" : "#1a1917",
    text2:      dark ? "#a09890" : "#6b6560",
    text3:      dark ? "#666260" : "#9a9590",
    // Brand accent — amber/gold
    accent:     "#e8a020",
    accentBg:   dark ? "#2a1f08" : "#fef9ec",
    accentText: dark ? "#f0b840" : "#92400e",
    // Semantic colours (each has base, bg, text variants)
    red:        "#e53e3e", redBg:    dark ? "#2d1515" : "#fef2f2", redText:    dark ? "#fc8181" : "#991b1b",
    orange:     "#dd6b20", orangeBg: dark ? "#2d1a0e" : "#fff7ed", orangeText: dark ? "#fb923c" : "#9a3412",
    green:      "#38a169", greenBg:  dark ? "#0f2318" : "#f0fdf4", greenText:  dark ? "#6ee7b7" : "#15803d",
    blue:       "#3182ce", blueBg:   dark ? "#0f1f35" : "#eff6ff", blueText:   dark ? "#93c5fd" : "#1d4ed8",
    purple:     "#805ad5", purpleBg: dark ? "#1e1235" : "#faf5ff", purpleText: dark ? "#c4b5fd" : "#6d28d9",
    yellow:     "#d69e2e", yellowBg: dark ? "#271f08" : "#fffbeb", yellowText: dark ? "#fcd34d" : "#b45309",
    gray:       "#718096", grayBg:   dark ? "#1e1e1e" : "#f9fafb", grayText:   dark ? "#9ca3af" : "#4b5563",
    // Typography
    font: "'Sora', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  };
}
