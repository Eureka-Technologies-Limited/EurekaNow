import { DEFAULT_TEAM_ROLES, DEFAULT_URGENCIES, PRIORITIES, TICKET_PREFIX, CATEGORIES } from "./constants.js";
import { uid, slaForPriority } from "./utils.js";
import { supabase } from "./supabase.js";

const TABLES = {
  orgs: "organizations",
  teams: "teams",
  users: "users",
  tickets: "tickets",
  comments: "ticket_comments",
  articles: "articles",
  orgSettings: "org_settings",
  teamSettings: "team_settings",
  teamRoles: "team_roles",
  postIncidentReviews: "post_incident_reviews",
  closingTemplates: "closing_templates",
  pirFieldConfigs: "pir_field_configs",
  catalogItems: "service_catalog_items",
  approvals: "approvals",
  activityLog: "activity_log",
};

const DEMO_STORAGE_KEY = "eurekanow_demo_state_v1";
const SUPABASE_CONFIGURED = Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);

export const DEMO_CREDENTIALS = {
  email: "demo@eurekanow.local",
  password: "demo123",
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeUserRoles = (value, fallbackRole = "") => {
  const fromArray = asArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const normalized = fromArray.length ? fromArray : [String(fallbackRole || "").trim()].filter(Boolean);
  return Array.from(new Set(normalized));
};

const defaultPrioritiesArray = () => Object.entries(PRIORITIES).map(([name, cfg]) => ({
  name,
  color: cfg.color,
  sla: cfg.sla,
}));

const isValidHexColor = (color) => {
  const hex = String(color || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
};

const normalizePriorities = (value) => {
  const rows = asArray(value)
    .map((item) => {
      const rawColor = item?.color;
      const name = String(item?.name || "").trim();
      
      // Try to preserve the color if it's a valid hex color
      let color = isValidHexColor(rawColor) ? String(rawColor).trim() : null;
      
      // If no valid color, try to recover from PRIORITIES constant
      if (!color && PRIORITIES[name]) {
        color = PRIORITIES[name].color;
      }
      
      // Fall back to a neutral color if still no valid color
      if (!color) {
        color = "#888888";
      }
      
      return {
        name,
        color,
        sla: Number(item?.sla || 0),
      };
    })
    .filter((item) => item.name && item.sla > 0);

  return rows.length ? rows : defaultPrioritiesArray();
};

const normalizeUrgencies = (value) => {
  const rows = asArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return rows.length ? rows : DEFAULT_URGENCIES;
};

const prioritiesToMap = (rows) => rows.reduce((acc, row) => {
  acc[row.name] = { color: row.color, sla: row.sla };
  return acc;
}, {});

const toUser = (row) => {
  const roles = normalizeUserRoles(row.roles, row.role);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: roles[0] || "End User",
    roles,
    orgId: row.org_id,
    teamId: row.team_id,
    title: row.title || "",
  };
};

const toOrg = (row) => ({
  id: row.id,
  name: row.name,
  domain: row.domain || "",
  industry: row.industry || "Other",
  plan: row.plan || "Starter",
});

const toTeam = (row) => ({
  id: row.id,
  orgId: row.org_id,
  name: row.name,
  lead: row.lead || "",
  icon: row.icon || "Team",
});

const toComment = (row) => ({
  id: row.id,
  userId: row.user_id,
  text: row.text,
  createdAt: Number(row.created_at),
});

const toTicket = (row, commentsByTicketId = {}) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  type: row.type,
  category: row.category,
  catalogItemId: row.catalog_item_id || "",
  orgId: row.org_id,
  teamId: row.team_id,
  assignee: row.assignee || "",
  reporter: row.reporter,
  priority: row.priority,
  urgency: row.urgency || "Medium",
  status: row.status,
  createdAt: Number(row.created_at),
  resolvedAt: row.resolved_at ? Number(row.resolved_at) : null,
  tags: asArray(row.tags),
  parentId: row.parent_id || null,
  dueDate: row.due_date ? Number(row.due_date) : null,
  estimateHours: row.estimate_hours != null ? Number(row.estimate_hours) : null,
  spentHours: row.spent_hours != null ? Number(row.spent_hours) : 0,
  comments: commentsByTicketId[row.id] || [],
});

const toArticle = (row) => ({
  id: row.id,
  title: row.title,
  orgId: row.org_id,
  category: row.category,
  folder: row.folder || "General",
  author: row.author,
  editors: asArray(row.editors),
  createdAt: Number(row.created_at),
  views: row.views || 0,
  tags: asArray(row.tags),
  content: row.content || "",
});

const toOrgSettings = (row) => {
  const priorities = normalizePriorities(row?.priorities);
  const urgencies = normalizeUrgencies(row?.urgencies);
  const categories = Array.isArray(row?.categories) && row.categories.length ? row.categories.map((c) => String(c)) : CATEGORIES;
  return {
    orgId: row?.org_id,
    priorities,
    priorityMap: prioritiesToMap(priorities),
    urgencies,
    categories,
    rolePermissions: row?.role_permissions || {},
    requireApprovals: Boolean(row?.require_approvals),
    approvalMode: row?.approval_mode || "all",
    updatedAt: Number(row?.updated_at || 0),
  };
};

const toTeamSettings = (row) => {
  const priorities = normalizePriorities(row?.priorities);
  const urgencies = normalizeUrgencies(row?.urgencies);
  return {
    teamId: row?.team_id,
    priorities,
    priorityMap: prioritiesToMap(priorities),
    urgencies,
    updatedAt: Number(row?.updated_at || 0),
  };
};

const toTeamRole = (row) => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  description: row.description || "",
  createdAt: Number(row.created_at),
});

const toPostIncidentReview = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  orgId: row.org_id,
  teamId: row.team_id || "",
  summary: row.summary || "",
  rootCause: row.root_cause || "",
  timeline: row.timeline || "",
  actionItems: asArray(row.action_items),
  owner: row.owner || "",
  customData: row.data || {},
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

const toClosingTemplate = (row) => ({
  id: row.id,
  orgId: row.org_id,
  teamId: row.team_id || "",
  name: row.name,
  description: row.description || "",
  content: row.content,
  applyToTypes: asArray(row.apply_to_types),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

const toPirFieldConfig = (row) => ({
  id: row.id,
  orgId: row.org_id,
  teamId: row.team_id || "",
  fields: asArray(row.fields),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

const toCatalogItem = (row) => ({
  id: row.id,
  orgId: row.org_id,
  teamId: row.team_id || "",
  name: row.name,
  description: row.description || "",
  category: row.category || "General",
  icon: row.icon || "request",
  defaultType: row.default_type || "Service Request",
  defaultPriority: row.default_priority || "Medium",
  defaultUrgency: row.default_urgency || "Medium",
  requiresApproval: Boolean(row.requires_approval),
  approverRole: row.approver_role || "Admin",
  approverId: row.approver_id || "",
  approverMode: row.approver_mode || "role", // 'role' | 'user' | 'team'
  approverTeamId: row.approver_team_id || "",
  active: row.active !== false,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export async function createCatalogItem(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const item = {
      id: `cat_${uid()}`,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      name: payload.name,
      description: payload.description || "",
      category: payload.category || "General",
      icon: payload.icon || "request",
      defaultType: payload.defaultType || "Service Request",
      defaultPriority: payload.defaultPriority || "Medium",
      defaultUrgency: payload.defaultUrgency || "Medium",
      requiresApproval: !!payload.requiresApproval,
      approverRole: payload.approverRole || "Admin",
      approverId: payload.approverId || "",
      approverMode: payload.approverMode || "role",
      approverTeamId: payload.approverTeamId || "",
      active: payload.active !== false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.catalogItems = [item, ...(state.catalogItems || [])];
    saveDemoState();
    return clone(item);
  }

  const row = {
    id: `cat_${uid()}`,
    org_id: payload.orgId,
    team_id: payload.teamId || null,
    name: payload.name,
    description: payload.description || "",
    category: payload.category || "General",
    icon: payload.icon || "request",
    default_type: payload.defaultType || "Service Request",
    default_priority: payload.defaultPriority || "Medium",
    default_urgency: payload.defaultUrgency || "Medium",
    requires_approval: !!payload.requiresApproval,
    approver_role: payload.approverRole || "Admin",
    approver_id: payload.approverId || null,
    approver_mode: payload.approverMode || "role",
    approver_team_id: payload.approverTeamId || null,
    active: payload.active !== false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.catalogItems)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create catalog item.");
  return toCatalogItem(data);
}

export async function updateCatalogItem(itemId, payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = (state.catalogItems || []).findIndex((row) => row.id === itemId);
    if (index < 0) throw new Error("Catalog item not found.");
    const next = { ...state.catalogItems[index], ...payload, updatedAt: Date.now() };
    state.catalogItems[index] = next;
    saveDemoState();
    return clone(next);
  }

  const patch = {};
  if ("approverRole" in payload) patch.approver_role = payload.approverRole;
  if ("approverId" in payload) patch.approver_id = payload.approverId || null;
  if ("approverMode" in payload) patch.approver_mode = payload.approverMode || "role";
  if ("approverTeamId" in payload) patch.approver_team_id = payload.approverTeamId || null;
  if ("active" in payload) patch.active = !!payload.active;

  if (!Object.keys(patch).length) {
    const { data, error } = await supabase.from(TABLES.catalogItems).select("*").eq("id", itemId).single();
    fail(error, "Failed to load catalog item.");
    return toCatalogItem(data);
  }

  const { data, error } = await supabase.from(TABLES.catalogItems).update(patch).eq("id", itemId).select("*").single();
  fail(error, "Failed to update catalog item.");
  return toCatalogItem(data);
}

const toApproval = (row) => ({
  id: row.id,
  orgId: row.org_id,
  teamId: row.team_id || "",
  ticketId: row.ticket_id,
  catalogItemId: row.catalog_item_id || "",
  requestedBy: row.requested_by,
  requestedFor: row.requested_for || row.requested_by,
  approverId: row.approver_id || "",
  approverRole: row.approver_role || "Admin",
  approverMode: row.approver_mode || "role",
  approverTeamId: row.approver_team_id || "",
  status: row.status || "Pending",
  decision: row.decision || "",
  comments: row.comments || "",
  dueAt: row.due_at ? Number(row.due_at) : null,
  createdAt: Number(row.created_at),
  decidedAt: row.decided_at ? Number(row.decided_at) : null,
});

const fail = (error, fallback) => {
  if (error) {
    throw new Error(error.message || fallback);
  }
};

const makeTicketId = (type) => {
  const prefix = TICKET_PREFIX[type] || "TKT";
  const random = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${random}`;
};

const ago = (hours) => Date.now() - hours * 60 * 60 * 1000;

const makeDemoSeed = () => {
  const priorities = defaultPrioritiesArray();
  const baseOrg = { id: "o_demo", name: "Demo Organization", domain: "demo.local", industry: "Technology", plan: "Starter" };
  const baseTeam = { id: "t_demo", orgId: "o_demo", name: "Support Team", lead: "u_demo", icon: "IT" };
  const demoUser = { id: "u_demo", name: "Demo User", email: DEMO_CREDENTIALS.email, role: "Admin", roles: ["Admin"], orgId: "o_demo", teamId: "t_demo", title: "Demo Administrator" };
  const agentUser = { id: "u_demo_agent", name: "Support Agent", email: "agent@demo.local", role: "Agent", roles: ["Agent"], orgId: "o_demo", teamId: "t_demo", title: "Support Engineer" };

  const comments = [{ id: "c_demo_1", userId: "u_demo_agent", text: "Initial triage completed.", createdAt: ago(1.5) }];

  return {
    orgs: [baseOrg],
    teams: [baseTeam],
    users: [demoUser, agentUser],
    tickets: [
      {
        id: "INC-9000",
        title: "Major Incident: Authentication service degradation",
        description: "Widespread authentication failures affecting multiple services across the organisation.",
        type: "Incident",
        category: "Security",
        orgId: "o_demo",
        teamId: "t_demo",
        assignee: "u_demo_agent",
        reporter: "u_demo",
        priority: "Critical",
        urgency: "Critical",
        status: "In Progress",
        createdAt: ago(5),
        tags: ["major-incident", "auth"],
        parentId: null,
        dueDate: ago(1),
        estimateHours: 6,
        spentHours: 4,
        comments: [],
      },
      {
        id: "INC-9001",
        title: "Demo incident: VPN login failures",
        description: "Users report VPN auth failures from remote network.",
        type: "Incident",
        category: "Network",
        orgId: "o_demo",
        teamId: "t_demo",
        assignee: "u_demo_agent",
        reporter: "u_demo",
        priority: "High",
        urgency: "High",
        status: "In Progress",
        createdAt: ago(4),
        tags: ["vpn", "auth"],
        parentId: "INC-9000",
        dueDate: ago(2),
        estimateHours: 3,
        spentHours: 1.5,
        comments,
      },
      {
        id: "INC-9003",
        title: "Demo incident: SSO portal unreachable",
        description: "Single sign-on portal returning 503 for external users.",
        type: "Incident",
        category: "Security",
        orgId: "o_demo",
        teamId: "t_demo",
        assignee: "",
        reporter: "u_demo",
        priority: "High",
        urgency: "High",
        status: "Open",
        createdAt: ago(3),
        tags: ["sso", "auth"],
        parentId: "INC-9000",
        dueDate: ago(0.5),
        estimateHours: 2,
        spentHours: 0.5,
        comments: [],
      },
      {
        id: "REQ-9002",
        title: "Demo request: New software access",
        description: "Request access to design tools for contractor.",
        type: "Service Request",
        category: "Access Management",
        orgId: "o_demo",
        teamId: "t_demo",
        assignee: "u_demo_agent",
        reporter: "u_demo",
        priority: "Medium",
        urgency: "Medium",
        status: "Open",
        createdAt: ago(10),
        tags: ["access"],
        parentId: null,
        dueDate: ago(-24),
        estimateHours: 2,
        spentHours: 0,
        comments: [],
      },
    ],
    articles: [
      {
        id: "kb_demo_1",
        title: "How to reset VPN credentials",
        orgId: "o_demo",
        category: "Network",
        folder: "Access",
        author: "u_demo_agent",
        createdAt: ago(100),
        views: 15,
        tags: ["vpn", "password"],
        content: "1. Open the VPN portal.\n2. Click reset password.\n3. Complete MFA verification.",
      },
    ],
    orgSettings: [{ orgId: "o_demo", priorities, priorityMap: prioritiesToMap(priorities), urgencies: DEFAULT_URGENCIES, categories: CATEGORIES, approvalMode: "all", updatedAt: Date.now() }],
    teamSettings: [{ teamId: "t_demo", priorities, priorityMap: prioritiesToMap(priorities), urgencies: DEFAULT_URGENCIES, updatedAt: Date.now() }],
    teamRoles: [
      { id: "role_demo_admin", teamId: "t_demo", name: "Admin", description: "Full access", createdAt: ago(200) },
      { id: "role_demo_agent", teamId: "t_demo", name: "Agent", description: "Handle tickets", createdAt: ago(200) },
      { id: "role_demo_end_user", teamId: "t_demo", name: "End User", description: "Submit only", createdAt: ago(200) },
    ],
    postIncidentReviews: [
      {
        id: "pir_demo_1",
        ticketId: "INC-9001",
        orgId: "o_demo",
        teamId: "t_demo",
        summary: "Authentication outage affected remote workers.",
        rootCause: "Expired upstream identity certificate.",
        timeline: "09:00 detection, 09:25 cert rolled, 09:35 validation complete.",
        actionItems: ["Add cert expiry alert", "Document runbook"],
        owner: "u_demo_agent",
        customData: {},
        createdAt: ago(3),
        updatedAt: ago(2),
      },
    ],
    closingTemplates: [
      {
        id: "tmpl_demo_1",
        orgId: "o_demo",
        teamId: "t_demo",
        name: "Standard Incident Close",
        description: "Template for closing standard incidents",
        content: "Incident resolved and verified. Root cause: [ROOT_CAUSE]. All affected systems are operational.",
        applyToTypes: ["Incident"],
        createdAt: ago(50),
        updatedAt: ago(50),
      },
    ],
    pirFieldConfigs: [
      {
        id: "pir_cfg_demo_1",
        orgId: "o_demo",
        teamId: "t_demo",
        fields: [
          { name: "summary", label: "Summary", type: "text", required: true },
          { name: "rootCause", label: "Root Cause", type: "text", required: true },
          { name: "timeline", label: "Timeline", type: "text", required: false },
          { name: "actionItems", label: "Action Items", type: "list", required: false },
          { name: "owner", label: "Owner", type: "user", required: true },
        ],
        createdAt: ago(100),
        updatedAt: ago(100),
      },
    ],
    catalogItems: [
      {
        id: "cat_demo_1",
        orgId: "o_demo",
        teamId: "t_demo",
        name: "Software Access Request",
        description: "Request access to approved business software and tools.",
        category: "Access Management",
        icon: "request",
        defaultType: "Service Request",
        defaultPriority: "Medium",
        defaultUrgency: "Medium",
        requiresApproval: true,
        approverRole: "Admin",
        active: true,
        createdAt: ago(120),
        updatedAt: ago(120),
      },
      {
        id: "cat_demo_2",
        orgId: "o_demo",
        teamId: "t_demo",
        name: "Hardware Replacement",
        description: "Replace a damaged or aged laptop, monitor, or accessory.",
        category: "Hardware",
        icon: "device-laptop",
        defaultType: "Service Request",
        defaultPriority: "Low",
        defaultUrgency: "Low",
        requiresApproval: false,
        approverRole: "Admin",
        active: true,
        createdAt: ago(120),
        updatedAt: ago(120),
      },
      {
        id: "cat_demo_3",
        orgId: "o_demo",
        teamId: "t_demo",
        name: "Emergency Change",
        description: "Fast-track a high-impact production change for an incident.",
        category: "Software",
        icon: "change",
        defaultType: "Change Request",
        defaultPriority: "High",
        defaultUrgency: "High",
        requiresApproval: true,
        approverRole: "Admin",
        active: true,
        createdAt: ago(120),
        updatedAt: ago(120),
      },
    ],
    approvals: [
      {
        id: "appr_demo_1",
        orgId: "o_demo",
        teamId: "t_demo",
        ticketId: "REQ-9002",
        catalogItemId: "cat_demo_1",
        requestedBy: "u_demo",
        requestedFor: "u_demo",
        approverId: "u_demo",
        approverRole: "Admin",
        status: "Pending",
        decision: "",
        comments: "",
        dueAt: ago(-12),
        createdAt: ago(6),
        decidedAt: null,
      },
      {
        id: "appr_demo_2",
        orgId: "o_demo",
        teamId: "t_demo",
        ticketId: "CHG-0001",
        catalogItemId: "cat_demo_3",
        requestedBy: "u_admin",
        requestedFor: "u_admin",
        approverId: "u_demo_agent",
        approverRole: "Admin",
        status: "Approved",
        decision: "Approved",
        comments: "Approved for maintenance window.",
        dueAt: ago(-24),
        createdAt: ago(24),
        decidedAt: ago(20),
      },
    ],
  };
};

let demoState = null;
let forceDemoMode = false;

const clone = (value) => JSON.parse(JSON.stringify(value));

const saveDemoState = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoState));
  } catch {
    // Ignore storage failures in restricted environments.
  }
};

const getDemoState = () => {
  if (demoState) return demoState;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        demoState = JSON.parse(raw);
        return demoState;
      }
    } catch {
      // Fall through to seed.
    }
  }

  demoState = makeDemoSeed();
  saveDemoState();
  return demoState;
};

const isDemoLogin = (email, password) =>
  email.trim().toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase() && password === DEMO_CREDENTIALS.password;

const getExistingUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  if (shouldUseDemoMode()) {
    const state = getDemoState();
    return state.users.find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
  }

  const { data, error } = await supabase
    .from(TABLES.users)
    .select("*")
    .ilike("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data || null;
};

const shouldUseDemoMode = () => !SUPABASE_CONFIGURED || forceDemoMode;

const isFetchFailure = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
    || message.includes("fetch")
  );
};

const getDemoUser = () => {
  const state = getDemoState();
  return state.users.find((u) => u.email.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase()) || state.users[0];
};

const ensureSupabaseOrDemo = () => {
  if (!SUPABASE_CONFIGURED) {
    throw new Error("Supabase is not configured. Create a new account or set up REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.");
  }
};

export async function loginWithEmailPassword(email, password) {
  if (isDemoLogin(email, password)) {
    forceDemoMode = true;
    return clone(getDemoUser());
  }

  if (shouldUseDemoMode()) {
    const user = await getExistingUserByEmail(email);

    if (!user || user.password !== password) {
      throw new Error("Invalid email or password.");
    }

    forceDemoMode = true;
    return clone(user);
  }

  forceDemoMode = false;

  ensureSupabaseOrDemo();

  const { data, error } = await supabase
    .from(TABLES.users)
    .select("*")
    .ilike("email", email.trim())
    .eq("password", password)
    .limit(1)
    .maybeSingle();

  fail(error, "Unable to sign in.");

  if (!data) {
    throw new Error("Invalid email or password.");
  }

  return toUser(data);
}

export async function registerWithEmailPassword(payload) {
  const fullName = String(payload?.fullName || "").trim();
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const organizationName = String(payload?.organizationName || "").trim() || `${fullName || email.split("@")[0] || "User"}'s Workspace`;
  const teamName = String(payload?.teamName || "").trim();
  const title = String(payload?.title || "").trim();

  if (!fullName) throw new Error("Full name is required.");
  if (!email) throw new Error("Email address is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existingUser = await getExistingUserByEmail(email);
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const organisation = await createOrganisation({
    name: organizationName,
    domain: email.split("@")[1] || "",
    industry: "Other",
    plan: "Starter",
  });

  const team = await createTeam({
    orgId: organisation.id,
    name: teamName || "General",
    lead: fullName,
    icon: "Team",
  });

  return createMember({
    name: fullName,
    email,
    password,
    role: "End User",
    orgId: organisation.id,
    teamId: team?.id || null,
    title,
  });
}

export async function loginWithGoogle() {
  ensureSupabaseOrDemo();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  fail(error, "Unable to sign in with Google.");
  return data;
}

export async function getUserFromSession(session) {
  const authUser = session?.user;

  if (!authUser?.email) {
    throw new Error("No session found.");
  }

  const { data: existingUser, error: fetchError } = await supabase
    .from(TABLES.users)
    .select("*")
    .ilike("email", authUser.email)
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(fetchError.message);
  }

  if (existingUser) {
    return toUser(existingUser);
  }

  const { data: orgs, error: orgsError } = await supabase
    .from(TABLES.orgs)
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgsError) {
    throw new Error(orgsError.message);
  }

  const defaultOrgId = orgs?.[0]?.id || null;

  const { data: teams, error: teamsError } = await supabase
    .from(TABLES.teams)
    .select("id")
    .eq("org_id", defaultOrgId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const defaultTeamId = teams?.[0]?.id || null;

  if (!defaultOrgId) {
    throw new Error("No organization is configured for this workspace.");
  }

  const newUserData = {
    id: uid(),
    name: authUser.user_metadata?.full_name || authUser.email.split("@")[0] || "User",
    email: authUser.email,
    role: "End User",
    org_id: defaultOrgId,
    team_id: defaultTeamId,
    title: "",
  };

  const { data: createdUser, error: createError } = await supabase
    .from(TABLES.users)
    .insert([newUserData])
    .select()
    .single();

  fail(createError, "Unable to create user.");

  return toUser(createdUser);
}

export async function handleAuthCallback() {
  const { data, error } = await supabase.auth.getSession();

  fail(error, "Unable to verify session.");

  return getUserFromSession(data?.session);
}

export async function fetchAppData(scope = {}) {
  const orgId = String(scope?.orgId || "").trim();
  const teamId = String(scope?.teamId || "").trim();

  if (shouldUseDemoMode()) {
    const state = clone(getDemoState());
    if (!orgId) {
      return {
        ...state,
        orgs: [],
        teams: [],
        users: [],
        tickets: [],
        articles: [],
        orgSettings: [],
        teamSettings: [],
        teamRoles: [],
        postIncidentReviews: [],
        closingTemplates: [],
        pirFieldConfigs: [],
        catalogItems: [],
        approvals: [],
      };
    }

    const teamScope = teamId ? [teamId] : state.teams.filter((team) => team.orgId === orgId).map((team) => team.id);
    return {
      ...state,
      orgs: state.orgs.filter((org) => org.id === orgId),
      teams: state.teams.filter((team) => team.orgId === orgId),
      users: state.users.filter((user) => user.orgId === orgId),
      tickets: state.tickets.filter((ticket) => ticket.orgId === orgId && (!teamScope.length || teamScope.includes(ticket.teamId || ""))),
      articles: state.articles.filter((article) => article.orgId === orgId),
      orgSettings: state.orgSettings.filter((settings) => settings.orgId === orgId),
      teamSettings: state.teamSettings.filter((settings) => !teamScope.length || teamScope.includes(settings.teamId)),
      teamRoles: state.teamRoles.filter((role) => !teamScope.length || teamScope.includes(role.teamId)),
      postIncidentReviews: state.postIncidentReviews.filter((review) => review.orgId === orgId && (!teamScope.length || teamScope.includes(review.teamId || ""))),
      closingTemplates: state.closingTemplates.filter((tmpl) => tmpl.orgId === orgId && (!teamScope.length || teamScope.includes(tmpl.teamId || ""))),
      pirFieldConfigs: state.pirFieldConfigs.filter((cfg) => cfg.orgId === orgId && (!teamScope.length || teamScope.includes(cfg.teamId || ""))),
      catalogItems: state.catalogItems.filter((item) => item.orgId === orgId && (!teamScope.length || teamScope.includes(item.teamId || ""))),
      approvals: state.approvals.filter((approval) => approval.orgId === orgId && (!teamScope.length || teamScope.includes(approval.teamId || ""))),
    };
  }

  try {
    const [
      orgsRes,
      teamsRes,
      usersRes,
      ticketsRes,
      commentsRes,
      articlesRes,
      orgSettingsRes,
      teamSettingsRes,
      teamRolesRes,
      reviewsRes,
      templatesRes,
      pirConfigsRes,
      catalogRes,
      approvalsRes,
    ] = await Promise.all([
      supabase.from(TABLES.orgs).select("*").eq("id", orgId).order("name", { ascending: true }),
      supabase.from(TABLES.teams).select("*").eq("org_id", orgId).order("name", { ascending: true }),
      supabase.from(TABLES.users).select("*").eq("org_id", orgId).order("name", { ascending: true }),
      supabase.from(TABLES.tickets).select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from(TABLES.comments).select("*").order("created_at", { ascending: true }),
      supabase.from(TABLES.articles).select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from(TABLES.orgSettings).select("*").eq("org_id", orgId),
      supabase.from(TABLES.teamSettings).select("*").in("team_id", teamId ? [teamId] : []),
      supabase.from(TABLES.teamRoles).select("*").in("team_id", teamId ? [teamId] : []),
      supabase.from(TABLES.postIncidentReviews).select("*").eq("org_id", orgId).order("updated_at", { ascending: false }),
      supabase.from(TABLES.closingTemplates).select("*").eq("org_id", orgId).order("created_at", { ascending: true }),
      supabase.from(TABLES.pirFieldConfigs).select("*").eq("org_id", orgId),
      supabase.from(TABLES.catalogItems).select("*").eq("org_id", orgId).order("created_at", { ascending: true }),
      supabase.from(TABLES.approvals).select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);

    fail(orgsRes.error, "Failed to load organizations.");
    fail(teamsRes.error, "Failed to load teams.");
    fail(usersRes.error, "Failed to load users.");
    fail(ticketsRes.error, "Failed to load tickets.");
    fail(commentsRes.error, "Failed to load comments.");
    fail(articlesRes.error, "Failed to load articles.");
    fail(orgSettingsRes.error, "Failed to load organization settings.");
    fail(teamSettingsRes.error, "Failed to load team settings.");
    fail(teamRolesRes.error, "Failed to load team roles.");
    fail(reviewsRes.error, "Failed to load post-incident reviews.");
    fail(templatesRes.error, "Failed to load templates.");
    fail(pirConfigsRes.error, "Failed to load PIR field configs.");
    fail(catalogRes.error, "Failed to load service catalog items.");
    fail(approvalsRes.error, "Failed to load approvals.");

    const commentsByTicketId = {};
    for (const row of commentsRes.data || []) {
      if (orgId && row.org_id && row.org_id !== orgId) continue;
      if (!commentsByTicketId[row.ticket_id]) commentsByTicketId[row.ticket_id] = [];
      commentsByTicketId[row.ticket_id].push(toComment(row));
    }

    const filteredTeams = (teamsRes.data || []).filter((team) => team.org_id === orgId && (!teamId || team.id === teamId || !teamId));
    const visibleTeamIds = new Set(filteredTeams.map((team) => team.id));
    const tickets = (ticketsRes.data || [])
      .filter((ticket) => ticket.org_id === orgId && (!teamId || !ticket.team_id || ticket.team_id === teamId || visibleTeamIds.has(ticket.team_id)))
      .map((row) => toTicket(row, commentsByTicketId));

    return {
      orgs: (orgsRes.data || []).map(toOrg),
      teams: filteredTeams.map(toTeam),
      users: (usersRes.data || []).filter((user) => user.org_id === orgId).map(toUser),
      tickets,
      articles: (articlesRes.data || []).filter((article) => article.org_id === orgId).map(toArticle),
      orgSettings: (orgSettingsRes.data || []).filter((settings) => settings.org_id === orgId).map(toOrgSettings),
      teamSettings: (teamSettingsRes.data || []).filter((settings) => !teamId || settings.team_id === teamId).map(toTeamSettings),
      teamRoles: (teamRolesRes.data || []).filter((role) => !teamId || role.team_id === teamId).map(toTeamRole),
      postIncidentReviews: (reviewsRes.data || []).filter((review) => review.org_id === orgId && (!teamId || !review.team_id || review.team_id === teamId)).map(toPostIncidentReview),
      closingTemplates: (templatesRes.data || []).filter((tmpl) => tmpl.org_id === orgId && (!teamId || !tmpl.team_id || tmpl.team_id === teamId)).map(toClosingTemplate),
      pirFieldConfigs: (pirConfigsRes.data || []).filter((cfg) => cfg.org_id === orgId && (!teamId || !cfg.team_id || cfg.team_id === teamId)).map(toPirFieldConfig),
      catalogItems: (catalogRes.data || []).filter((item) => item.org_id === orgId && (!teamId || !item.team_id || item.team_id === teamId)).map(toCatalogItem),
      approvals: (approvalsRes.data || []).filter((approval) => approval.org_id === orgId && (!teamId || !approval.team_id || approval.team_id === teamId)).map(toApproval),
    };
  } catch (error) {
    if (isFetchFailure(error)) {
      forceDemoMode = true;
      return clone(getDemoState());
    }
    throw error;
  }
}

export async function createTicket(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const created = {
      id: makeTicketId(payload.type),
      title: payload.title,
      description: payload.description || "",
      type: payload.type,
      category: payload.category,
      catalogItemId: payload.catalogItemId || "",
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      assignee: payload.assignee || "",
      reporter: payload.reporter,
      priority: payload.priority,
      urgency: payload.urgency || "Medium",
      status: payload.status || "Open",
      createdAt: Date.now(),
      tags: asArray(payload.tags),
      parentId: payload.parentId || null,
      dueDate: payload.dueDate || null,
      estimateHours: payload.estimateHours != null && payload.estimateHours !== "" ? Number(payload.estimateHours) : null,
      spentHours: payload.spentHours != null && payload.spentHours !== "" ? Number(payload.spentHours) : 0,
      comments: [],
    };
    state.tickets.unshift(created);
    saveDemoState();
    return clone(created);
  }

  const row = {
    id: makeTicketId(payload.type),
    title: payload.title,
    description: payload.description || "",
    type: payload.type,
    category: payload.category,
    org_id: payload.orgId,
    team_id: payload.teamId || "",
    assignee: payload.assignee || "",
    reporter: payload.reporter,
    priority: payload.priority,
    urgency: payload.urgency || "Medium",
    status: payload.status || "Open",
    created_at: Date.now(),
    tags: asArray(payload.tags),
    parent_id: payload.parentId || null,
    due_date: payload.dueDate || null,
    estimate_hours: payload.estimateHours != null && payload.estimateHours !== "" ? Number(payload.estimateHours) : null,
    spent_hours: payload.spentHours != null && payload.spentHours !== "" ? Number(payload.spentHours) : 0,
    resolved_at: payload.resolvedAt == null ? null : Number(payload.resolvedAt),
  };

  const { data, error } = await supabase
    .from(TABLES.tickets)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create ticket.");
  return toTicket(data, {});
}

export async function updateTicketFields(ticketId, fields) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = state.tickets.findIndex((row) => row.id === ticketId);
    if (index < 0) throw new Error("Ticket not found.");
    // If status moved to Resolved/Closed and no resolvedAt provided, stamp it in demo state
    const nextFields = { ...fields };
    if (typeof fields.status === "string") {
      if (["Resolved", "Closed"].includes(fields.status) && !('resolvedAt' in fields)) {
        nextFields.resolvedAt = Date.now();
      }
      if (!["Resolved", "Closed"].includes(fields.status) && !('resolvedAt' in fields)) {
        nextFields.resolvedAt = null;
      }
    }
    state.tickets[index] = { ...state.tickets[index], ...nextFields };
    saveDemoState();
    return clone(state.tickets[index]);
  }

  const patch = {};

  if (typeof fields.status === "string") patch.status = fields.status;
  if ("resolvedAt" in fields && fields.resolvedAt != null) patch.resolved_at = Number(fields.resolvedAt);
  if (typeof fields.priority === "string") patch.priority = fields.priority;
  if (typeof fields.urgency === "string") patch.urgency = fields.urgency;
  if (typeof fields.assignee === "string") patch.assignee = fields.assignee;
  if ("parentId" in fields) patch.parent_id = fields.parentId ?? null;
  if ("dueDate" in fields) patch.due_date = fields.dueDate || null;
  if ("estimateHours" in fields) patch.estimate_hours = fields.estimateHours == null || fields.estimateHours === "" ? null : Number(fields.estimateHours);
  if ("spentHours" in fields) patch.spent_hours = fields.spentHours == null || fields.spentHours === "" ? 0 : Number(fields.spentHours);

  if (!Object.keys(patch).length) {
    const { data, error } = await supabase
      .from(TABLES.tickets)
      .select("*")
      .eq("id", ticketId)
      .single();
    fail(error, "Failed to load ticket.");

    const { data: comments, error: commentsError } = await supabase
      .from(TABLES.comments)
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    fail(commentsError, "Failed to load ticket comments.");

    const byId = { [ticketId]: (comments || []).map(toComment) };
    return toTicket(data, byId);
  }

  const { data, error } = await supabase
    .from(TABLES.tickets)
    .update(patch)
    .eq("id", ticketId)
    .select("*")
    .single();

  fail(error, "Failed to update ticket.");

  const { data: comments, error: commentsError } = await supabase
    .from(TABLES.comments)
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  fail(commentsError, "Failed to load ticket comments.");

  const byId = { [ticketId]: (comments || []).map(toComment) };
  return toTicket(data, byId);
}

export async function createTicketComment(ticketId, payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const ticket = state.tickets.find((row) => row.id === ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    const comment = {
      id: `c_${uid()}`,
      userId: payload.userId,
      text: payload.text,
      createdAt: Date.now(),
    };
    ticket.comments = [...(ticket.comments || []), comment];
    saveDemoState();
    return clone(comment);
  }

  const row = {
    id: `c_${uid()}`,
    ticket_id: ticketId,
    user_id: payload.userId,
    text: payload.text,
    created_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.comments)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to post comment.");
  return toComment(data);
}

export async function createApproval(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const approval = {
      id: `appr_${uid()}`,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      ticketId: payload.ticketId,
      catalogItemId: payload.catalogItemId || "",
      requestedBy: payload.requestedBy,
      requestedFor: payload.requestedFor || payload.requestedBy,
      approverId: payload.approverId || "",
      approverRole: payload.approverRole || "Admin",
      approverMode: payload.approverMode || "role",
      approverTeamId: payload.approverTeamId || "",
      status: payload.status || "Pending",
      decision: payload.decision || "",
      comments: payload.comments || "",
      dueAt: payload.dueAt || null,
      createdAt: Date.now(),
      decidedAt: payload.decidedAt || null,
    };
    state.approvals = [...(state.approvals || []), approval];
    saveDemoState();
    return clone(approval);
  }

  const row = {
    id: `appr_${uid()}`,
    org_id: payload.orgId,
    team_id: payload.teamId || "",
    ticket_id: payload.ticketId,
    catalog_item_id: payload.catalogItemId || "",
    requested_by: payload.requestedBy,
    requested_for: payload.requestedFor || payload.requestedBy,
    approver_id: payload.approverId || "",
      approver_role: payload.approverRole || "Admin",
      approver_mode: payload.approverMode || "role",
      approver_team_id: payload.approverTeamId || null,
    status: payload.status || "Pending",
    decision: payload.decision || "",
    comments: payload.comments || "",
    due_at: payload.dueAt || null,
    created_at: Date.now(),
    decided_at: payload.decidedAt || null,
  };

  const { data, error } = await supabase
    .from(TABLES.approvals)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create approval.");
  return toApproval(data);
}

export async function resolveApproval(approvalId, payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = (state.approvals || []).findIndex((row) => row.id === approvalId);
    if (index < 0) throw new Error("Approval not found.");
    const next = {
      ...state.approvals[index],
      status: payload.status,
      decision: payload.decision || payload.status,
      comments: payload.comments || "",
      approverId: payload.approverId || state.approvals[index].approverId,
      decidedAt: Date.now(),
    };
    state.approvals[index] = next;
    saveDemoState();
    return clone(next);
  }

  const { data, error } = await supabase
    .from(TABLES.approvals)
    .update({
      status: payload.status,
      decision: payload.decision || payload.status,
      comments: payload.comments || "",
      approver_id: payload.approverId || undefined,
      decided_at: Date.now(),
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  fail(error, "Failed to update approval.");
  return toApproval(data);
}

export async function createArticle(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const article = {
      id: `kb_${uid()}`,
      title: payload.title,
      orgId: payload.orgId,
      category: payload.category,
      folder: payload.folder || "General",
      author: payload.author,
      editors: asArray(payload.editors),
      content: payload.content,
      views: 0,
      tags: asArray(payload.tags),
      createdAt: Date.now(),
    };
    state.articles.unshift(article);
    saveDemoState();
    return clone(article);
  }

  const row = {
    id: `kb_${uid()}`,
    title: payload.title,
    org_id: payload.orgId,
    category: payload.category,
    folder: payload.folder || "General",
    catalog_item_id: payload.catalogItemId || null,
    author: payload.author,
    editors: asArray(payload.editors),
    content: payload.content,
    views: 0,
    tags: asArray(payload.tags),
    created_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.articles)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to publish article.");
  return toArticle(data);
}

export async function updateArticle(articleId, payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = state.articles.findIndex((row) => row.id === articleId);
    if (index < 0) throw new Error("Article not found.");
    state.articles[index] = {
      ...state.articles[index],
      title: payload.title,
      category: payload.category,
      folder: payload.folder || "General",
      content: payload.content,
      tags: asArray(payload.tags),
      editors: asArray(payload.editors),
    };
    saveDemoState();
    return clone(state.articles[index]);
  }

  const row = {
    title: payload.title,
    category: payload.category,
    folder: payload.folder || "General",
    content: payload.content,
    tags: asArray(payload.tags),
    editors: asArray(payload.editors),
  };

  const { data, error } = await supabase
    .from(TABLES.articles)
    .update(row)
    .eq("id", articleId)
    .select("*")
    .single();

  fail(error, "Failed to update article.");
  return toArticle(data);
}

export async function incrementArticleViews(articleId, nextViews) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = state.articles.findIndex((row) => row.id === articleId);
    if (index < 0) throw new Error("Article not found.");
    state.articles[index] = { ...state.articles[index], views: nextViews };
    saveDemoState();
    return clone(state.articles[index]);
  }

  const { data, error } = await supabase
    .from(TABLES.articles)
    .update({ views: nextViews })
    .eq("id", articleId)
    .select("*")
    .single();

  fail(error, "Failed to update article views.");
  return toArticle(data);
}

export async function createOrganisation(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const created = {
      id: `o_${uid()}`,
      name: payload.name,
      domain: payload.domain || "",
      industry: payload.industry || "Other",
      plan: payload.plan || "Starter",
    };
    state.orgs.push(created);
    state.orgSettings.push({
      orgId: created.id,
      priorities: defaultPrioritiesArray(),
      priorityMap: prioritiesToMap(defaultPrioritiesArray()),
      urgencies: DEFAULT_URGENCIES,
      updatedAt: Date.now(),
    });
    saveDemoState();
    return clone(created);
  }

  const row = {
    id: `o_${uid()}`,
    name: payload.name,
    domain: payload.domain || "",
    industry: payload.industry || "Other",
    plan: payload.plan || "Starter",
  };

  const { data, error } = await supabase
    .from(TABLES.orgs)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create organization.");

  await upsertOrgSettings({
    orgId: data.id,
    priorities: defaultPrioritiesArray(),
    urgencies: DEFAULT_URGENCIES,
  });

  return toOrg(data);
}

export async function updateOrgPlan(orgId, plan) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) throw new Error("Organisation not found.");
    org.plan = plan;
    saveDemoState();
    return clone(toOrg(org));
  }

  const { data, error } = await supabase
    .from(TABLES.orgs)
    .update({ plan })
    .eq("id", orgId)
    .select("*")
    .single();

  fail(error, "Failed to update plan.");
  return toOrg(data);
}

export async function createTeam(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const created = {
      id: `t_${uid()}`,
      orgId: payload.orgId,
      name: payload.name,
      lead: payload.lead || "",
      icon: payload.icon || "Team",
    };
    state.teams.push(created);

    const priorities = defaultPrioritiesArray();
    state.teamSettings.push({
      teamId: created.id,
      priorities,
      priorityMap: prioritiesToMap(priorities),
      urgencies: DEFAULT_URGENCIES,
      updatedAt: Date.now(),
    });

    for (const baseRole of DEFAULT_TEAM_ROLES) {
      state.teamRoles.push({
        id: `role_${uid()}`,
        teamId: created.id,
        name: baseRole.name,
        description: baseRole.description,
        createdAt: Date.now(),
      });
    }

    saveDemoState();
    return clone(created);
  }

  const row = {
    id: `t_${uid()}`,
    org_id: payload.orgId,
    name: payload.name,
    lead: payload.lead || "",
    icon: payload.icon || "Team",
  };

  const { data, error } = await supabase
    .from(TABLES.teams)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create team.");

  await upsertTeamSettings({
    teamId: data.id,
    priorities: defaultPrioritiesArray(),
    urgencies: DEFAULT_URGENCIES,
  });

  for (const baseRole of DEFAULT_TEAM_ROLES) {
    await createTeamRole({
      teamId: data.id,
      name: baseRole.name,
      description: baseRole.description,
    });
  }

  return toTeam(data);
}

export async function createMember(payload) {
  const roles = normalizeUserRoles(payload.roles, payload.role);

  // Check if user already exists globally
  const existing = await getExistingUserByEmail(payload.email || "");

  if (shouldUseDemoMode()) {
    const state = getDemoState();

    if (existing) {
      // If they are already in this org, bail out
      if (existing.orgId === payload.orgId) {
        throw new Error("A user with this email already exists in this organization.");
      }

      // Create a demo invitation record (soft invite)
      state.invitations = state.invitations || [];
      state.invitations.push({ id: `inv_${uid()}`, email: payload.email, orgId: payload.orgId, teamId: payload.teamId || null, sentAt: Date.now(), status: "Pending" });
      saveDemoState();
      return { inviteSent: true, email: payload.email };
    }

    // For demo mode we do not auto-create accounts from invites; require registration first
    throw new Error("User not registered. Ask them to register using the Sign In / Register page.");
  }

  // In production: if user does not exist, require them to register first
  if (!existing) {
    throw new Error("User not found. Ask them to register first at /signin.");
  }

  // If user exists and is already in the org, inform caller
  if (existing.org_id === payload.orgId || existing.orgId === payload.orgId) {
    throw new Error("A user with this email already exists in this organization.");
  }

  // Send an invite: record an activity log entry so admins can track invitations.
  try {
    const inviteRow = {
      id: `al_${uid()}`,
      org_id: payload.orgId,
      team_id: payload.teamId || null,
      user_id: null,
      type: "invitation",
      text: `Invitation sent to ${payload.email}`,
      created_at: Date.now(),
    };

    const { data: actData, error: actError } = await supabase.from(TABLES.activityLog).insert(inviteRow).select("*").single();
    if (actError) {
      // If activity log insert fails silently, continue — invite record is best-effort
      console.warn("Failed to record invitation in activity log:", actError.message || actError);
    }
  } catch (er) {
    // ignore activity log errors
  }

  // Return an inviteSent marker to the caller; UI can handle closing and showing a message
  return { inviteSent: true, email: payload.email };
}

export async function updateMemberRoles(userId, rolesInput) {
  const roles = normalizeUserRoles(rolesInput, "End User");

  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const index = state.users.findIndex((row) => row.id === userId);
    if (index < 0) throw new Error("Member not found.");
    state.users[index] = {
      ...state.users[index],
      role: roles[0],
      roles,
    };
    saveDemoState();
    return clone(state.users[index]);
  }

  let data;
  let error;

  ({ data, error } = await supabase
    .from(TABLES.users)
    .update({ role: roles[0], roles })
    .eq("id", userId)
    .select("*")
    .single());

  if (error?.message?.toLowerCase().includes("roles") && error?.message?.toLowerCase().includes("column")) {
    ({ data, error } = await supabase
      .from(TABLES.users)
      .update({ role: roles[0] })
      .eq("id", userId)
      .select("*")
      .single());
  }

  fail(error, "Failed to update member roles.");
  return toUser(data);
}

export async function upsertOrgSettings(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const priorities = normalizePriorities(payload.priorities);
    const settings = {
      orgId: payload.orgId,
      priorities,
      priorityMap: prioritiesToMap(priorities),
      urgencies: normalizeUrgencies(payload.urgencies),
      categories: Array.isArray(payload.categories) && payload.categories.length ? payload.categories.map((c) => String(c)) : CATEGORIES,
      rolePermissions: payload.rolePermissions || {},
      requireApprovals: !!payload.requireApprovals,
      approvalMode: payload.approvalMode || "all",
      updatedAt: Date.now(),
    };
    const index = state.orgSettings.findIndex((row) => row.orgId === payload.orgId);
    if (index >= 0) state.orgSettings[index] = settings;
    else state.orgSettings.push(settings);
    saveDemoState();
    return clone(settings);
  }

  const row = {
    org_id: payload.orgId,
    priorities: normalizePriorities(payload.priorities),
    urgencies: normalizeUrgencies(payload.urgencies),
    categories: Array.isArray(payload.categories) && payload.categories.length ? payload.categories.map((c) => String(c)) : CATEGORIES,
    role_permissions: payload.rolePermissions || {},
    require_approvals: !!payload.requireApprovals,
    approval_mode: payload.approvalMode || "all",
    updated_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.orgSettings)
    .upsert(row)
    .select("*")
    .single();

  fail(error, "Failed to save organization settings.");
  return toOrgSettings(data);
}

export async function upsertTeamSettings(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const priorities = normalizePriorities(payload.priorities);
    const settings = {
      teamId: payload.teamId,
      priorities,
      priorityMap: prioritiesToMap(priorities),
      urgencies: normalizeUrgencies(payload.urgencies),
      updatedAt: Date.now(),
    };
    const index = state.teamSettings.findIndex((row) => row.teamId === payload.teamId);
    if (index >= 0) state.teamSettings[index] = settings;
    else state.teamSettings.push(settings);
    saveDemoState();
    return clone(settings);
  }

  const row = {
    team_id: payload.teamId,
    priorities: normalizePriorities(payload.priorities),
    urgencies: normalizeUrgencies(payload.urgencies),
    updated_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.teamSettings)
    .upsert(row)
    .select("*")
    .single();

  fail(error, "Failed to save team settings.");
  return toTeamSettings(data);
}

export async function createTeamRole(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const role = {
      id: `role_${uid()}`,
      teamId: payload.teamId,
      name: payload.name,
      description: payload.description || "",
      createdAt: Date.now(),
    };
    state.teamRoles.push(role);
    saveDemoState();
    return clone(role);
  }

  const row = {
    id: `role_${uid()}`,
    team_id: payload.teamId,
    name: payload.name,
    description: payload.description || "",
    created_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.teamRoles)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to add role.");
  return toTeamRole(data);
}

export async function savePostIncidentReview(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const review = {
      id: payload.id || `pir_${uid()}`,
      ticketId: payload.ticketId,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      summary: payload.summary || "",
      rootCause: payload.rootCause || "",
      timeline: payload.timeline || "",
      actionItems: asArray(payload.actionItems),
      owner: payload.owner || "",
      customData: payload.customData || {},
      createdAt: payload.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const byId = state.postIncidentReviews.findIndex((row) => row.id === review.id);
    const byTicket = state.postIncidentReviews.findIndex((row) => row.ticketId === review.ticketId);
    if (byId >= 0) state.postIncidentReviews[byId] = review;
    else if (byTicket >= 0) state.postIncidentReviews[byTicket] = review;
    else state.postIncidentReviews.unshift(review);

    saveDemoState();
    return clone(review);
  }

  const base = {
    ticket_id: payload.ticketId,
    org_id: payload.orgId,
    team_id: payload.teamId || "",
    summary: payload.summary || "",
    root_cause: payload.rootCause || "",
    timeline: payload.timeline || "",
    action_items: asArray(payload.actionItems),
    owner: payload.owner || "",
    data: payload.customData || {},
    updated_at: Date.now(),
  };

  let result;
  if (payload.id) {
    result = await supabase
      .from(TABLES.postIncidentReviews)
      .update(base)
      .eq("id", payload.id)
      .select("*")
      .single();
  } else {
    result = await supabase
      .from(TABLES.postIncidentReviews)
      .insert({ ...base, id: `pir_${uid()}`, created_at: Date.now() })
      .select("*")
      .single();
  }

  fail(result.error, "Failed to save post-incident review.");
  return toPostIncidentReview(result.data);
}

export async function createClosingTemplate(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    if (!state.closingTemplates) state.closingTemplates = [];
    const template = {
      id: `tmpl_${uid()}`,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      name: payload.name,
      description: payload.description || "",
      content: payload.content,
      applyToTypes: asArray(payload.applyToTypes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.closingTemplates.push(template);
    saveDemoState();
    return clone(template);
  }

  const row = {
    id: `tmpl_${uid()}`,
    org_id: payload.orgId,
    team_id: payload.teamId || "",
    name: payload.name,
    description: payload.description || "",
    content: payload.content,
    apply_to_types: asArray(payload.applyToTypes),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.closingTemplates)
    .insert(row)
    .select("*")
    .single();

  fail(error, "Failed to create template.");
  return toClosingTemplate(data);
}

export async function updateClosingTemplate(templateId, payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    if (!state.closingTemplates) state.closingTemplates = [];
    const index = state.closingTemplates.findIndex((t) => t.id === templateId);
    if (index < 0) throw new Error("Template not found.");
    state.closingTemplates[index] = {
      ...state.closingTemplates[index],
      ...payload,
      updatedAt: Date.now(),
    };
    saveDemoState();
    return clone(state.closingTemplates[index]);
  }

  const patch = {
    name: payload.name,
    description: payload.description || "",
    content: payload.content,
    apply_to_types: asArray(payload.applyToTypes),
    updated_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.closingTemplates)
    .update(patch)
    .eq("id", templateId)
    .select("*")
    .single();

  fail(error, "Failed to update template.");
  return toClosingTemplate(data);
}

export async function deleteClosingTemplate(templateId) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    if (!state.closingTemplates) state.closingTemplates = [];
    state.closingTemplates = state.closingTemplates.filter((t) => t.id !== templateId);
    saveDemoState();
    return true;
  }

  const { error } = await supabase
    .from(TABLES.closingTemplates)
    .delete()
    .eq("id", templateId);

  if (error) throw new Error(error.message || "Failed to delete template.");
  return true;
}

export async function upsertPirFieldConfig(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    if (!state.pirFieldConfigs) state.pirFieldConfigs = [];
    const existing = state.pirFieldConfigs.find((cfg) => cfg.teamId === payload.teamId && cfg.orgId === payload.orgId);
    const config = {
      id: existing?.id || `pir_cfg_${uid()}`,
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      fields: asArray(payload.fields),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    if (existing) {
      const index = state.pirFieldConfigs.indexOf(existing);
      state.pirFieldConfigs[index] = config;
    } else {
      state.pirFieldConfigs.push(config);
    }
    saveDemoState();
    return clone(config);
  }

  const row = {
    org_id: payload.orgId,
    team_id: payload.teamId || "",
    fields: asArray(payload.fields),
    updated_at: Date.now(),
  };

  const existing = await supabase
    .from(TABLES.pirFieldConfigs)
    .select("id")
    .eq("org_id", payload.orgId)
    .eq("team_id", payload.teamId || "")
    .single();

  let result;
  if (existing.data?.id) {
    result = await supabase
      .from(TABLES.pirFieldConfigs)
      .update(row)
      .eq("id", existing.data.id)
      .select("*")
      .single();
  } else {
    result = await supabase
      .from(TABLES.pirFieldConfigs)
      .insert({ id: `pir_cfg_${uid()}`, ...row, created_at: Date.now() })
      .select("*")
      .single();
  }

  fail(result.error, "Failed to save PIR field config.");
  return toPirFieldConfig(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Audit Log
// Track all ticket changes for compliance and visibility
// ─────────────────────────────────────────────────────────────────────────────

const toActivityLog = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  orgId: row.org_id,
  teamId: row.team_id,
  userId: row.user_id,
  action: row.action,
  field: row.field || "",
  oldValue: row.old_value,
  newValue: row.new_value,
  createdAt: Number(row.created_at),
});

export async function logActivity(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    if (!state.activityLog) state.activityLog = [];
    const log = {
      id: `log_${uid()}`,
      ticketId: payload.ticketId,
      orgId: payload.orgId,
      teamId: payload.teamId,
      userId: payload.userId,
      action: payload.action,
      field: payload.field || "",
      oldValue: payload.oldValue,
      newValue: payload.newValue,
      createdAt: Date.now(),
    };
    state.activityLog.push(log);
    saveDemoState();
    return clone(log);
  }

  const row = {
    id: `log_${uid()}`,
    ticket_id: payload.ticketId,
    org_id: payload.orgId,
    team_id: payload.teamId,
    user_id: payload.userId,
    action: payload.action,
    field: payload.field || "",
    old_value: payload.oldValue,
    new_value: payload.newValue,
    created_at: Date.now(),
  };

  const { data, error } = await supabase
    .from(TABLES.activityLog)
    .insert(row)
    .select("*")
    .single();

  // Don't fail on audit log errors - they're non-critical
  if (error) console.warn("Failed to log activity:", error.message);
  return data ? toActivityLog(data) : null;
}

export async function fetchActivityLog(ticketId) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const logs = (state.activityLog || [])
      .filter((log) => log.ticketId === ticketId)
      .sort((a, b) => b.createdAt - a.createdAt);
    return clone(logs);
  }

  const { data, error } = await supabase
    .from(TABLES.activityLog)
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to fetch activity log:", error.message);
    return [];
  }

  return (data || []).map(toActivityLog);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLA Breach Detection & Notifications
// Check for tickets approaching or breaching SLA
// ─────────────────────────────────────────────────────────────────────────────

export function checkSLAStatus(ticket, hours = 24) {
  const createdMs = ticket.createdAt;
  const nowMs = Date.now();
  const elapsedMs = nowMs - createdMs;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const percentComplete = (elapsedHours / hours) * 100;

  return {
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    percentComplete: Math.round(percentComplete),
    isBreached: elapsedHours > hours,
    isRisk: percentComplete > 75 && percentComplete <= 100,
    hoursRemaining: Math.max(0, Math.round((hours - elapsedHours) * 10) / 10),
  };
}

export function findSLABreachers(tickets, priorityCatalog = {}) {
  return tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const cfg = priorityCatalog[tk.priority];
      const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status };
    })
    .filter(({ slaStatus }) => slaStatus.isBreached);
}

export function findSLAAtRisk(tickets, priorityCatalog = {}) {
  return tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const cfg = priorityCatalog[tk.priority];
      const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status };
    })
    .filter(({ slaStatus }) => slaStatus.isRisk && !slaStatus.isBreached);
}