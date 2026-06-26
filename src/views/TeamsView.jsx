import { useEffect, useMemo, useState } from "react";
import { DEFAULT_TICKET_TYPES, DEFAULT_URGENCIES, PERMISSION_GROUPS, PRIORITIES, ROLE_COLORS, ROLE_PERMISSION_DEFAULTS, TICKET_TYPES } from "../core/constants.js";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { Avatar, Badge, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { PlansModal, PlanBadge } from "../ui/UpgradeGate.jsx";
import { fetchOrgInvitationsForOrg, sendOrgInvitation, cancelOrgInvitation, fetchApiKeys, createApiKey, revokeApiKey } from "../core/api.js";

const TEAM_ICONS = [
  { key: "IT",   emoji: "💻", label: "IT"   },
  { key: "ENG",  emoji: "⚙️",  label: "Eng"  },
  { key: "OPS",  emoji: "🏭", label: "Ops"  },
  { key: "APP",  emoji: "📱", label: "App"  },
  { key: "NET",  emoji: "🌐", label: "Net"  },
  { key: "SEC",  emoji: "🔒", label: "Sec"  },
  { key: "DATA", emoji: "📊", label: "Data" },
  { key: "QA",   emoji: "✅", label: "QA"   },
  { key: "PM",   emoji: "📋", label: "PM"   },
  { key: "UX",   emoji: "🎨", label: "UX"   },
  { key: "HR",   emoji: "👥", label: "HR"   },
  { key: "FIN",  emoji: "💰", label: "Fin"  },
  { key: "MKT",  emoji: "📣", label: "Mkt"  },
  { key: "SALES",emoji: "🤝", label: "Sales"},
  { key: "RD",   emoji: "🧪", label: "R&D"  },
  { key: "LEG",  emoji: "⚖️",  label: "Legal"},
];

// Maps stored key → emoji (handles old data stored as text like "IT", "ENG")
const ICON_EMOJI = Object.fromEntries(TEAM_ICONS.map((i) => [i.key, i.emoji]));
const teamEmoji = (icon) => ICON_EMOJI[icon] || icon || "🏢";
const FALLBACK_ROLES = ["Admin", "Agent", "End User"];

const defaultPriorityRows = () => Object.entries(PRIORITIES).map(([name, cfg]) => ({
  name,
  color: cfg.color,
  sla: cfg.sla,
}));

const isValidHexColor = (color) => {
  const hex = String(color || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
};

// Merge existing org setting with tab-specific changes to prevent cross-field wipeout
const mergeOrgSetting = (orgSetting, changes) => ({
  priorities: normalizePriorityRows(orgSetting?.priorities),
  urgencies: orgSetting?.urgencies?.length ? orgSetting.urgencies : DEFAULT_URGENCIES,
  categories: orgSetting?.categories?.length ? orgSetting.categories : [],
  rolePermissions: orgSetting?.rolePermissions || {},
  requireApprovals: orgSetting?.requireApprovals || false,
  approvalMode: orgSetting?.approvalMode || "all",
  ticketTypes: orgSetting?.ticketTypes || [],
  orgRoles: orgSetting?.orgRoles || [],
  ...changes,
});

const fmtDate = (ts) => {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const normalizePriorityRows = (rows) => {
  const list = (rows || [])
    .map((row) => {
      const rawColor = row?.color;
      const name = String(row?.name || "").trim();
      
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
        sla: Number(row?.sla || 0),
      };
    })
    .filter((row) => row.name && row.sla > 0);
  return list.length ? list : defaultPriorityRows();
};

export function TeamsView({
  orgs,
  teams,
  users,
  tickets,
  orgSettings,
  teamSettings,
  closingTemplates = [],
  pirFieldConfigs = [],
  teamRoles,
  plan,
  onCreateOrg,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onCreateMember,
  onUpdateMemberRoles,
  onSaveOrgSettings,
  onSaveTeamSettings,
  onAddTeamRole,
  onCreateClosingTemplate,
  onUpdateClosingTemplate,
  onDeleteClosingTemplate,
  onUpsertPirFieldConfig,
  onUpgradePlan,
}) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  const [selOrg, setSelOrg] = useState(orgs[0]?.id);
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addMemberTeam, setAddMemberTeam] = useState(null);
  const [editRolesUserId, setEditRolesUserId] = useState(null);
  const [settingsOrgOpen, setSettingsOrgOpen] = useState(false);
  const [settingsTeamId, setSettingsTeamId] = useState(null);
  const [settingsTab, setSettingsTab] = useState("sla");
  const [templateEditor, setTemplateEditor] = useState(null); // { orgId, teamId, template }
  const [addRoleTeamId, setAddRoleTeamId] = useState(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);     // inline rename
  const [editTeamName, setEditTeamName] = useState("");
  const [deleteTeamId, setDeleteTeamId] = useState(null); // delete confirmation

  useEffect(() => {
    if (!orgs.length) {
      setSelOrg(undefined);
      return;
    }
    if (!selOrg || !orgs.some((o) => o.id === selOrg)) {
      setSelOrg(orgs[0].id);
    }
  }, [orgs, selOrg]);

  const org = orgs.find((o) => o.id === selOrg);
  const [teamFilter, setTeamFilter] = useState("");
  const [compactView, setCompactView] = useState(false);
  const totalTeams = useMemo(() => teams.filter((tm) => tm.orgId === selOrg), [teams, selOrg]);
  const orgTeams = useMemo(() => {
    const list = teams.filter((tm) => tm.orgId === selOrg);
    if (!teamFilter || !teamFilter.trim()) return list;
    const q = teamFilter.trim().toLowerCase();
    return list.filter((t) => String(t.name || "").toLowerCase().includes(q));
  }, [teams, selOrg, teamFilter]);
  const selectedTeam = teams.find((tm) => tm.id === settingsTeamId);
  const roleTeam = teams.find((tm) => tm.id === addRoleTeamId);
  const selectedMember = users.find((u) => u.id === editRolesUserId);
  const selectedMemberTeamRoles = teamRoles.filter((r) => r.teamId === selectedMember?.teamId);

  const orgSetting = orgSettings.find((row) => row.orgId === selOrg);

  const templatesForOrg = (orgId, teamId) => (
    closingTemplates.filter((tmpl) => tmpl.orgId === orgId && (!tmpl.teamId || tmpl.teamId === teamId || tmpl.teamId === ""))
  );

  const pirConfigFor = (orgId, teamId) => (
    pirFieldConfigs.find((cfg) => cfg.orgId === orgId && (cfg.teamId === (teamId || ""))) || null
  );

  if (!orgs || orgs.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Card style={{ padding: 24, textAlign: "center", maxWidth: 680 }}>
          <h2 style={{ margin: "0 0 8px" }}>Welcome to EurekaNow</h2>
          <div style={{ fontSize: 13, color: t.text3, marginBottom: 14 }}>You don't have any organisations yet. Start by creating one to invite teammates and add teams.</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <Btn variant="primary" onClick={() => setAddOrgOpen(true)}>Create organisation</Btn>
            <Btn variant="secondary" onClick={() => setPlansOpen(true)}>Explore plans</Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {isMobile && (
        <div style={{ marginBottom: 16 }}>
          <Label>Organisation</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Sel value={selOrg} onChange={(e) => setSelOrg(e.target.value)} style={{ flex: 1 }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Sel>
            <Btn variant="secondary" size="sm" onClick={() => setAddOrgOpen(true)}>
              <I name="plus" size={13} />
            </Btn>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {!isMobile && (
          <div style={{ width: 230, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3 }}>Organisations</span>
              <button onClick={() => setAddOrgOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: t.accent }}>
                <I name="plus" size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelOrg(o.id)}
                  style={{
                    background: selOrg === o.id ? t.accentBg : t.surface,
                    border: `1px solid ${selOrg === o.id ? t.accent : t.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: t.font,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: selOrg === o.id ? t.accentText : t.text }}>{o.name}</div>
                  <div style={{ fontSize: 10, color: t.text3, marginTop: 2 }}>{o.industry}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {org && (
            <>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, margin: "0 0 6px", color: t.text }}>{org.name}</h2>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge label={org.industry} color={t.accentText} bg={t.accentBg} />
                      <PlanBadge plan={org.plan} onClick={() => setPlansOpen(true)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn variant="secondary" size="sm" onClick={() => setSettingsOrgOpen(true)}>
                      <I name="settings" size={12} /> SLA & Priority
                    </Btn>
                    <Btn variant="secondary" size="sm" onClick={() => setPlansOpen(true)}>
                      <I name="zap" size={12} /> Upgrade
                    </Btn>
                    <Btn variant="secondary" size="sm" onClick={() => setAddTeamOpen(true)}>
                      <I name="plus" size={12} /> Team
                    </Btn>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
                  {[
                    ["Teams", orgTeams.length],
                    ["Members", users.filter((u) => u.orgId === selOrg).length],
                    ["Open", tickets.filter((tk) => tk.orgId === selOrg && !["Resolved", "Closed"].includes(tk.status)).length],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: t.surface2, borderRadius: 9, padding: "8px 12px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <Input aria-label="Search teams" placeholder="Search teams" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ minWidth: 200 }} />
                  <Btn variant={compactView ? "primary" : "ghost"} size="sm" onClick={() => setCompactView((s) => !s)} aria-pressed={compactView} aria-label="Toggle compact view">{compactView ? "Compact" : "Comfort"}</Btn>
                  <div style={{ marginLeft: "auto", fontSize: 12, color: t.text3 }}>Showing {orgTeams.length} of {totalTeams.length} teams</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: t.text3 }}>
                  Active urgencies: {(orgSetting?.urgencies || DEFAULT_URGENCIES).join(", ")}
                </div>
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {orgTeams.map((team) => {
                  const members = users.filter((u) => u.teamId === team.id);
                  const lead = users.find((u) => u.id === team.lead);
                  const openCount = tickets.filter((tk) => tk.teamId === team.id && !["Resolved", "Closed"].includes(tk.status)).length;
                  const roles = teamRoles.filter((r) => r.teamId === team.id);
                  const teamCfg = teamSettings.find((cfg) => cfg.teamId === team.id);

                  return (
                    <Card key={team.id} noPad style={compactView ? { padding: 6 } : undefined}>
                      <div style={{ padding: compactView ? "8px 10px" : "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: compactView ? 16 : 22, flexShrink: 0 }}>{teamEmoji(team.icon)}</span>
                          {editTeamId === team.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                autoFocus
                                value={editTeamName}
                                onChange={(e) => setEditTeamName(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter" && editTeamName.trim()) {
                                    await onUpdateTeam?.(team.id, { name: editTeamName.trim() });
                                    setEditTeamId(null);
                                  }
                                  if (e.key === "Escape") setEditTeamId(null);
                                }}
                                style={{ fontSize: 14, fontWeight: 700, padding: "3px 8px", border: `1px solid ${t.accent}`, borderRadius: 6, background: t.surface2, color: t.text, width: 180 }}
                              />
                              <Btn size="sm" variant="primary" onClick={async () => {
                                if (editTeamName.trim()) {
                                  await onUpdateTeam?.(team.id, { name: editTeamName.trim() });
                                  setEditTeamId(null);
                                }
                              }}>Save</Btn>
                              <Btn size="sm" variant="ghost" onClick={() => setEditTeamId(null)}>Cancel</Btn>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ fontSize: compactView ? 12 : 14, fontWeight: 700, color: t.text }}>{team.name}</div>
                                <button
                                  title="Rename team"
                                  onClick={() => { setEditTeamId(team.id); setEditTeamName(team.name); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, padding: "0 2px", lineHeight: 1, fontSize: 12, opacity: 0.6 }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
                                >✏️</button>
                              </div>
                              {!compactView && lead && <div style={{ fontSize: 10, color: t.text3 }}>Lead: {lead.name}</div>}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          {openCount > 0 && <Badge label={`${openCount} open`} color={t.yellowText} bg={t.yellowBg} />}
                          <Btn variant="secondary" size="sm" onClick={() => setSettingsTeamId(team.id)}>
                            <I name="settings" size={11} /> Settings
                          </Btn>
                          <Btn variant="secondary" size="sm" onClick={() => setAddRoleTeamId(team.id)}>
                            <I name="plus" size={11} /> Role
                          </Btn>
                          <Btn variant="secondary" size="sm" onClick={() => setAddMemberTeam(team.id)}>
                            <I name="plus" size={11} /> Member
                          </Btn>
                          <Btn variant="danger" size="sm" onClick={() => setDeleteTeamId(team.id)}>
                            Delete
                          </Btn>
                        </div>
                      </div>

                      <div style={{ padding: compactView ? "6px 10px" : "8px 16px", borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 10, color: t.text3, marginBottom: 4 }}>Team roles</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {roles.length === 0 && <span style={{ fontSize: 11, color: t.text3 }}>No custom roles yet.</span>}
                          {roles.map((role) => (
                            <Badge key={role.id} label={role.name} color={t.accentText} bg={t.accentBg} size={10} />
                          ))}
                        </div>
                        {!compactView && <div style={{ marginTop: 6, fontSize: 10, color: t.text3 }}>
                          Urgencies: {(teamCfg?.urgencies || orgSetting?.urgencies || DEFAULT_URGENCIES).join(" / ")}
                        </div>}
                      </div>

                      {members.map((u, i) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: compactView ? "6px 10px" : "10px 16px", borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
                          <Avatar name={u.name} size={compactView ? 24 : 30} fs={10} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: compactView ? 12 : 13, fontWeight: 600, color: t.text }}>{u.name}</div>
                            {!compactView && <div style={{ fontSize: 10, color: t.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {(Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role].filter(Boolean)).map((role) => (
                              <Badge key={`${u.id}-${role}`} label={role} color={t.blueText} bg={t.blueBg} />
                            ))}
                          </div>
                          <Btn variant="secondary" size="sm" onClick={() => setEditRolesUserId(u.id)}>
                            Roles
                          </Btn>
                        </div>
                      ))}
                      {members.length === 0 && <div style={{ padding: "12px 16px", fontSize: 12, color: t.text3, fontStyle: "italic" }}>No members yet.</div>}
                    </Card>
                  );
                })}
                {orgTeams.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: t.text3, fontSize: 13 }}>
                    <div>No teams yet. Create one to get started.</div>
                    <div style={{ marginTop: 12 }}>
                      <Btn variant="primary" onClick={() => setAddTeamOpen(true)} aria-label="Create team">Create Team</Btn>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {addOrgOpen && (
        <Modal title="New Organisation" onClose={() => setAddOrgOpen(false)} width={440}>
          <AddOrgForm
            onSave={async (o) => {
              const created = await onCreateOrg(o);
              setSelOrg(created.id);
              setAddOrgOpen(false);
            }}
            onCancel={() => setAddOrgOpen(false)}
          />
        </Modal>
      )}

      {addTeamOpen && (
        <Modal title="New Team" onClose={() => setAddTeamOpen(false)} width={460}>
          <AddTeamForm
            orgs={orgs}
            users={users}
            defaultOrgId={selOrg}
            onSave={async (tm) => {
              await onCreateTeam(tm);
              setAddTeamOpen(false);
            }}
            onCancel={() => setAddTeamOpen(false)}
          />
        </Modal>
      )}

      {addMemberTeam && (
        <Modal title="Add Member" onClose={() => setAddMemberTeam(null)} width={460}>
          <AddMemberForm
            teamId={addMemberTeam}
            teams={teams}
            orgs={orgs}
            users={users}
            teamRoles={teamRoles.filter((r) => r.teamId === addMemberTeam)}
            onSave={async (u) => {
              await onCreateMember(u);
              setAddMemberTeam(null);
            }}
            onCancel={() => setAddMemberTeam(null)}
          />
        </Modal>
      )}

      {deleteTeamId && (
        <Modal title="Delete Team" onClose={() => setDeleteTeamId(null)} width={420}>
          <div style={{ fontSize: 14, color: t.text, marginBottom: 20, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: t.text }}>{teams.find((tm) => tm.id === deleteTeamId)?.name}</strong>? This cannot be undone. Members will be unassigned from the team.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setDeleteTeamId(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={async () => {
              await onDeleteTeam?.(deleteTeamId);
              setDeleteTeamId(null);
            }}>Delete Team</Btn>
          </div>
        </Modal>
      )}

      {settingsOrgOpen && org && (
        <Modal title="Organisation Settings" onClose={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }} width={1040}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 200 }}>
              {[
                { id: "sla", label: "SLA & Priority" },
                { id: "permissions", label: "Permissions" },
                { id: "orgroles", label: "Org Roles" },
                { id: "categories", label: "Categories" },
                { id: "ticket_types", label: "Ticket Types" },
                { id: "templates", label: "Templates" },
                { id: "pir", label: "PIR Fields" },
                { id: "invitations", label: "Invitations" },
                { id: "apikeys", label: "API Keys" },
                { id: "joincode", label: "Join Code" },
              ].map((it) => (
                <Btn
                  key={it.id}
                  variant={settingsTab === it.id ? "primary" : "ghost"}
                  full
                  size="md"
                  onClick={() => setSettingsTab(it.id)}
                  style={{ justifyContent: "flex-start", textAlign: "left", padding: "8px 10px", marginBottom: 6, borderRadius: 8 }}
                >
                  {it.label}
                </Btn>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              {settingsTab === "sla" && (
                <SettingsForm
                  defaultPriorities={normalizePriorityRows(orgSetting?.priorities)}
                  defaultUrgencies={orgSetting?.urgencies || DEFAULT_URGENCIES}
                  onSave={async (settings) => {
                    await onSaveOrgSettings(mergeOrgSetting(orgSetting, { orgId: org.id, ...settings }));
                    setSettingsOrgOpen(false);
                    setSettingsTab("sla");
                  }}
                  onCancel={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }}
                />
              )}

              {settingsTab === "permissions" && (
                <PermissionsForm
                  orgId={org.id}
                  orgSetting={orgSetting}
                  users={users.filter((u) => u.orgId === org.id)}
                  teamRoles={teamRoles}
                  onCancel={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }}
                  onSave={async (settings) => {
                    await onSaveOrgSettings(mergeOrgSetting(orgSetting, { orgId: org.id, ...settings }));
                    setSettingsOrgOpen(false);
                    setSettingsTab("sla");
                  }}
                  onUpdateMemberRoles={onUpdateMemberRoles}
                />
              )}

              {settingsTab === "orgroles" && (
                <OrgRolesTab
                  orgSetting={orgSetting}
                  onSave={async (orgRoles) => {
                    await onSaveOrgSettings(mergeOrgSetting(orgSetting, { orgId: org.id, orgRoles }));
                  }}
                />
              )}

              {settingsTab === "categories" && (
                <CategoriesForm
                  defaultCategories={orgSetting?.categories || []}
                  onSave={async (settings) => {
                    await onSaveOrgSettings(mergeOrgSetting(orgSetting, { orgId: org.id, ...settings }));
                    setSettingsOrgOpen(false);
                    setSettingsTab("sla");
                  }}
                  onCancel={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }}
                />
              )}

              {settingsTab === "ticket_types" && (
                <TicketTypesForm
                  defaultTypes={orgSetting?.ticketTypes?.length ? orgSetting.ticketTypes : DEFAULT_TICKET_TYPES}
                  onSave={async (ticketTypes) => {
                    await onSaveOrgSettings(mergeOrgSetting(orgSetting, { orgId: org.id, ticketTypes }));
                    setSettingsOrgOpen(false);
                    setSettingsTab("sla");
                  }}
                  onCancel={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }}
                />
              )}

              {settingsTab === "templates" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Closing Templates</div>
                    <Btn variant="primary" size="sm" onClick={() => setTemplateEditor({ orgId: org.id, teamId: "", template: null })}>Add Template</Btn>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {templatesForOrg(org.id, "").map((tmpl) => (
                      <div key={tmpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{tmpl.name}</div>
                          <div style={{ fontSize: 12, color: t.text3 }}>{tmpl.description}</div>
                          <div style={{ fontSize: 11, color: t.text3, marginTop: 6 }}>Applies to: {tmpl.applyToTypes.join(", ")}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn size="sm" variant="secondary" onClick={() => setTemplateEditor({ orgId: org.id, teamId: tmpl.teamId || "", template: tmpl })}>Edit</Btn>
                          <Btn size="sm" variant="danger" onClick={async () => { await onDeleteClosingTemplate?.(tmpl.id); }}>
                            Delete
                          </Btn>
                        </div>
                      </div>
                    ))}
                    {templatesForOrg(org.id, "").length === 0 && <div style={{ color: t.text3 }}>No templates yet.</div>}
                  </div>
                </div>
              )}

              {settingsTab === "pir" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>PIR Field Config</div>
                  </div>
                  <div>
                    <PirEditor
                      orgId={org.id}
                      teamId={""}
                      initial={pirConfigFor(org.id, "")}
                      onSave={async (cfg) => { await onUpsertPirFieldConfig?.({ orgId: org.id, teamId: "", fields: cfg }); setSettingsOrgOpen(false); setSettingsTab("sla"); }}
                    />
                  </div>
                </div>
              )}

              {settingsTab === "joincode" && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Organisation Join Code</div>
                  <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 12, color: t.text3, marginBottom: 12 }}>
                      Share this code with team members to allow them to join your organization.
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <input
                        type="text"
                        value={`JOIN-${org.id.toUpperCase().slice(0, 8)}`}
                        readOnly
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          fontSize: 14,
                          fontFamily: t.mono,
                          fontWeight: 700,
                          border: `1px solid ${t.border}`,
                          borderRadius: 6,
                          background: t.surface,
                          color: t.text,
                        }}
                      />
                      <Btn
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`JOIN-${org.id.toUpperCase().slice(0, 8)}`);
                        }}
                      >
                        Copy
                      </Btn>
                    </div>
                    <div style={{ fontSize: 11, color: t.text3, lineHeight: 1.6 }}>
                      <strong>How it works:</strong>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                        <li>Share this code with team members</li>
                        <li>They can use this code to request access to your organization</li>
                        <li>Org admins will be notified of join requests</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "invitations" && (
                <InvitationsTab orgId={org.id} teams={teams.filter((tm) => tm.orgId === org.id)} />
              )}

              {settingsTab === "apikeys" && (
                <ApiKeysTab orgId={org.id} currentUserId={users.find((u) => u.orgId === org.id)?.id} />
              )}
            </div>
          </div>
        </Modal>
      )}

      {settingsTeamId && selectedTeam && (
        <Modal title={`Team Settings — ${selectedTeam.name}`} onClose={() => { setSettingsTeamId(null); setSettingsTab("sla"); }} width={820}>
          <div style={{ display: "flex", gap: 12, minHeight: 480 }}>
            <div style={{ width: 180, flexShrink: 0 }}>
              {[
                { id: "sla", label: "SLA & Priority" },
                { id: "templates", label: "Templates" },
                { id: "pir", label: "PIR Fields" },
              ].map((it) => (
                <Btn
                  key={it.id}
                  variant={settingsTab === it.id ? "primary" : "ghost"}
                  full
                  size="md"
                  onClick={() => setSettingsTab(it.id)}
                  style={{ justifyContent: "flex-start", textAlign: "left", padding: "8px 10px", marginBottom: 6, borderRadius: 8 }}
                >
                  {it.label}
                </Btn>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {settingsTab === "sla" && (
                <SettingsForm
                  defaultPriorities={normalizePriorityRows(teamSettings.find((cfg) => cfg.teamId === settingsTeamId)?.priorities || orgSetting?.priorities)}
                  defaultUrgencies={teamSettings.find((cfg) => cfg.teamId === settingsTeamId)?.urgencies || orgSetting?.urgencies || DEFAULT_URGENCIES}
                  onSave={async (settings) => {
                    await onSaveTeamSettings({ teamId: settingsTeamId, ...settings });
                    setSettingsTeamId(null);
                    setSettingsTab("sla");
                  }}
                  onCancel={() => { setSettingsTeamId(null); setSettingsTab("sla"); }}
                />
              )}

              {settingsTab === "templates" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Closing Templates</div>
                    <Btn variant="primary" size="sm" onClick={() => setTemplateEditor({ orgId: org.id, teamId: selectedTeam.id, template: null })}>Add Template</Btn>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {templatesForOrg(org.id, selectedTeam.id).map((tmpl) => (
                      <div key={tmpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{tmpl.name}</div>
                          <div style={{ fontSize: 12, color: t.text3 }}>{tmpl.description}</div>
                          <div style={{ fontSize: 11, color: t.text3, marginTop: 6 }}>Applies to: {tmpl.applyToTypes.join(", ")}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn size="sm" variant="secondary" onClick={() => setTemplateEditor({ orgId: org.id, teamId: tmpl.teamId || "", template: tmpl })}>Edit</Btn>
                          <Btn size="sm" variant="danger" onClick={async () => { await onDeleteClosingTemplate?.(tmpl.id); }}>
                            Delete
                          </Btn>
                        </div>
                      </div>
                    ))}
                    {templatesForOrg(org.id, selectedTeam.id).length === 0 && <div style={{ color: t.text3 }}>No templates yet.</div>}
                  </div>
                </div>
              )}

              {settingsTab === "pir" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>PIR Field Config</div>
                  </div>
                  <div>
                    <PirEditor
                      orgId={org.id}
                      teamId={selectedTeam.id}
                      initial={pirConfigFor(org.id, selectedTeam.id)}
                      onSave={async (cfg) => { await onUpsertPirFieldConfig?.({ orgId: org.id, teamId: selectedTeam.id, fields: cfg }); setSettingsTeamId(null); setSettingsTab("sla"); }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {addRoleTeamId && roleTeam && (
        <Modal title={`Add Team Role - ${roleTeam.name}`} onClose={() => setAddRoleTeamId(null)} width={460}>
          <AddRoleForm
            onSave={async (role) => {
              await onAddTeamRole({ teamId: addRoleTeamId, ...role });
              setAddRoleTeamId(null);
            }}
            onCancel={() => setAddRoleTeamId(null)}
          />
        </Modal>
      )}

      {selectedMember && (
        <Modal title={`Edit Roles - ${selectedMember.name}`} onClose={() => setEditRolesUserId(null)} width={540}>
          <EditMemberRolesForm
            user={selectedMember}
            teamRoles={selectedMemberTeamRoles}
            onSave={async ({ roles }) => {
              await onUpdateMemberRoles({ userId: selectedMember.id, roles });
              setEditRolesUserId(null);
            }}
            onCancel={() => setEditRolesUserId(null)}
          />
        </Modal>
      )}
      {templateEditor && (
        <TemplateEditor
          orgId={templateEditor.orgId}
          teamId={templateEditor.teamId}
          template={templateEditor.template}
          onClose={() => setTemplateEditor(null)}
          onCreate={onCreateClosingTemplate}
          onUpdate={onUpdateClosingTemplate}
        />
      )}

      {plansOpen && org && (
        <PlansModal
          currentPlan={org.plan}
          onClose={() => setPlansOpen(false)}
          onSelectPlan={async (planKey) => {
            await onUpgradePlan?.(org.id, planKey);
            setPlansOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SettingsForm({ defaultPriorities, defaultUrgencies, onSave, onCancel }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [priorities, setPriorities] = useState(defaultPriorities);
  const [urgencies, setUrgencies] = useState(
    Array.isArray(defaultUrgencies) && defaultUrgencies.length
      ? defaultUrgencies
      : ["Critical", "High", "Medium", "Low"]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updatePriority = (index, key, value) => {
    setPriorities((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  };

  const removePriority = (index) => {
    setPriorities((rows) => rows.filter((_, i) => i !== index));
  };

  const addPriority = () => {
    setPriorities((rows) => [...rows, { name: "", color: "#666666", sla: 24 }]);
  };

  const updateUrgency = (index, value) => {
    setUrgencies((rows) => rows.map((row, i) => (i === index ? value : row)));
  };

  const removeUrgency = (index) => {
    setUrgencies((rows) => rows.filter((_, i) => i !== index));
  };

  const addUrgency = () => {
    setUrgencies((rows) => [...rows, ""]);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const nextPriorities = normalizePriorityRows(priorities);
    const nextUrgencies = urgencies.map((u) => String(u || "").trim()).filter(Boolean);
    if (!nextUrgencies.length) {
      setError("Add at least one urgency level.");
      setSaving(false);
      return;
    }
    try {
      await onSave({ priorities: nextPriorities, urgencies: nextUrgencies });
    } catch (err) {
      setError(err?.message || "Failed to save settings.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
        Configure custom priority names, response SLAs (hours), and urgency levels. These options will appear in ticket forms and detail views.
      </div>

      <div>
        <Label>Priorities & SLA (hours)</Label>
        <div style={{ display: "grid", gap: 8 }}>
          {priorities.map((p, i) => (
            <div key={`priority-${i}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 110px 110px auto", gap: 8 }}>
              <Input value={p.name} onChange={(e) => updatePriority(i, "name", e.target.value)} placeholder="Priority name" />
              <Input value={String(p.sla)} onChange={(e) => updatePriority(i, "sla", e.target.value)} placeholder="SLA h" />
              <input type="color" value={p.color} onChange={(e) => updatePriority(i, "color", e.target.value)} style={{ width: "100%", height: 38, border: `1px solid ${t.border}`, borderRadius: 8, background: t.surface2 }} />
              <Btn variant="secondary" size="sm" onClick={() => removePriority(i)}>Remove</Btn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Btn variant="secondary" size="sm" onClick={addPriority}><I name="plus" size={12} /> Add priority</Btn>
        </div>
      </div>

      <div>
        <Label>Urgency Levels</Label>
        <div style={{ display: "grid", gap: 8 }}>
          {urgencies.map((u, i) => (
            <div key={`urgency-${i}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "1fr auto", gap: 8 }}>
              <Input value={u} onChange={(e) => updateUrgency(i, e.target.value)} placeholder="Urgency name" />
              <Btn variant="secondary" size="sm" onClick={() => removeUrgency(i)}>Remove</Btn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Btn variant="secondary" size="sm" onClick={addUrgency}><I name="plus" size={12} /> Add urgency</Btn>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Btn>
      </div>
    </div>
  );
}

function CategoriesForm({ defaultCategories, onSave, onCancel }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [categories, setCategories] = useState(Array.isArray(defaultCategories) && defaultCategories.length ? defaultCategories : ["General"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateCategory = (index, value) => {
    setCategories((rows) => rows.map((row, i) => (i === index ? value : row)));
  };

  const removeCategory = (index) => {
    setCategories((rows) => rows.filter((_, i) => i !== index));
  };

  const addCategory = () => {
    setCategories((rows) => [...rows, ""]);
  };

  const submit = async () => {
    const nextCategories = categories.map((c) => String(c || "").trim()).filter(Boolean);
    if (!nextCategories.length) {
      setError("Add at least one category.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ categories: nextCategories });
    } catch (err) {
      setError(err?.message || "Failed to save categories.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
        Define the categories your organisation uses for tickets and KB content.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((c, i) => (
          <div key={`cat-${i}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "1fr auto", gap: 8 }}>
            <Input value={c} onChange={(e) => updateCategory(i, e.target.value)} placeholder="Category name" />
            <Btn variant="secondary" size="sm" onClick={() => removeCategory(i)}>Remove</Btn>
          </div>
        ))}
        <div>
          <Btn variant="secondary" size="sm" onClick={addCategory}><I name="plus" size={12} /> Add category</Btn>
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>Save Categories</Btn>
      </div>
    </div>
  );
}

// Pill toggle switch — on/off like Discord
function Toggle({ checked, onChange, disabled }) {
  const t = useTokens();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer",
        background: checked ? (disabled ? t.text3 : t.accent) : t.border,
        position: "relative", transition: "background 0.18s", flexShrink: 0, padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      }} />
    </button>
  );
}

function PermissionsForm({ orgSetting, teamRoles, onSave, onCancel }) {
  const t = useTokens();

  const roleOptions = useMemo(() => {
    const custom = (teamRoles || []).map((r) => r.name).filter(Boolean);
    const orgCustom = (orgSetting?.orgRoles || []).map((r) => r.name).filter(Boolean);
    return Array.from(new Set([...FALLBACK_ROLES, ...custom, ...orgCustom]));
  }, [teamRoles, orgSetting?.orgRoles]);

  // Seed with saved permissions; fall back to defaults when empty
  const [rolePermissions, setRolePermissions] = useState(() => {
    const saved = orgSetting?.rolePermissions || {};
    if (Object.keys(saved).length > 0) return saved;
    return { ...ROLE_PERMISSION_DEFAULTS };
  });

  const [requireApprovals, setRequireApprovals] = useState(!!orgSetting?.requireApprovals);
  const [approvalMode, setApprovalMode] = useState(orgSetting?.approvalMode || "all");
  const [selectedRole, setSelectedRole] = useState(roleOptions[0] || "Admin");
  const [saving, setSaving] = useState(false);

  const isAdmin = selectedRole === "Admin";

  const toggle = (permKey) => {
    if (isAdmin) return;
    setRolePermissions((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      rolePerms[permKey] = !rolePerms[permKey];
      return { ...prev, [selectedRole]: rolePerms };
    });
  };

  const resetToDefaults = () => {
    setRolePermissions({ ...ROLE_PERMISSION_DEFAULTS });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        catalogEditable: !!(rolePermissions["Catalog Manager"]?.["catalog.manage"] || rolePermissions["Agent"]?.["catalog.manage"]),
        requireApprovals,
        approvalMode,
        defaultCatalogApproverRole: "Admin",
        rolePermissions,
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role) => ROLE_COLORS[role] || t.text3;
  const getPermCount = (role) => {
    if (role === "Admin") return "All permissions";
    const perms = rolePermissions[role] || {};
    const count = Object.values(perms).filter(Boolean).length;
    return count === 0 ? "No permissions" : `${count} permission${count === 1 ? "" : "s"}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Top controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: t.text3 }}>
          Select a role on the left, then toggle its permissions on the right.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn size="sm" variant="ghost" onClick={resetToDefaults}>Reset to defaults</Btn>
          <Btn size="sm" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
          <Btn size="sm" variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </div>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: "flex", gap: 0, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", minHeight: 420 }}>

        {/* Left: role list */}
        <div style={{ width: 180, borderRight: `1px solid ${t.border}`, background: t.surface2, flexShrink: 0 }}>
          <div style={{ padding: "10px 12px 6px", fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Roles
          </div>
          {roleOptions.map((role) => {
            const color = getRoleColor(role);
            const active = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                style={{
                  width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  padding: "9px 12px", background: active ? t.accentBg : "transparent",
                  borderLeft: `3px solid ${active ? t.accent : "transparent"}`,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? t.text : t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role}</div>
                    <div style={{ fontSize: 10, color: active ? t.text3 : t.text3, marginTop: 1 }}>{getPermCount(role)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: permission toggles */}
        <div style={{ flex: 1, overflowY: "auto", background: t.surface }}>
          {/* Role header */}
          <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: getRoleColor(selectedRole), flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{selectedRole}</div>
              {isAdmin && (
                <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>Admins always have full access — permissions cannot be restricted.</div>
              )}
            </div>
          </div>

          {/* Permission groups */}
          <div style={{ padding: "4px 0 12px" }}>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.id}>
                <div style={{ padding: "14px 18px 6px", fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {group.label}
                </div>
                {group.permissions.map((perm, idx) => {
                  const enabled = isAdmin || !!(rolePermissions[selectedRole]?.[perm.key]);
                  return (
                    <div
                      key={perm.key}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 18px",
                        borderBottom: idx < group.permissions.length - 1 ? `1px solid ${t.border}22` : "none",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{perm.label}</div>
                        <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{perm.description}</div>
                      </div>
                      <Toggle checked={enabled} onChange={() => toggle(perm.key)} disabled={isAdmin} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval settings below the main panel */}
      <div style={{ marginTop: 16, padding: "14px 16px", border: `1px solid ${t.border}`, borderRadius: 10, background: t.surface2, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>Require approvals for catalog requests</div>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 8 }}>When on, catalog requests go to Awaiting Approval before work begins.</div>
          <Toggle checked={requireApprovals} onChange={setRequireApprovals} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>Approval completion rule</div>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 8 }}>When can a request move from Awaiting Approval to Open?</div>
          <Sel value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)} style={{ fontSize: 12 }}>
            <option value="all">All approvers must approve</option>
            <option value="any">Any single approval is enough</option>
          </Sel>
        </div>
      </div>
    </div>
  );
}

function AddRoleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ name: form.name.trim(), description: form.description.trim() });
    } catch (err) {
      setError(err?.message || "Failed to add role.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><Label>Role Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Field Engineer" autoFocus /></div>
      <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Handles on-site diagnostics" /></div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!form.name.trim() || saving}>{saving ? "Adding..." : "Add Role"}</Btn>
      </div>
    </div>
  );
}

function AddOrgForm({ onSave, onCancel }) {
  const [f, setF] = useState({ name: "", domain: "", industry: "Technology", plan: "Professional" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { isMobile } = useBreakpoint();
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const industries = ["Technology","Healthcare","Engineering","Finance","Legal","Education","Other"];
  const plans = ["Starter","Professional","Enterprise"];

  const submit = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ ...f, name: f.name.trim() });
    } catch (err) {
      setError(err?.message || "Failed to create organization.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Corp" autoFocus /></div>
      <div><Label>Domain</Label><Input value={f.domain} onChange={(e) => set("domain", e.target.value)} placeholder="acme.com" /></div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        <div><Label>Industry</Label><Sel value={f.industry} onChange={(e) => set("industry", e.target.value)}>{industries.map((i) => <option key={i}>{i}</option>)}</Sel></div>
        <div><Label>Plan</Label><Sel value={f.plan} onChange={(e) => set("plan", e.target.value)}>{plans.map((p) => <option key={p}>{p}</option>)}</Sel></div>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!f.name.trim() || saving}>{saving ? "Creating..." : "Create"}</Btn>
      </div>
    </div>
  );
}

function AddTeamForm({ orgs, users, defaultOrgId, onSave, onCancel }) {
  const t = useTokens();
  const [f, setF] = useState({ name: "", orgId: defaultOrgId || orgs[0]?.id, lead: "", icon: "IT" }); // "IT" key kept for DB compat
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const orgUsers = users.filter((u) => u.orgId === f.orgId);

  const submit = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ ...f, name: f.name.trim() });
    } catch (err) {
      setError(err?.message || "Failed to create team.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><Label>Team Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="IT Support" autoFocus /></div>
      <div><Label>Organisation</Label>
        <Sel value={f.orgId} onChange={(e) => { set("orgId", e.target.value); set("lead", ""); }}>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Sel>
      </div>
      <div><Label>Lead</Label>
        <Sel value={f.lead} onChange={(e) => set("lead", e.target.value)}>
          <option value="">- No lead -</option>
          {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Sel>
      </div>
      <div>
        <Label>Icon</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TEAM_ICONS.map((ic) => {
            const selected = f.icon === ic.key;
            return (
              <button
                key={ic.key}
                onClick={() => set("icon", ic.key)}
                title={ic.label}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 2, width: 52, height: 52, padding: "4px 2px",
                  border: `2px solid ${selected ? t.accent : t.border}`,
                  borderRadius: 10,
                  background: selected ? t.accentBg : t.surface2,
                  cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                  outline: "none",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{ic.emoji}</span>
                <span style={{ fontSize: 9, color: selected ? t.accentText : t.text3, fontWeight: 600, letterSpacing: "0.02em" }}>{ic.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!f.name.trim() || saving}>{saving ? "Creating..." : "Create"}</Btn>
      </div>
    </div>
  );
}

function AddMemberForm({ teamId, teams, orgs, users = [], teamRoles, onSave, onCancel }) {
  const t = useTokens();
  const team = teams.find((tm) => tm.id === teamId);
  const org = orgs.find((o) => o.id === team?.orgId);
  const roleOptions = useMemo(() => {
    const custom = (teamRoles || []).map((r) => r.name).filter(Boolean);
    const merged = [...FALLBACK_ROLES, ...custom];
    return Array.from(new Set(merged));
  }, [teamRoles]);

  const [f, setF] = useState({ email: "", title: "", roles: [roleOptions[0] || "End User"] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const toggleRole = (roleName) => {
    setF((prev) => {
      const has = prev.roles.includes(roleName);
      const nextRoles = has
        ? prev.roles.filter((r) => r !== roleName)
        : [...prev.roles, roleName];
      return { ...prev, roles: nextRoles };
    });
  };

  const submit = async () => {
    if (!f.email.trim() || !team) return;
    if (!f.roles.length) {
      setError("Select at least one role.");
      return;
    }

    // Check for duplicate email in the organization
    const normalizedEmail = f.email.trim().toLowerCase();
    const existingUserInOrg = users.find((u) => u.orgId === team.orgId && u.email.toLowerCase() === normalizedEmail);
    if (existingUserInOrg) {
      setError(`A user with email "${f.email.trim()}" already exists in this organization.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        // Name is not required for invites; backend will use existing user name if present
        email: f.email.trim(),
        title: f.title.trim(),
        role: f.roles[0],
        roles: f.roles,
        orgId: team.orgId,
        teamId,
      });
    } catch (err) {
      setError(err?.message || "Failed to add member.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {org && (
        <div style={{ background: t.surface2, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.text2 }}>
          Adding to <strong>{team?.name}</strong> - {org.name}
        </div>
      )}
      <div><Label>Email</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder={`jane@${org?.domain || "company.com"}`} type="email" autoFocus /></div>
      <div><Label>Job Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Senior Engineer" /></div>
      <div>
        <Label>Roles (select one or more)</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {roleOptions.map((role) => {
            const selected = f.roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                style={{
                  border: `1px solid ${selected ? t.accent : t.border}`,
                  background: selected ? t.accentBg : t.surface2,
                  color: selected ? t.accentText : t.text2,
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: t.font,
                }}
              >
                {role}
              </button>
            );
          })}
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!f.email.trim() || saving}>Add Member</Btn>
      </div>
    </div>
  );
}

function EditMemberRolesForm({ user, teamRoles, onSave, onCancel }) {
  const t = useTokens();
  const roleOptions = useMemo(() => {
    const custom = (teamRoles || []).map((r) => r.name).filter(Boolean);
    const merged = [...FALLBACK_ROLES, ...custom];
    return Array.from(new Set(merged));
  }, [teamRoles]);
  const startingRoles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role].filter(Boolean);

  const [roles, setRoles] = useState(startingRoles.length ? startingRoles : ["End User"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleRole = (roleName) => {
    setRoles((prev) => {
      const has = prev.includes(roleName);
      return has ? prev.filter((r) => r !== roleName) : [...prev, roleName];
    });
  };

  const submit = async () => {
    if (!roles.length) {
      setError("Select at least one role.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ roles });
    } catch (err) {
      setError(err?.message || "Failed to update roles.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
        Users can hold multiple roles. The first selected role is treated as the primary role in compact labels.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {roleOptions.map((role) => {
          const selected = roles.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              style={{
                border: `1px solid ${selected ? t.accent : t.border}`,
                background: selected ? t.accentBg : t.surface2,
                color: selected ? t.accentText : t.text2,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: t.font,
              }}
            >
              {role}
            </button>
          );
        })}
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>Save Roles</Btn>
      </div>
    </div>
  );
}

function TemplateEditor({ orgId, teamId, template, onClose, onCreate, onUpdate }) {
  const t = useTokens();
  const [name, setName] = useState(template?.name || "");
  const [desc, setDesc] = useState(template?.description || "");
  const [content, setContent] = useState(template?.content || "");
  const [applyTo, setApplyTo] = useState(template?.applyToTypes || ["Incident"]);
  const [saving, setSaving] = useState(false);

  const toggleType = (type) => {
    setApplyTo((prev) => prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (template?.id) {
        await onUpdate?.(template.id, { name: name.trim(), description: desc.trim(), content, applyToTypes: applyTo });
      } else {
        await onCreate?.({ orgId, teamId: teamId || "", name: name.trim(), description: desc.trim(), content, applyToTypes: applyTo });
      }
      onClose();
    } catch (err) {
      // ignore for now
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={template?.id ? "Edit Template" : "New Template"} onClose={onClose} width={720}>
      <div style={{ display: "grid", gap: 10 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" autoFocus />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" />
        <div>
          <div style={{ fontSize: 11, color: t.text3, marginBottom: 6 }}>Applies to</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TICKET_TYPES.map((tt) => (
              <button key={tt} onClick={() => toggleType(tt)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${applyTo.includes(tt) ? t.accent : t.border}`, background: applyTo.includes(tt) ? t.accentBg : "none", cursor: "pointer" }}>{tt}</button>
            ))}
          </div>
        </div>
        <Input multiline rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Template content" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function TicketTypesForm({ defaultTypes, onSave, onCancel }) {
  const t = useTokens();
  const [types, setTypes] = useState(() => (defaultTypes || DEFAULT_TICKET_TYPES).map((tt) => ({ ...tt })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i, field, value) =>
    setTypes((rows) => rows.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const remove = (i) => setTypes((rows) => rows.filter((_, idx) => idx !== i));

  const add = () => setTypes((rows) => [...rows, { name: "", prefix: "", color: "#718096" }]);

  const submit = async () => {
    const next = types.map((tt) => ({
      name: String(tt.name || "").trim(),
      prefix: String(tt.prefix || "").trim().toUpperCase(),
      color: String(tt.color || "#718096").trim(),
    }));
    const invalid = next.find((tt) => !tt.name || !tt.prefix);
    if (invalid) { setError("Every type needs a name and a prefix."); return; }
    const prefixes = next.map((tt) => tt.prefix);
    if (new Set(prefixes).size !== prefixes.length) { setError("Prefixes must be unique."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (err) {
      setError(err?.message || "Failed to save ticket types.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
        Define the ticket types available in your organisation. Each type needs a unique prefix used for ticket numbering (e.g. INC, REQ).
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px auto", gap: 6, alignItems: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Prefix</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Color</div>
        <div />
        {types.map((tt, i) => (
          <>
            <Input key={`name-${i}`} value={tt.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="e.g. Incident" />
            <Input key={`prefix-${i}`} value={tt.prefix} onChange={(e) => update(i, "prefix", e.target.value)} placeholder="INC" style={{ textTransform: "uppercase" }} />
            <input
              key={`color-${i}`}
              type="color"
              value={tt.color || "#718096"}
              onChange={(e) => update(i, "color", e.target.value)}
              style={{ width: "100%", height: 38, border: `1px solid ${t.border}`, borderRadius: 9, cursor: "pointer", padding: 2, background: t.surface2 }}
            />
            <Btn key={`del-${i}`} variant="secondary" size="sm" onClick={() => remove(i)} aria-label="Remove type">
              <I name="trash" size={12} />
            </Btn>
          </>
        ))}
      </div>
      <div>
        <Btn variant="secondary" size="sm" onClick={add}><I name="plus" size={12} /> Add type</Btn>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Types"}</Btn>
      </div>
    </div>
  );
}

const BUILTIN_ROLES = [
  { name: "Admin",           color: "#e53e3e", description: "Full access — can manage all org settings, members, and tickets." },
  { name: "Agent",           color: "#3182ce", description: "Can create, assign, and resolve tickets. Cannot manage org settings." },
  { name: "Catalog Manager", color: "#805ad5", description: "Can create and manage catalog items and approvals." },
  { name: "End User",        color: "#38a169", description: "Can create tickets and view the service catalog." },
];

function OrgRolesTab({ orgSetting, onSave }) {
  const t = useTokens();
  const [customRoles, setCustomRoles] = useState(() => (orgSetting?.orgRoles || []).map((r) => ({ ...r })));
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ name: "", color: "#3182ce", description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const openAdd = () => { setForm({ name: "", color: "#3182ce", description: "" }); setEditIdx(null); setErr(""); setAddOpen(true); };
  const openEdit = (idx) => { setForm({ ...customRoles[idx] }); setEditIdx(idx); setErr(""); setAddOpen(true); };

  const saveForm = async () => {
    const name = form.name.trim();
    if (!name) { setErr("Role name is required."); return; }
    const allNames = [...BUILTIN_ROLES.map((r) => r.name.toLowerCase()), ...customRoles.map((r, i) => i === editIdx ? null : r.name.toLowerCase()).filter(Boolean)];
    if (allNames.includes(name.toLowerCase())) { setErr("A role with that name already exists."); return; }
    const next = editIdx !== null
      ? customRoles.map((r, i) => i === editIdx ? { ...form, name } : r)
      : [...customRoles, { ...form, name }];
    setSaving(true);
    try { await onSave(next); setCustomRoles(next); setAddOpen(false); } catch { setErr("Failed to save."); } finally { setSaving(false); }
  };

  const removeRole = async (idx) => {
    const next = customRoles.filter((_, i) => i !== idx);
    setSaving(true);
    try { await onSave(next); setCustomRoles(next); } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Organization Roles</div>
      <div style={{ fontSize: 12, color: t.text3, marginBottom: 16, lineHeight: 1.6 }}>
        Built-in roles cannot be removed. Custom roles appear in the Permissions tab for permission assignment.
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Built-in</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {BUILTIN_ROLES.map((role) => (
          <div key={role.name} style={{ display: "flex", alignItems: "center", gap: 10, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: role.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{role.name}</div>
              <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{role.description}</div>
            </div>
            <Badge style={{ fontSize: 10, padding: "2px 6px", background: t.surface, color: t.text3 }}>Built-in</Badge>
          </div>
        ))}
      </div>

      {customRoles.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Custom</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {customRoles.map((role, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: role.color || "#718096", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{role.name}</div>
                  {role.description && <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{role.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="secondary" size="sm" onClick={() => openEdit(idx)}><I name="edit" size={11} /> Edit</Btn>
                  <Btn variant="danger" size="sm" disabled={saving} onClick={() => removeRole(idx)}><I name="trash" size={11} /></Btn>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!addOpen && (
        <Btn variant="primary" size="sm" onClick={openAdd}><I name="plus" size={12} /> Add Custom Role</Btn>
      )}

      {addOpen && (
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{editIdx !== null ? "Edit Role" : "New Custom Role"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <Label>Role Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Security Analyst" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What can this role do?" />
            </div>
            <div>
              <Label>Colour</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={form.color || "#3182ce"} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  style={{ width: 36, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
                <span style={{ fontSize: 12, color: t.text3, fontFamily: "monospace" }}>{form.color}</span>
              </div>
            </div>
          </div>
          {err && <div style={{ fontSize: 11, color: t.red, marginTop: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" size="sm" disabled={saving} onClick={saveForm}>{saving ? "Saving…" : "Save Role"}</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationsTab({ orgId, teams }) {
  const t = useTokens();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("End User");
  const [teamId, setTeamId] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchOrgInvitationsForOrg(orgId).then((data) => { if (mounted) { setInvitations(data); setLoading(false); } });
    return () => { mounted = false; };
  }, [orgId]);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setSendErr("Enter a valid email address."); return; }
    setSendErr(""); setSending(true);
    try {
      const inv = await sendOrgInvitation(orgId, trimmed, role, teamId || null);
      setInvitations((prev) => [inv, ...prev]);
      setEmail(""); setRole("End User"); setTeamId("");
    } catch (e) { setSendErr(e.message || "Failed to send."); } finally { setSending(false); }
  };

  const handleCancel = async (id) => {
    await cancelOrgInvitation(id);
    setInvitations((prev) => prev.map((i) => i.id === id ? { ...i, status: "Cancelled" } : i));
  };

  const statusStyle = (status) => ({
    Pending:   { bg: t.yellowBg,  text: t.yellowText },
    Accepted:  { bg: t.greenBg,   text: t.greenText  },
    Declined:  { bg: t.redBg,     text: t.red        },
    Cancelled: { bg: t.surface2,  text: t.text3      },
  }[status] || { bg: t.surface2, text: t.text3 });

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Member Invitations</div>
      <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <Input value={email} onChange={(e) => { setEmail(e.target.value); setSendErr(""); }}
            placeholder="email@example.com" style={{ flex: "1 1 180px", padding: "7px 10px", fontSize: 12 }} />
          <Sel value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: 12, padding: "7px 10px" }}>
            {["Admin", "Agent", "Catalog Manager", "End User"].map((r) => <option key={r}>{r}</option>)}
          </Sel>
          {teams.length > 0 && (
            <Sel value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ fontSize: 12, padding: "7px 10px" }}>
              <option value="">No specific team</option>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </Sel>
          )}
          <Btn variant="primary" size="sm" disabled={sending || !email.trim()} onClick={handleSend}>
            {sending ? "Sending…" : "Send Invite"}
          </Btn>
        </div>
        {sendErr && <div style={{ fontSize: 11, color: t.red }}>{sendErr}</div>}
        <div style={{ fontSize: 11, color: t.text3 }}>
          Invited members will see the invitation in their notification panel when they log in.
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 8 }}>All Invitations</div>
      {loading ? (
        <div style={{ fontSize: 12, color: t.text3 }}>Loading…</div>
      ) : invitations.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3 }}>No invitations sent yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {invitations.map((inv) => {
            const st = statusStyle(inv.status);
            return (
              <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", border: `1px solid ${t.border}`, borderRadius: 8, alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>
                    {inv.role} • Sent {fmtDate(inv.sentAt)}
                    {inv.acceptedAt ? ` • Joined ${fmtDate(inv.acceptedAt)}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Badge style={{ background: st.bg, color: st.text, fontSize: 10, padding: "2px 7px" }}>{inv.status}</Badge>
                  {inv.status === "Pending" && (
                    <Btn variant="danger" size="sm" onClick={() => handleCancel(inv.id)}>Cancel</Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApiKeysTab({ orgId, currentUserId }) {
  const t = useTokens();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [justCreated, setJustCreated] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchApiKeys(orgId).then((data) => { if (mounted) { setKeys(data); setLoading(false); } });
    return () => { mounted = false; };
  }, [orgId]);

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateErr("Key name is required."); return; }
    setCreateErr(""); setCreating(true);
    try {
      const created = await createApiKey(orgId, newName.trim(), currentUserId);
      setKeys((prev) => [{ id: created.id, orgId: created.orgId, name: created.name, keyPrefix: created.keyPrefix, createdAt: created.createdAt, isActive: true }, ...prev]);
      setJustCreated(created);
      setNewName("");
    } catch (e) { setCreateErr(e.message || "Failed to create key."); } finally { setCreating(false); }
  };

  const handleRevoke = async (id) => {
    await revokeApiKey(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
    if (justCreated?.id === id) setJustCreated(null);
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>API Keys</div>
      <div style={{ fontSize: 12, color: t.text3, marginBottom: 14, lineHeight: 1.6 }}>
        API keys allow programmatic access to your organization's data.
      </div>

      <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Generate New Key</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={newName} onChange={(e) => { setNewName(e.target.value); setCreateErr(""); }}
            placeholder="Key name, e.g. Monitoring Integration"
            style={{ flex: 1, padding: "7px 10px", fontSize: 12 }} />
          <Btn variant="primary" size="sm" disabled={creating || !newName.trim()} onClick={handleCreate}>
            {creating ? "Creating…" : "Generate"}
          </Btn>
        </div>
        {createErr && <div style={{ fontSize: 11, color: t.red, marginTop: 6 }}>{createErr}</div>}
      </div>

      {justCreated && (
        <div style={{ background: t.greenBg, border: `1px solid ${t.greenText}44`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.greenText, marginBottom: 6 }}>Key created — copy it now, it won't be shown again</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, fontSize: 11, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4, padding: "6px 8px", color: t.text, wordBreak: "break-all", fontFamily: "monospace" }}>
              {justCreated.fullKey}
            </code>
            <Btn variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(justCreated.fullKey)}>
              <I name="copy" size={12} /> Copy
            </Btn>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 8 }}>Active Keys</div>
      {loading ? (
        <div style={{ fontSize: 12, color: t.text3 }}>Loading…</div>
      ) : keys.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text3 }}>No API keys yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {keys.map((key) => (
            <div key={key.id} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: t.text3, flexShrink: 0, display: "flex" }}><I name="lock" size={14} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{key.name}</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 2, fontFamily: "monospace" }}>
                  {key.keyPrefix} • Created {fmtDate(key.createdAt)}
                  {key.lastUsedAt ? ` • Last used ${fmtDate(key.lastUsedAt)}` : " • Never used"}
                </div>
              </div>
              <Btn variant="danger" size="sm" onClick={() => handleRevoke(key.id)}><I name="trash" size={11} /> Revoke</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PirEditor({ orgId, teamId, initial, onSave }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [fields, setFields] = useState(() => (initial?.fields ? initial.fields.map((f) => ({ ...f })) : []));
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields((f) => [...f, { name: `field_${f.length + 1}`, label: "New Field", type: "text", required: false }]);
  };

  const updateField = (index, key, value) => {
    setFields((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };

  const removeField = (index) => setFields((rows) => rows.filter((_, i) => i !== index));

  const move = (index, dir) => {
    setFields((rows) => {
      const next = [...rows];
      const j = index + dir;
      if (j < 0 || j >= next.length) return next;
      const tmp = next[j]; next[j] = next[index]; next[index] = tmp;
      return next;
    });
  };

  const reset = () => setFields(initial?.fields ? initial.fields.map((f) => ({ ...f })) : []);

  const save = async () => {
    setSaving(true);
    try {
      // basic validation: names must be non-empty
      const invalid = fields.some((f) => !f.name || !f.name.trim());
      if (invalid) {
        // simple client-side feedback: abort save
        setSaving(false);
        return;
      }
      await onSave(fields.map((f) => ({ name: String(f.name).trim(), label: String(f.label || "").trim(), type: f.type || "text", required: !!f.required })));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = ["text", "list", "user"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: t.text3 }}>Add fields for the PIR form. Use <strong>user</strong> type to select an owner.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fields.map((fld, i) => (
          <div key={`pir-field-${i}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr 110px 90px auto", gap: 8, alignItems: "center" }}>
            <Input value={fld.name} onChange={(e) => updateField(i, "name", e.target.value)} placeholder="field_name" />
            <Input value={fld.label} onChange={(e) => updateField(i, "label", e.target.value)} placeholder="Label shown to users" />
            <Sel value={fld.type} onChange={(e) => updateField(i, "type", e.target.value)}>
              {typeOptions.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </Sel>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!fld.required} onChange={(e) => updateField(i, "required", e.target.checked)} />
              <span style={{ fontSize: 11, color: t.text3 }}>Required</span>
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => move(i, -1)} title="Move up" style={{ background: "none", border: "1px solid " + t.border, borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}>↑</button>
              <button onClick={() => move(i, 1)} title="Move down" style={{ background: "none", border: "1px solid " + t.border, borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}>↓</button>
              <button onClick={() => removeField(i)} title="Remove" style={{ background: "none", border: "1px solid " + t.border, borderRadius: 6, padding: "6px 8px", cursor: "pointer", color: t.redText }}>✕</button>
            </div>
          </div>
        ))}
        {fields.length === 0 && <div style={{ color: t.text3 }}>No fields yet. Click Add field to get started.</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="secondary" onClick={reset}>Reset</Btn>
        <Btn onClick={addField} variant="secondary">Add Field</Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );
}
