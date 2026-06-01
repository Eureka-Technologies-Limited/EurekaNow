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
// REALTIME SUBSCRIPTIONS — Supabase live updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time ticket updates
 * @param {Function} onTicketChange - Callback when ticket changes
 * @param {Array<string>} ticketIds - Optional ticket IDs to filter
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTicketUpdates(onTicketChange, ticketIds = null) {
  if (!supabase) return () => {};

  let subsc = null;
  
  try {
    // Subscribe to all inserts, updates, and deletes on tickets table
    subsc = supabase
      .channel("tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          const record = payload.new || payload.old;
          
          // Filter by ticketIds if provided
          if (ticketIds && !ticketIds.includes(record.id)) {
            return;
          }
          
          onTicketChange({
            type: payload.eventType.toLowerCase(),
            ticket: record,
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("Realtime subscriptions not available:", err.message);
  }

  return () => {
    if (subsc) {
      supabase.removeChannel(subsc);
    }
  };
}

/**
 * Subscribe to comment updates on a ticket
 * @param {string} ticketId - Ticket ID to watch
 * @param {Function} onCommentChange - Callback on comment changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTicketComments(ticketId, onCommentChange) {
  if (!supabase || !ticketId) return () => {};

  let subsc = null;

  try {
    subsc = supabase
      .channel(`ticket_comments_${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_comments",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          onCommentChange({
            type: payload.eventType.toLowerCase(),
            comment: payload.new || payload.old,
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("Comment subscriptions not available:", err.message);
  }

  return () => {
    if (subsc) {
      supabase.removeChannel(subsc);
    }
  };
}

/**
 * Subscribe to approval updates
 * @param {Function} onApprovalChange - Callback on approval changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToApprovals(onApprovalChange) {
  if (!supabase) return () => {};

  let subsc = null;

  try {
    subsc = supabase
      .channel("approvals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approvals",
        },
        (payload) => {
          onApprovalChange({
            type: payload.eventType.toLowerCase(),
            approval: payload.new || payload.old,
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("Approval subscriptions not available:", err.message);
  }

  return () => {
    if (subsc) {
      supabase.removeChannel(subsc);
    }
  };
}
