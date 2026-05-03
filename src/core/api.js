import { DEFAULT_TEAM_ROLES, DEFAULT_URGENCIES, PRIORITIES, TICKET_PREFIX } from "./constants.js";
import { uid } from "./utils.js";
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
  activityLog: "activity_log",
};

const DEMO_STORAGE_KEY = "eurekanow_demo_state_v1";
const SUPABASE_CONFIGURED = Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);

export const DEMO_CREDENTIALS = {
  email: "demo@eurekanow.local",
  password: "demo123",
};

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
  orgId: row.org_id,
  teamId: row.team_id,
  assignee: row.assignee || "",
  reporter: row.reporter,
  priority: row.priority,
  urgency: row.urgency || "Medium",
  status: row.status,
  createdAt: Number(row.created_at),
  tags: asArray(row.tags),
  comments: commentsByTicketId[row.id] || [],
});

const toArticle = (row) => ({
  id: row.id,
  title: row.title,
  orgId: row.org_id,
  category: row.category,
  author: row.author,
  createdAt: Number(row.created_at),
  views: row.views || 0,
  tags: asArray(row.tags),
  content: row.content || "",
});

const toOrgSettings = (row) => {
  const priorities = normalizePriorities(row?.priorities);
  const urgencies = normalizeUrgencies(row?.urgencies);
  return {
    orgId: row?.org_id,
    priorities,
    priorityMap: prioritiesToMap(priorities),
    urgencies,
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
        comments,
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
        comments: [],
      },
    ],
    articles: [
      {
        id: "kb_demo_1",
        title: "How to reset VPN credentials",
        orgId: "o_demo",
        category: "Network",
        author: "u_demo_agent",
        createdAt: ago(100),
        views: 15,
        tags: ["vpn", "password"],
        content: "1. Open the VPN portal.\n2. Click reset password.\n3. Complete MFA verification.",
      },
    ],
    orgSettings: [{ orgId: "o_demo", priorities, priorityMap: prioritiesToMap(priorities), urgencies: DEFAULT_URGENCIES, updatedAt: Date.now() }],
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
    throw new Error(`Supabase is not configured. Use demo account: ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
  }
};

export async function loginWithEmailPassword(email, password) {
  if (isDemoLogin(email, password)) {
    forceDemoMode = true;
    return clone(getDemoUser());
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

export async function fetchAppData() {
  if (shouldUseDemoMode()) {
    return clone(getDemoState());
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
    ] = await Promise.all([
      supabase.from(TABLES.orgs).select("*").order("name", { ascending: true }),
      supabase.from(TABLES.teams).select("*").order("name", { ascending: true }),
      supabase.from(TABLES.users).select("*").order("name", { ascending: true }),
      supabase.from(TABLES.tickets).select("*").order("created_at", { ascending: false }),
      supabase.from(TABLES.comments).select("*").order("created_at", { ascending: true }),
      supabase.from(TABLES.articles).select("*").order("created_at", { ascending: false }),
      supabase.from(TABLES.orgSettings).select("*"),
      supabase.from(TABLES.teamSettings).select("*"),
      supabase.from(TABLES.teamRoles).select("*").order("created_at", { ascending: true }),
      supabase.from(TABLES.postIncidentReviews).select("*").order("updated_at", { ascending: false }),
      supabase.from(TABLES.closingTemplates).select("*").order("created_at", { ascending: true }),
      supabase.from(TABLES.pirFieldConfigs).select("*"),
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

    const commentsByTicketId = {};
    for (const row of commentsRes.data || []) {
      if (!commentsByTicketId[row.ticket_id]) commentsByTicketId[row.ticket_id] = [];
      commentsByTicketId[row.ticket_id].push(toComment(row));
    }

    return {
      orgs: (orgsRes.data || []).map(toOrg),
      teams: (teamsRes.data || []).map(toTeam),
      users: (usersRes.data || []).map(toUser),
      tickets: (ticketsRes.data || []).map((row) => toTicket(row, commentsByTicketId)),
      articles: (articlesRes.data || []).map(toArticle),
      orgSettings: (orgSettingsRes.data || []).map(toOrgSettings),
      teamSettings: (teamSettingsRes.data || []).map(toTeamSettings),
      teamRoles: (teamRolesRes.data || []).map(toTeamRole),
      postIncidentReviews: (reviewsRes.data || []).map(toPostIncidentReview),
      closingTemplates: (templatesRes.data || []).map(toClosingTemplate),
      pirFieldConfigs: (pirConfigsRes.data || []).map(toPirFieldConfig),
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
      orgId: payload.orgId,
      teamId: payload.teamId || "",
      assignee: payload.assignee || "",
      reporter: payload.reporter,
      priority: payload.priority,
      urgency: payload.urgency || "Medium",
      status: payload.status || "Open",
      createdAt: Date.now(),
      tags: asArray(payload.tags),
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
    state.tickets[index] = { ...state.tickets[index], ...fields };
    saveDemoState();
    return clone(state.tickets[index]);
  }

  const patch = {};

  if (typeof fields.status === "string") patch.status = fields.status;
  if (typeof fields.priority === "string") patch.priority = fields.priority;
  if (typeof fields.urgency === "string") patch.urgency = fields.urgency;
  if (typeof fields.assignee === "string") patch.assignee = fields.assignee;

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

export async function createArticle(payload) {
  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const article = {
      id: `kb_${uid()}`,
      title: payload.title,
      orgId: payload.orgId,
      category: payload.category,
      author: payload.author,
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
    author: payload.author,
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

  if (shouldUseDemoMode()) {
    const state = getDemoState();
    const created = {
      id: `u_${uid()}`,
      name: payload.name,
      email: payload.email,
      role: roles[0] || "End User",
      roles,
      orgId: payload.orgId,
      teamId: payload.teamId,
      title: payload.title || "",
    };
    state.users.push(created);
    saveDemoState();
    return clone(created);
  }

  const row = {
    id: `u_${uid()}`,
    name: payload.name,
    email: payload.email,
    role: roles[0] || "End User",
    roles,
    org_id: payload.orgId,
    team_id: payload.teamId,
    title: payload.title || "",
    password: payload.password || "changeme",
  };

  let data;
  let error;

  ({ data, error } = await supabase
    .from(TABLES.users)
    .insert(row)
    .select("*")
    .single());

  if (error?.message?.toLowerCase().includes("roles") && error?.message?.toLowerCase().includes("column")) {
    ({ data, error } = await supabase
      .from(TABLES.users)
      .insert({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        org_id: row.org_id,
        team_id: row.team_id,
        title: row.title,
        password: row.password,
      })
      .select("*")
      .single());
  }

  fail(error, "Failed to add member.");
  return toUser(data);
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
      const slaHours = priorityCatalog[tk.priority]?.sla || 24;
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status };
    })
    .filter(({ slaStatus }) => slaStatus.isBreached);
}

export function findSLAAtRisk(tickets, priorityCatalog = {}) {
  return tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const slaHours = priorityCatalog[tk.priority]?.sla || 24;
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status };
    })
    .filter(({ slaStatus }) => slaStatus.isRisk && !slaStatus.isBreached);
}