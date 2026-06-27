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
  orgInvitations: "org_invitations",
  ticketSequences: "ticket_sequences",
  customReports: "custom_reports",
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
    authId: row.auth_id || null,   // UUID from auth.users — used for owner checks
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
  plan: row.plan || "Free",
  ownerAuthId: row.owner_auth_id || null,   // auth.users UUID of the org owner
  planStartDate: row.plan_start_date || null, // billing cycle anchor date
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
  number: row.number || row.id,
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
  customFields: (row.custom_fields && typeof row.custom_fields === "object" && !Array.isArray(row.custom_fields)) ? row.custom_fields : {},
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
    ticketTypes: Array.isArray(row?.ticket_types) && row.ticket_types.length ? row.ticket_types : [],
    orgRoles: Array.isArray(row?.org_roles) ? row.org_roles : [],
    customTicketFields: Array.isArray(row?.custom_ticket_fields) ? row.custom_ticket_fields : [],
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
  requestFields: Array.isArray(row.request_fields) ? row.request_fields : [],
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export async function createCatalogItem(payload) {
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
    request_fields: Array.isArray(payload.requestFields) ? payload.requestFields : [],
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
  const patch = {};
  if ("approverRole" in payload) patch.approver_role = payload.approverRole;
  if ("approverId" in payload) patch.approver_id = payload.approverId || null;
  if ("approverMode" in payload) patch.approver_mode = payload.approverMode || "role";
  if ("approverTeamId" in payload) patch.approver_team_id = payload.approverTeamId || null;
  if ("active" in payload) patch.active = !!payload.active;
  if ("requestFields" in payload) patch.request_fields = Array.isArray(payload.requestFields) ? payload.requestFields : [];

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

// Returns the next sequential ticket number for an org, e.g. INC-0042.
// resolvedPrefix is passed explicitly from the ticket type definition so custom
// types don't need entries in TICKET_PREFIX.
async function nextTicketId(type, orgId, prefix) {
  const resolvedPrefix = prefix || TICKET_PREFIX[type] || "TKT";

  const { data, error } = await supabase.rpc("next_ticket_seq", {
    p_org_id: orgId,
    p_prefix: resolvedPrefix,
  });
  if (error) throw new Error(error.message);
  return `${resolvedPrefix}-${String(data).padStart(4, "0")}`;
}

const getExistingUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
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

export async function loginWithEmailPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  // ── Primary path: Supabase Auth (secure, bcrypt-hashed) ──────────────────
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (!authError && authData?.session) {
    return getUserFromSession(authData.session);
  }

  // ── One-time migration path for legacy plaintext-password accounts ────────
  // Checks the old users table for a matching plaintext record, migrates it
  // to Supabase Auth, and immediately clears the plaintext password.
  const { data: legacyUser } = await supabase
    .from(TABLES.users)
    .select("id, email, password")
    .ilike("email", normalizedEmail)
    .eq("password", password)
    .maybeSingle();

  if (legacyUser?.id) {
    const { data: migratedAuth, error: migrateError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    // Clear plaintext password regardless of outcome
    await supabase.from(TABLES.users).update({ password: null }).eq("id", legacyUser.id);

    if (migrateError) throw new Error("Unable to sign in. Please reset your password.");

    if (!migratedAuth?.session) {
      throw new Error(
        "We've upgraded our security. Please check your email to confirm your account, then sign in again.",
      );
    }

    return getUserFromSession(migratedAuth.session);
  }

  // ── Neither path worked ───────────────────────────────────────────────────
  if (authError?.message?.includes("Email not confirmed")) {
    throw new Error(
      "Please confirm your email address first — check your inbox for a confirmation link.",
    );
  }
  throw new Error("Invalid email or password.");
}

export async function registerWithEmailPassword(payload) {
  const fullName       = String(payload?.fullName || "").trim();
  const email          = normalizeEmail(payload?.email);
  const password       = String(payload?.password || "");
  const orgName        = String(payload?.organizationName || "").trim()
    || `${fullName || email.split("@")[0] || "User"}'s Workspace`;
  const teamName       = String(payload?.teamName || "").trim();
  const title          = String(payload?.title || "").trim();

  if (!fullName)          throw new Error("Full name is required.");
  if (!email)             throw new Error("Email address is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  // Prevent duplicate accounts
  const existingUser = await getExistingUserByEmail(email);
  if (existingUser) throw new Error("An account with this email already exists.");

  // ── 1. Create Supabase Auth user (passwords hashed by Supabase, never stored in app DB) ──
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: window.location.origin,
    },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error("Failed to create account. Please try again.");

  // ── 2. Create org, team, and user profile (no password stored) ──
  const organisation = await createOrganisation({
    name: orgName,
    domain: email.split("@")[1] || "",
    industry: "Other",
    ownerAuthId: authData.user.id,  // marks this auth user as the org owner
  });

  const team = await createTeam({
    orgId: organisation.id,
    name: teamName || "General",
    lead: fullName,
    icon: "🏢",
  });

  const newUser = {
    id:      `usr_${uid()}`,
    auth_id: authData.user.id,   // UUID link to auth.users — never store the password
    name:    fullName,
    email,
    role:    "Owner",            // org creator is always Owner; only they can manage billing
    roles:   ["Owner", "Admin"], // Owner inherits all Admin permissions
    org_id:  organisation.id,
    team_id: team?.id || null,
    title,
  };

  const { data: userRow, error: userError } = await supabase
    .from(TABLES.users)
    .insert([newUser])
    .select()
    .single();

  if (userError) throw new Error("Failed to create user profile: " + userError.message);

  // ── 3. If Supabase requires email confirmation, signal the caller ──
  if (!authData.session) {
    return { requiresEmailConfirmation: true, email };
  }

  return toUser(userRow);
}

export async function loginWithGoogle() {
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

// Returns every org ID the user belongs to: their primary org plus any they joined via invitation.
export async function fetchUserOrgIds(userId, email) {
  const normalizedEmail = normalizeEmail(email);
  const [userRes, invitesRes] = await Promise.all([
    supabase.from(TABLES.users).select("org_id").eq("id", userId).single(),
    supabase.from(TABLES.orgInvitations)
      .select("org_id")
      .ilike("email", normalizedEmail)
      .eq("status", "Accepted"),
  ]);
  const orgIds = new Set();
  if (userRes.data?.org_id) orgIds.add(userRes.data.org_id);
  for (const inv of invitesRes.data || []) {
    if (inv.org_id) orgIds.add(inv.org_id);
  }
  return Array.from(orgIds);
}

export async function fetchAppData(scope = {}) {
  // Accept either orgIds (array) or orgId (string, backward-compat)
  const orgIds = Array.isArray(scope.orgIds)
    ? scope.orgIds.map((id) => String(id).trim()).filter(Boolean)
    : scope.orgId
    ? [String(scope.orgId).trim()]
    : [];

  if (!orgIds.length) {
    return {
      orgs: [], teams: [], users: [], tickets: [], articles: [],
      orgSettings: [], teamSettings: [], teamRoles: [], postIncidentReviews: [],
      closingTemplates: [], pirFieldConfigs: [], catalogItems: [], approvals: [],
    };
  }

  // Phase 1: fetch all org-scoped data in parallel.
  const [
    orgsRes, teamsRes, usersRes, ticketsRes, commentsRes, articlesRes,
    orgSettingsRes, reviewsRes, templatesRes, pirConfigsRes, catalogRes, approvalsRes,
  ] = await Promise.all([
    supabase.from(TABLES.orgs).select("*").in("id", orgIds).order("name", { ascending: true }),
    supabase.from(TABLES.teams).select("*").in("org_id", orgIds).order("name", { ascending: true }),
    supabase.from(TABLES.users).select("*").in("org_id", orgIds).order("name", { ascending: true }),
    supabase.from(TABLES.tickets).select("*").in("org_id", orgIds).order("created_at", { ascending: false }),
    supabase.from(TABLES.comments).select("*").order("created_at", { ascending: true }),
    supabase.from(TABLES.articles).select("*").in("org_id", orgIds).order("created_at", { ascending: false }),
    supabase.from(TABLES.orgSettings).select("*").in("org_id", orgIds),
    supabase.from(TABLES.postIncidentReviews).select("*").in("org_id", orgIds).order("updated_at", { ascending: false }),
    supabase.from(TABLES.closingTemplates).select("*").in("org_id", orgIds).order("created_at", { ascending: true }),
    supabase.from(TABLES.pirFieldConfigs).select("*").in("org_id", orgIds),
    supabase.from(TABLES.catalogItems).select("*").in("org_id", orgIds).order("created_at", { ascending: true }),
    supabase.from(TABLES.approvals).select("*").in("org_id", orgIds).order("created_at", { ascending: false }),
  ]);

  fail(orgsRes.error, "Failed to load organizations.");
  fail(teamsRes.error, "Failed to load teams.");
  fail(usersRes.error, "Failed to load users.");
  fail(ticketsRes.error, "Failed to load tickets.");
  fail(commentsRes.error, "Failed to load comments.");
  fail(articlesRes.error, "Failed to load articles.");
  fail(orgSettingsRes.error, "Failed to load organization settings.");
  fail(reviewsRes.error, "Failed to load post-incident reviews.");
  fail(templatesRes.error, "Failed to load templates.");
  fail(pirConfigsRes.error, "Failed to load PIR field configs.");
  fail(catalogRes.error, "Failed to load service catalog items.");
  fail(approvalsRes.error, "Failed to load approvals.");

  // Phase 2: load team settings/roles for ALL teams in the org so team
  // switching is instant (client-side filter, no extra round-trip).
  const allTeamIds = (teamsRes.data || []).map((t) => t.id);
  const safeIds = allTeamIds.length ? allTeamIds : ["__none__"];
  const [teamSettingsRes, teamRolesRes] = await Promise.all([
    supabase.from(TABLES.teamSettings).select("*").in("team_id", safeIds),
    supabase.from(TABLES.teamRoles).select("*").in("team_id", safeIds),
  ]);
  fail(teamSettingsRes.error, "Failed to load team settings.");
  fail(teamRolesRes.error, "Failed to load team roles.");

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
    catalogItems: (catalogRes.data || []).map(toCatalogItem),
    approvals: (approvalsRes.data || []).map(toApproval),
  };
}

export async function createTicket(payload) {
  const row = {
    id: `tkt_${uid()}`,
    number: await nextTicketId(payload.type, payload.orgId, payload.prefix),
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
    custom_fields: (payload.customFields && typeof payload.customFields === "object") ? payload.customFields : {},
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
  if ("customFields" in fields && fields.customFields && typeof fields.customFields === "object" && !Array.isArray(fields.customFields)) {
    patch.custom_fields = fields.customFields;
  }

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
  const row = {
    id: `o_${uid()}`,
    name: payload.name,
    domain: payload.domain || "",
    industry: payload.industry || "Other",
    plan: "Free",                                       // always start Free
    plan_start_date: new Date().toISOString(),
    ...(payload.ownerAuthId ? { owner_auth_id: payload.ownerAuthId } : {}),
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

export async function updateTeam(teamId, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.lead !== undefined) row.lead = patch.lead;

  const { data, error } = await supabase
    .from(TABLES.teams)
    .update(row)
    .eq("id", teamId)
    .select("*")
    .single();

  fail(error, "Failed to update team.");
  return toTeam(data);
}

export async function deleteTeam(teamId) {
  // Remove team members' team assignment first
  await supabase.from(TABLES.users).update({ team_id: null }).eq("team_id", teamId);
  // Delete the team record
  const { error } = await supabase.from(TABLES.teams).delete().eq("id", teamId);
  fail(error, "Failed to delete team.");
}

export async function createMember(payload) {
  const roles = normalizeUserRoles(payload.roles, payload.role);

  // Check if user already exists globally
  const existing = await getExistingUserByEmail(payload.email || "");

  // If user exists in THIS org, nothing to do
  if (existing && (existing.org_id === payload.orgId || existing.orgId === payload.orgId)) {
    throw new Error("This user is already a member of this organization.");
  }

  // Registration path: password provided + no existing account
  // → create via Supabase Auth admin (password hashed server-side, never stored in app DB)
  if (payload.password && !existing) {
    const memberEmail = normalizeEmail(payload.email);
    const memberName  = String(payload.name || memberEmail.split("@")[0] || "User").trim();

    // Call the admin-create-user edge function (uses service role)
    const { data: edgeResp, error: edgeErr } = await supabase.functions.invoke("admin-create-user", {
      body: { email: memberEmail, password: payload.password },
    });
    if (edgeErr || edgeResp?.error) {
      throw new Error(edgeResp?.error || edgeErr?.message || "Failed to create member account.");
    }

    const authId = edgeResp?.auth_id || null;

    const newUser = {
      id:      `usr_${uid()}`,
      auth_id: authId,
      name:    memberName,
      email:   memberEmail,
      role:    roles[0] || "End User",
      roles,
      org_id:  payload.orgId,
      team_id: payload.teamId || null,
      title:   String(payload.title || "").trim(),
    };
    const { data, error } = await supabase
      .from(TABLES.users)
      .insert([newUser])
      .select()
      .single();
    if (error) throw new Error("Failed to create member: " + error.message);
    return toUser(data);
  }

  // User doesn't have an account yet, or is in a different org —
  // create an invite that will be waiting for them when they sign up.
  const inviteRow = {
    id: `inv_${uid()}`,
    org_id: payload.orgId,
    team_id: payload.teamId || null,
    email: normalizeEmail(payload.email),
    role: roles[0] || "End User",
    roles,
    status: "Pending",
    sent_at: Date.now(),
    accepted_at: null,
  };

  const { error: inviteError } = await supabase.from(TABLES.orgInvitations).insert(inviteRow);
  if (inviteError) {
    throw new Error("Failed to send invitation. Please try again.");
  }

  return { inviteSent: true, email: payload.email };
}

export async function fetchOrgInvitationsForUser(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const { data, error } = await supabase
    .from(TABLES.orgInvitations)
    .select("*")
    .ilike("email", normalizedEmail)
    .eq("status", "Pending")
    .order("sent_at", { ascending: false });

  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    teamId: row.team_id,
    email: row.email,
    role: row.role,
    roles: row.roles,
    status: row.status,
    sentAt: row.sent_at,
  }));
}

export async function acceptOrgInvitation(invitationId) {
  const { data: inv, error: fetchInvError } = await supabase
    .from(TABLES.orgInvitations)
    .select("org_id,team_id,role,roles")
    .eq("id", invitationId)
    .single();

  if (fetchInvError || !inv) throw new Error("Invitation not found.");

  const { error: updateInvError } = await supabase
    .from(TABLES.orgInvitations)
    .update({ status: "Accepted", accepted_at: Date.now() })
    .eq("id", invitationId);

  if (updateInvError) throw new Error("Failed to accept invitation.");

  // Keep users.org_id pointing at the user's primary (created) org.
  // Additional org memberships are tracked through accepted org_invitations.
  const invRoles = Array.isArray(inv.roles) && inv.roles.length ? inv.roles : [inv.role || "End User"];
  return { accepted: true, orgId: inv.org_id, teamId: inv.team_id || null, role: invRoles[0], roles: invRoles };
}

export async function declineOrgInvitation(invitationId) {
  const { error } = await supabase
    .from(TABLES.orgInvitations)
    .update({ status: "Declined" })
    .eq("id", invitationId);

  if (error) throw new Error("Failed to decline invitation.");
  return { declined: true };
}

export async function joinOrgByCode(code, userEmail) {
  const cleaned = String(code || "").trim().toUpperCase().replace(/^JOIN-?/i, "").replace(/-/g, "");
  if (cleaned.length !== 8) throw new Error("Invalid join code — expected format: JOIN-XXXXXXXX");

  // UUID first segment is always 8 hex chars before the first dash
  const { data: orgs, error } = await supabase
    .from(TABLES.orgs)
    .select("id, name")
    .ilike("id", `${cleaned.toLowerCase()}%`);
  if (error) throw new Error("Failed to look up join code.");
  if (!orgs?.length) throw new Error("No organization found with that join code.");
  const org = orgs[0];

  const email = normalizeEmail(userEmail);

  // Check for existing invitation
  const { data: existing } = await supabase
    .from(TABLES.orgInvitations)
    .select("id, status")
    .eq("org_id", org.id)
    .ilike("email", email)
    .maybeSingle();

  if (existing?.status === "Accepted") {
    throw new Error("You're already a member of this organization.");
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from(TABLES.orgInvitations)
      .update({ status: "Accepted" })
      .eq("id", existing.id);
    if (updErr) throw new Error("Failed to join organization.");
  } else {
    const { error: insErr } = await supabase
      .from(TABLES.orgInvitations)
      .insert({ id: `inv_${uid()}`, org_id: org.id, email, role: "End User", status: "Accepted", sent_at: Date.now() });
    if (insErr) throw new Error("Failed to join organization.");
  }

  return { orgId: org.id, orgName: org.name };
}

export async function fetchOrgInvitationsForOrg(orgId) {
  const { data, error } = await supabase
    .from(TABLES.orgInvitations)
    .select("*")
    .eq("org_id", orgId)
    .order("sent_at", { ascending: false });
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    teamId: row.team_id,
    email: row.email,
    role: row.role,
    status: row.status,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
  }));
}

export async function sendOrgInvitation(orgId, email, role = "End User", teamId = null) {
  const row = {
    id: `inv_${uid()}`,
    org_id: orgId,
    team_id: teamId || null,
    email: normalizeEmail(email),
    role,
    status: "Pending",
    sent_at: Date.now(),
    accepted_at: null,
  };
  const { data, error } = await supabase.from(TABLES.orgInvitations).insert(row).select("*").single();
  if (error) throw new Error("Failed to send invitation.");
  return { id: data.id, orgId: data.org_id, email: data.email, role: data.role, status: data.status, sentAt: data.sent_at };
}

export async function cancelOrgInvitation(invitationId) {
  const { error } = await supabase
    .from(TABLES.orgInvitations)
    .update({ status: "Cancelled" })
    .eq("id", invitationId);
  if (error) throw new Error("Failed to cancel invitation.");
  return { cancelled: true };
}

export async function fetchApiKeys(orgId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, org_id, name, key_prefix, created_by, created_at, last_used_at, is_active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    isActive: row.is_active,
  }));
}

export async function createApiKey(orgId, name, createdBy) {
  const rawKey = `enk_${uid()}${uid()}`.slice(0, 40);
  const row = {
    id: `key_${uid()}`,
    org_id: orgId,
    name,
    key_value: rawKey,
    key_prefix: `${rawKey.slice(0, 12)}...`,
    created_by: createdBy || null,
    created_at: Date.now(),
    last_used_at: null,
    is_active: true,
  };
  const { data, error } = await supabase.from("api_keys").insert(row).select("*").single();
  if (error) throw new Error("Failed to create API key.");
  return {
    id: data.id,
    orgId: data.org_id,
    name: data.name,
    keyPrefix: data.key_prefix,
    fullKey: rawKey,
    createdAt: data.created_at,
    isActive: data.is_active,
  };
}

export async function revokeApiKey(keyId) {
  const { error } = await supabase.from("api_keys").delete().eq("id", keyId);
  if (error) throw new Error("Failed to revoke API key.");
  return { revoked: true };
}

// ── Custom Reports ────────────────────────────────────────────────────────────

export async function fetchCustomReports(orgId) {
  const { data, error } = await supabase
    .from(TABLES.customReports)
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...r.config, id: r.id, name: r.name, orgId: r.org_id, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function saveCustomReport(orgId, report) {
  const now = Date.now();

  const row = {
    id: report.id,
    org_id: orgId,
    name: report.name || "Untitled Report",
    config: report,
    created_at: report.createdAt || now,
    updated_at: now,
  };
  const { error } = await supabase.from(TABLES.customReports).upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return report;
}

export async function deleteCustomReport(reportId) {
  const { error } = await supabase.from(TABLES.customReports).delete().eq("id", reportId);
  if (error) throw new Error(error.message);
  return { deleted: true };
}

export async function updateMemberRoles(userId, rolesInput) {
  const roles = normalizeUserRoles(rolesInput, "End User");

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
  const row = {
    org_id: payload.orgId,
    priorities: normalizePriorities(payload.priorities),
    urgencies: normalizeUrgencies(payload.urgencies),
    categories: Array.isArray(payload.categories) && payload.categories.length ? payload.categories.map((c) => String(c)) : CATEGORIES,
    role_permissions: payload.rolePermissions || {},
    require_approvals: !!payload.requireApprovals,
    approval_mode: payload.approvalMode || "all",
    ticket_types: Array.isArray(payload.ticketTypes) ? payload.ticketTypes : [],
    org_roles: Array.isArray(payload.orgRoles) ? payload.orgRoles : [],
    custom_ticket_fields: Array.isArray(payload.customTicketFields) ? payload.customTicketFields : [],
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
  const { error } = await supabase
    .from(TABLES.closingTemplates)
    .delete()
    .eq("id", templateId);

  if (error) throw new Error(error.message || "Failed to delete template.");
  return true;
}

export async function upsertPirFieldConfig(payload) {
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

// Row mappers exposed for use in realtime subscription handlers.
// These transform raw Supabase postgres_changes payloads (snake_case DB rows)
// into the same camelCase objects that fetchAppData produces.
export const rowMappers = {
  ticket:         (row) => toTicket(row, {}),
  comment:        toComment,
  user:           toUser,
  org:            toOrg,
  team:           toTeam,
  article:        toArticle,
  orgSettings:    toOrgSettings,
  teamSettings:   toTeamSettings,
  teamRole:       toTeamRole,
  postReview:     toPostIncidentReview,
  closingTemplate: toClosingTemplate,
  pirFieldConfig: toPirFieldConfig,
  catalogItem:    toCatalogItem,
  approval:       toApproval,
};

