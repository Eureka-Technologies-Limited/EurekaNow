// ─────────────────────────────────────────────────────────────────────────────
// EUREKAKNOW — CORE CONSTANTS
// All shared lookup tables, enumerations and config live here.
// To add a new priority level, ticket type or category, edit this file only.
// ─────────────────────────────────────────────────────────────────────────────

export const PRIORITIES = {
  Critical: { color: "#e53e3e", sla: 4  },
  High:     { color: "#dd6b20", sla: 8  },
  Medium:   { color: "#d69e2e", sla: 24 },
  Low:      { color: "#3182ce", sla: 72 },
};

export const DEFAULT_URGENCIES = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const DEFAULT_TEAM_ROLES = [
  { name: "Admin", description: "Full access" },
  { name: "Agent", description: "Handle tickets" },
  { name: "End User", description: "Submit only" },
];

export const STATUSES = [
  "Open",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
];

export const TICKET_TYPES = [
  "Incident",
  "Service Request",
  "Change Request",
  "Problem",
  "Task",
];

export const CATEGORIES = [
  "Network", "Software", "Hardware", "Security",
  "Access Management", "Onboarding", "Facilities",
  "Healthcare", "Engineering", "Finance", "Legal", "Other",
];

export const KB_CATEGORIES = [
  "IT Support", "Network", "Security", "Software", "Hardware",
  "Access Management", "Onboarding", "Process", "Healthcare", "Other",
];

// Prefix used when generating new ticket IDs
export const TICKET_PREFIX = {
  "Incident":       "INC",
  "Service Request":"REQ",
  "Change Request": "CHG",
  "Problem":        "PRB",
  "Task":           "TSK",
};

// Maps sidebar view IDs to ticket type strings
export const VIEW_TO_TYPE = {
  incidents: "Incident",
  requests:  "Service Request",
  changes:   "Change Request",
  problems:  "Problem",
  tasks:     "Task",
};

export const VIEW_LABELS = {
  dashboard:  "Dashboard",
  incidents:  "Incidents",
  requests:   "Service Requests",
  changes:    "Change Requests",
  problems:   "Problems",
  tasks:      "Tasks",
  all_tickets:"All Tickets",
  teams:      "Teams & Orgs",
  kb:         "Knowledge Base",
};
