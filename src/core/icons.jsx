// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — ICON SYSTEM
// All icons are inline SVG paths, encoded as pipe-separated "d" strings.
// To add a new icon: add a key to ICONS with its path data, then use <I name="key"/>.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

const ICONS = {
  grid:     "M3 3h7v7H3z|M14 3h7v7h-7z|M3 14h7v7H3z|M14 14h7v7h-7z",
  incident: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01",
  request:  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2|M9 5a2 2 0 002 2h2a2 2 0 002-2|M9 5a2 2 0 012-2h2a2 2 0 012 2",
  change:   "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z|M16 2v4|M8 2v4|M2 10h20",
  problem:  "M12 2a10 10 0 100 20A10 10 0 0012 2z|M12 8v4|M12 16h.01",
  task:     "M9 11l3 3L22 4|M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  ticket:   "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a1 1 0 000 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a1 1 0 000-2V7a2 2 0 00-2-2H5z",
  teams:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2|M23 21v-2a4 4 0 00-3-3.87|M16 3.13a4 4 0 010 7.75|M9 7a4 4 0 100 8 4 4 0 000-8z",
  kb:       "M4 19.5A2.5 2.5 0 016.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6z|M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  plus:     "M12 5v14|M5 12h14",
  search:   "M21 21l-4.35-4.35|M17 11A6 6 0 115 11a6 6 0 0112 0z",
  bell:     "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 01-3.46 0",
  menu:     "M3 12h18|M3 6h18|M3 18h18",
  send:     "M22 2L11 13|M22 2L15 22 11 13 2 9l20-7z",
  moon:     "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun:      "M12 1v2|M12 21v2|M4.22 4.22l1.42 1.42|M18.36 18.36l1.42 1.42|M1 12h2|M21 12h2|M4.22 19.78l1.42-1.42|M18.36 5.64l1.42-1.42|M12 5a7 7 0 100 14A7 7 0 0012 5z",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|M12 9a3 3 0 100 6 3 3 0 000-6z",
  back:     "M19 12H5|M12 19l-7-7 7-7",
  logout:   "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4|M16 17l5-5-5-5|M21 12H9",
  x:        "M18 6L6 18|M6 6l12 12",
  check:    "M20 6L9 17l-5-5",
  filter:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  more:     "M12 5h.01|M12 12h.01|M12 19h.01",
  user:     "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2|M12 7a4 4 0 100 8 4 4 0 000-8z",
};

/** Low-level SVG renderer — use <I> instead in most cases */
const Ic = ({ d, size = 16, stroke = 1.8 }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round"
  >
    {d.split("|").map((p, i) => <path key={i} d={p} />)}
  </svg>
);

/**
 * Icon component.
 * @param {string} name   - key from the ICONS map above
 * @param {number} size   - px size (default 16)
 * @param {number} stroke - stroke width (default 1.8)
 */
export const I = ({ name, size = 16, stroke }) => (
  <Ic d={ICONS[name] ?? "M12 12h.01"} size={size} stroke={stroke} />
);

export { ICONS };
