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
  { name: "Catalog Manager", description: "Manage service catalog items and approvers" },
];

export const STATUSES = [
  "Open",
  "In Progress",
  "Pending",
  "Awaiting Approval",
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

// Full definitions for the built-in ticket types.
// When an org has no custom types configured, these are the defaults.
export const DEFAULT_TICKET_TYPES = [
  { name: "Incident",        prefix: "INC", color: "#e53e3e" },
  { name: "Service Request", prefix: "REQ", color: "#38a169" },
  { name: "Change Request",  prefix: "CHG", color: "#dd6b20" },
  { name: "Problem",         prefix: "PRB", color: "#805ad5" },
  { name: "Task",            prefix: "TSK", color: "#718096" },
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

// ── PERMISSION SYSTEM ───────────────────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    id: "tickets",
    label: "Tickets",
    permissions: [
      { key: "tickets.create",       label: "Create tickets",      description: "Submit new incidents, requests, and changes" },
      { key: "tickets.edit",         label: "Edit tickets",        description: "Update fields, status, and priority on any ticket" },
      { key: "tickets.assign",       label: "Assign tickets",      description: "Assign or reassign tickets to team members" },
      { key: "tickets.close",        label: "Close & resolve",     description: "Mark tickets as resolved or closed" },
      { key: "tickets.customFields", label: "Edit custom fields",  description: "Fill in org-defined custom fields on tickets" },
    ],
  },
  {
    id: "catalog",
    label: "Service Catalog",
    permissions: [
      { key: "catalog.request", label: "Request from catalog", description: "Submit requests via the service catalog" },
      { key: "catalog.edit",    label: "Edit catalog items",   description: "Edit catalog descriptions and settings" },
      { key: "catalog.manage",  label: "Manage catalog",       description: "Create, publish, and configure catalog items" },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    permissions: [
      { key: "approvals.resolve", label: "Resolve approvals", description: "Approve or reject pending service requests" },
    ],
  },
  {
    id: "kb",
    label: "Knowledge Base",
    permissions: [
      { key: "kb.view",   label: "View articles",  description: "Read knowledge base articles" },
      { key: "kb.create", label: "Write articles", description: "Create and publish knowledge base articles" },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    permissions: [
      { key: "members.invite", label: "Invite members",  description: "Add new members to the organisation" },
      { key: "reports.view",   label: "View reports",    description: "Access analytics and reporting dashboards" },
    ],
  },
];

// Default permissions for each built-in role
export const ROLE_PERMISSION_DEFAULTS = {
  "Admin": {
    "tickets.create": true, "tickets.edit": true, "tickets.assign": true, "tickets.close": true, "tickets.customFields": true,
    "catalog.request": true, "catalog.edit": true, "catalog.manage": true,
    "approvals.resolve": true,
    "kb.view": true, "kb.create": true,
    "members.invite": true, "reports.view": true,
  },
  "Agent": {
    "tickets.create": true, "tickets.edit": true, "tickets.assign": true, "tickets.close": true, "tickets.customFields": true,
    "catalog.request": true,
    "approvals.resolve": true,
    "kb.view": true, "kb.create": true,
    "reports.view": true,
  },
  "Catalog Manager": {
    "tickets.create": true,
    "catalog.request": true, "catalog.edit": true, "catalog.manage": true,
    "approvals.resolve": true,
    "kb.view": true,
    "members.invite": true,
  },
  "End User": {
    "tickets.create": true,
    "catalog.request": true,
    "kb.view": true,
  },
};

// Role accent colours used in the permissions UI
export const ROLE_COLORS = {
  "Admin":           "#e53e3e",
  "Agent":           "#3182ce",
  "Catalog Manager": "#805ad5",
  "End User":        "#38a169",
};

export const VIEW_LABELS = {
  dashboard:  "Dashboard",
  incidents:  "Incidents",
  requests:   "Service Requests",
  catalog:    "Service Catalog",
  approvals:  "Approvals",
  changes:    "Change Requests",
  problems:   "Problems",
  tasks:      "Tasks",
  all_tickets:"All Tickets",
  kanban:     "Kanban Board",
  teams:      "Teams & Orgs",
  kb:         "Knowledge Base",
  reports:    "Reports & Analytics",
  profile:    "My Profile",
  billing:    "Plans & Billing",
};
