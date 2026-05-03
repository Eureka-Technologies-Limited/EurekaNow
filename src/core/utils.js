// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — UTILITY FUNCTIONS
// Pure helpers with no React dependencies. Safe to import anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { PRIORITIES } from "./constants.js";

/** Random short ID for new records */
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Format a Unix ms timestamp to "26 Apr, 14:30" */
export const fmtTs = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

/** Hours-ago helper for relative-time calculations */
export const hrs = (h) => Date.now() - h * 3_600_000;

// ── SLA helpers ───────────────────────────────────────────────────────────────

/** Percentage of SLA elapsed (0–100, capped) */
export const slaPct = (createdAt, slaHours) =>
  Math.min(100, Math.round(((Date.now() - createdAt) / 3_600_000) / slaHours * 100));

/** Human-readable time remaining for a ticket's SLA */
export const slaLeft = (createdAt, slaHours) => {
  const remaining = slaHours - (Date.now() - createdAt) / 3_600_000;
  if (remaining <= 0) return "Breached";
  if (remaining < 1)  return `${Math.round(remaining * 60)}m`;
  return `${Math.round(remaining)}h left`;
};

/** Returns the correct token colour for a given SLA percentage */
export const slaColor = (createdAt, slaHours, tokens) => {
  const pct = slaPct(createdAt, slaHours);
  if (pct >= 100) return tokens.red;
  if (pct >= 75)  return tokens.orange;
  if (pct >= 50)  return tokens.yellow;
  return tokens.green;
};

/** Convenience: look up SLA config from priority string */
export const slaForPriority = (priority) => PRIORITIES[priority]?.sla ?? 24;

/**
 * Find a priority config from a catalog using case-insensitive matching.
 * Returns the matched config object or null.
 */
export const findPriorityCfg = (catalog = {}, priority) => {
  if (!catalog || !priority) {
    if (typeof window !== "undefined" && window.__EUREKA_DEBUG_SLA) console.debug("findPriorityCfg: missing catalog or priority", { priority, catalogKeys: Object.keys(catalog || {}) });
    return null;
  }

  if (catalog[priority]) {
    if (typeof window !== "undefined" && window.__EUREKA_DEBUG_SLA) console.debug("findPriorityCfg: exact match", { priority, cfg: catalog[priority] });
    return catalog[priority];
  }

  const key = Object.keys(catalog).find((k) => String(k).toLowerCase() === String(priority).toLowerCase());
  const found = key ? catalog[key] : null;
  if (typeof window !== "undefined" && window.__EUREKA_DEBUG_SLA) console.debug("findPriorityCfg: lookup", { priority, foundKey: key, found });
  return found;
};
