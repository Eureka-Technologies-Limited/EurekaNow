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

  // Core palette adapted from the main website theme.
  const palette = {
    darkBlue: "#0b1a30",
    lightBlue: "#1D3557",
    accent: "#F57A55",
    primaryText: "#FFFFFF",
    secondaryText: "#B0BEC5",
    border: "#37474F",
    lighterBlue: "#2C4A74",
    paleBlue: "#3E5C89",
    skyBlue: "#5B7BA8",
    frostBlue: "#A8C0D9",
    deepRed: "#D33B41",
    paleOrange: "#FFCCBC",
    softYellow: "#FFD166",
    successGreen: "#4CAF50",
    softGreen: "#C8E6C9",
    infoBlue: "#2196F3",
    mutedBlue: "#90A4AE",
    darkGray: "#263238",
    lightGray: "#ECEFF1",
  };

  return {
    dark,
    // Surfaces
    bg:         dark ? palette.darkBlue : palette.lightGray,
    surface:    dark ? palette.lightBlue : "#ffffff",
    surface2:   dark ? palette.lighterBlue : "#f6f9fc",
    surface3:   dark ? palette.paleBlue : "#e7eef6",
    border:     dark ? palette.border : "#c9d6e3",
    border2:    dark ? palette.mutedBlue : palette.frostBlue,
    // Text
    text:       dark ? palette.primaryText : palette.darkBlue,
    text2:      dark ? palette.secondaryText : "#34495e",
    text3:      dark ? palette.mutedBlue : "#607d8b",
    // Brand accent
    accent:     palette.accent,
    accentBg:   dark ? "rgba(245,122,85,0.18)" : "#ffe8e0",
    accentText: dark ? palette.paleOrange : "#8a2f15",
    // Semantic colours (each has base, bg, text variants)
    red:        palette.deepRed,      redBg:    dark ? "#3a1b20" : "#fce8ea", redText:    dark ? "#ff9aa0" : "#9f1f29",
    orange:     palette.accent,       orangeBg: dark ? "#41261f" : "#fff0ea", orangeText: dark ? palette.paleOrange : "#9d3e24",
    green:      palette.successGreen, greenBg:  dark ? "#16321b" : palette.softGreen, greenText: dark ? "#90e49a" : "#1f6a2d",
    blue:       palette.infoBlue,     blueBg:   dark ? "#112a42" : "#e9f4ff", blueText:   dark ? "#8bc9ff" : "#0d63b6",
    purple:     palette.skyBlue,      purpleBg: dark ? "#1f3553" : "#edf3fb", purpleText: dark ? palette.frostBlue : "#3f5f89",
    yellow:     palette.softYellow,   yellowBg: dark ? "#3a3117" : "#fff7db", yellowText: dark ? "#ffe39a" : "#8d6500",
    gray:       palette.mutedBlue,    grayBg:   dark ? palette.darkGray : "#f4f7fa", grayText:   dark ? palette.frostBlue : "#526773",
    // Typography
    font: "'Sora', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  };
}
