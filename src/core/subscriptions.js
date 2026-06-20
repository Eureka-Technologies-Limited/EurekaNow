// ─────────────────────────────────────────────────────────────────────────────
// EUREKANOW — SUBSCRIPTION TIERS
// Three plans: Free · Basic · Pro
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase.js";

export const PLANS = {
  Free: {
    label: "Free",
    price: "£0 / mo",
    tagline: "For individuals getting started",
    color: "#718096",
    bgColor: "#71809622",
    limits: {
      users: 3,
      activeTickets: 100,
      kbArticles: 0,
      dashboardWidgets: 4,
      closingTemplates: 0,
    },
    features: {
      allTicketTypes: false,   // only Incident + Service Request
      kanban: false,
      reports: false,
      kb: false,
      pir: false,
      csvExport: false,
      customSLA: false,
      closingTemplates: false,
    },
    ticketTypes: ["Incident", "Service Request"],
    highlights: [
      "Up to 3 agents",
      "100 active tickets",
      "Incidents & Service Requests",
      "Basic dashboard (4 widgets)",
    ],
  },

  Basic: {
    label: "Basic",
    price: "£29 / mo",
    tagline: "For small teams",
    color: "#3182ce",
    bgColor: "#3182ce22",
    limits: {
      users: 10,
      activeTickets: 500,
      kbArticles: 50,
      dashboardWidgets: Infinity,
      closingTemplates: 10,
    },
    features: {
      allTicketTypes: true,
      kanban: true,
      reports: true,
      kb: true,
      pir: false,
      csvExport: true,
      customSLA: true,
      closingTemplates: true,
    },
    ticketTypes: ["Incident", "Service Request", "Change Request", "Problem", "Task"],
    highlights: [
      "Up to 10 agents",
      "500 active tickets",
      "All 5 ticket types",
      "Kanban board",
      "Knowledge Base (50 articles)",
      "Reports & Analytics",
      "CSV export",
      "10 closing templates",
      "Custom SLA",
    ],
  },

  Pro: {
    label: "Pro",
    price: "£79 / mo",
    tagline: "For growing organizations",
    color: "#9f7aea",
    bgColor: "#9f7aea22",
    limits: {
      users: Infinity,
      activeTickets: Infinity,
      kbArticles: Infinity,
      dashboardWidgets: Infinity,
      closingTemplates: Infinity,
    },
    features: {
      allTicketTypes: true,
      kanban: true,
      reports: true,
      kb: true,
      pir: true,
      csvExport: true,
      customSLA: true,
      closingTemplates: true,
    },
    ticketTypes: ["Incident", "Service Request", "Change Request", "Problem", "Task"],
    highlights: [
      "Unlimited agents",
      "Unlimited tickets",
      "All 5 ticket types",
      "Kanban board",
      "Unlimited Knowledge Base",
      "Full Reports & Analytics",
      "Post-Incident Reviews",
      "CSV export",
      "Unlimited closing templates",
      "Custom SLA (org + team level)",
    ],
  },
};

export const PLAN_ORDER = ["Free", "Basic", "Pro"];

// Map legacy plan names to new ones
const PLAN_ALIASES = {
  Starter: "Free",
  Professional: "Basic",
  Enterprise: "Pro",
};

export function normalizePlan(plan) {
  const mapped = PLAN_ALIASES[plan] || plan;
  return PLANS[mapped] ? mapped : "Free";
}

export function getPlan(planName) {
  return PLANS[normalizePlan(planName)] || PLANS.Free;
}

export function canFeature(planName, feature) {
  return getPlan(planName).features[feature] ?? false;
}

export function getLimit(planName, limitKey) {
  const val = getPlan(planName).limits[limitKey];
  return val === undefined ? 0 : val;
}

export function getTicketTypes(planName) {
  return getPlan(planName).ticketTypes;
}

export function planIndex(planName) {
  return PLAN_ORDER.indexOf(normalizePlan(planName));
}

export function meetsMinPlan(currentPlan, requiredPlan) {
  return planIndex(currentPlan) >= planIndex(requiredPlan);
}

// Returns the minimum plan key that enables a feature
export function minPlanFor(feature) {
  for (const key of PLAN_ORDER) {
    if (PLANS[key].features[feature]) return key;
  }
  return "Pro";
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS — unified live updates for all tables
// ─────────────────────────────────────────────────────────────────────────────

const pg = (table) => ({ event: "*", schema: "public", table });

/**
 * Subscribe to realtime changes across every app table.
 *
 * @param {string[]} orgIds    All org IDs the current user belongs to
 * @param {object}   handlers  { onTicket, onComment, onApproval, onUser,
 *                               onOrg, onTeam, onArticle, onOrgSettings,
 *                               onTeamSettings, onCatalogItem, onTeamRole,
 *                               onClosingTemplate, onPirFieldConfig, onPostReview }
 *                             Each handler is (eventType, rawRow) => void
 *                             eventType is "insert" | "update" | "delete"
 * @returns {Function} cleanup — call to remove the channel
 */
export function subscribeToRealtime(orgIds, handlers) {
  if (!supabase || !orgIds?.length) return () => {};

  const orgSet = new Set(orgIds);
  const inOrg  = (row, col = "org_id") => orgSet.has(row?.[col]);
  const fire   = (name, row, eventType) => handlers[name]?.(eventType, row);

  let channel;
  try {
    channel = supabase
      .channel("eurekanow_live")

      .on("postgres_changes", pg("tickets"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onTicket", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("ticket_comments"), ({ eventType, new: n, old: o }) => {
        // Comments have no org_id — filter by ticket membership happens in AppShell
        fire("onComment", n || o, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("approvals"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onApproval", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("users"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onUser", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("organizations"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (orgSet.has(row?.id)) fire("onOrg", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("teams"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onTeam", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("articles"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onArticle", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("org_settings"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (orgSet.has(row?.org_id)) fire("onOrgSettings", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("team_settings"), ({ eventType, new: n, old: o }) => {
        fire("onTeamSettings", n || o, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("service_catalog_items"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onCatalogItem", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("team_roles"), ({ eventType, new: n, old: o }) => {
        fire("onTeamRole", n || o, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("closing_templates"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onClosingTemplate", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("pir_field_configs"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onPirFieldConfig", row, eventType.toLowerCase());
      })

      .on("postgres_changes", pg("post_incident_reviews"), ({ eventType, new: n, old: o }) => {
        const row = n || o;
        if (inOrg(row)) fire("onPostReview", row, eventType.toLowerCase());
      })

      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Realtime channel error — live updates unavailable.");
        }
      });
  } catch (err) {
    console.warn("Realtime not available:", err.message);
  }

  return () => { if (channel) supabase.removeChannel(channel); };
}
