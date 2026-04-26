// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — WIDGET REGISTRY
//
// To add a new dashboard widget:
//   1. Create a new file in src/widgets/ (e.g. MyWidget.jsx)
//   2. Add an entry to ALL_WIDGETS below
//   3. Import and add a branch in DashWidget.jsx
//
// Widget sizes:
//   "sm" — 1 column (stat card)
//   "md" — 2 columns (chart / medium list)
//   "lg" — 2 columns (large activity list)
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_WIDGETS = [
  // ── Stat cards ──────────────────────────────────────────────────────────────
  { id: "stat_open",      label: "Open Tickets",       size: "sm", cat: "stats"    },
  { id: "stat_mine",      label: "Assigned to Me",     size: "sm", cat: "stats"    },
  { id: "stat_critical",  label: "Critical Count",     size: "sm", cat: "stats"    },
  { id: "stat_resolved",  label: "Resolved Today",     size: "sm", cat: "stats"    },
  { id: "stat_incidents", label: "Open Incidents",     size: "sm", cat: "stats"    },
  { id: "stat_requests",  label: "Open Requests",      size: "sm", cat: "stats"    },

  // ── Activity lists ───────────────────────────────────────────────────────────
  { id: "recent",         label: "Recent Tickets",     size: "lg", cat: "activity" },
  { id: "my_tickets",     label: "My Open Tickets",    size: "lg", cat: "activity" },
  { id: "critical_list",  label: "Critical Alerts",    size: "lg", cat: "activity" },
  { id: "sla_risk",       label: "SLA at Risk",        size: "lg", cat: "activity" },

  // ── Charts ───────────────────────────────────────────────────────────────────
  { id: "by_status",      label: "Tickets by Status",  size: "md", cat: "charts"   },
  { id: "by_priority",    label: "By Priority",        size: "md", cat: "charts"   },
  { id: "by_type",        label: "By Type",            size: "md", cat: "charts"   },

  // ── Knowledge Base ───────────────────────────────────────────────────────────
  { id: "kb_recent",      label: "Recent KB Articles", size: "md", cat: "kb"       },
];

/** Widget IDs shown on first login — users can customise via the Customise modal */
export const DEFAULT_LAYOUT = [
  "stat_open",
  "stat_mine",
  "stat_critical",
  "stat_resolved",
  "recent",
  "critical_list",
  "by_status",
  "by_priority",
];
