import { useEffect, useMemo, useState } from "react";
import { DEFAULT_URGENCIES, PRIORITIES, TICKET_TYPES } from "../core/constants.js";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { Avatar, Badge, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { PlansModal, PlanBadge } from "../ui/UpgradeGate.jsx";

const TEAM_ICONS = ["IT","ENG","OPS","APP","NET","SEC","DATA","QA","PM","UX","HR","FIN"];
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
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: compactView ? 14 : 18 }}>{team.icon}</span>
                          <div>
                            <div style={{ fontSize: compactView ? 12 : 14, fontWeight: 700, color: t.text }}>{team.name}</div>
                            {!compactView && lead && <div style={{ fontSize: 10, color: t.text3 }}>Lead: {lead.name}</div>}
                          </div>
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
            teamRoles={teamRoles.filter((r) => r.teamId === addMemberTeam)}
            onSave={async (u) => {
              await onCreateMember(u);
              setAddMemberTeam(null);
            }}
            onCancel={() => setAddMemberTeam(null)}
          />
        </Modal>
      )}

      {settingsOrgOpen && org && (
        <Modal title="Organisation Settings" onClose={() => { setSettingsOrgOpen(false); setSettingsTab("sla"); }} width={820}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 200 }}>
              {[
                { id: "sla", label: "SLA & Priority" },
                { id: "permissions", label: "Permissions" },
                { id: "categories", label: "Categories" },
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
            <div style={{ flex: 1 }}>
              {settingsTab === "sla" && (
                <SettingsForm
                  defaultPriorities={normalizePriorityRows(orgSetting?.priorities)}
                  defaultUrgencies={orgSetting?.urgencies || DEFAULT_URGENCIES}
                  onSave={async (settings) => {
                    await onSaveOrgSettings({ orgId: org.id, ...settings });
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
                    await onSaveOrgSettings({ orgId: org.id, priorities: normalizePriorityRows(orgSetting?.priorities), urgencies: orgSetting?.urgencies || DEFAULT_URGENCIES, ...settings });
                    setSettingsOrgOpen(false);
                    setSettingsTab("sla");
                  }}
                  onUpdateMemberRoles={onUpdateMemberRoles}
                />
              )}

              {settingsTab === "categories" && (
                <CategoriesForm
                  defaultCategories={orgSetting?.categories || []}
                  onSave={async (settings) => {
                    await onSaveOrgSettings({ orgId: org.id, priorities: normalizePriorityRows(orgSetting?.priorities), urgencies: orgSetting?.urgencies || DEFAULT_URGENCIES, ...settings });
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
            </div>
          </div>
        </Modal>
      )}

      {settingsTeamId && selectedTeam && (
        <Modal title={`Team Settings - ${selectedTeam.name}`} onClose={() => { setSettingsTeamId(null); setSettingsTab("sla"); }} width={820}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 200 }}>
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
            <div style={{ flex: 1 }}>
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

function PermissionsForm({ orgId, orgSetting, users, teamRoles, onSave, onCancel, onUpdateMemberRoles }) {
  const t = useTokens();
  const [catalogEditable, setCatalogEditable] = useState(!!orgSetting?.catalogEditable);
  const [requireApprovals, setRequireApprovals] = useState(!!orgSetting?.requireApprovals);
  const [approvalMode, setApprovalMode] = useState(orgSetting?.approvalMode || "all");
  const [defaultApproverRole, setDefaultApproverRole] = useState(orgSetting?.defaultCatalogApproverRole || "");
  const [saving, setSaving] = useState(false);
  const [userSaving, setUserSaving] = useState(null);

  // rolePermissions structure: { roleName: { permKey: true, ... }, ... }
  const initialRolePerms = orgSetting?.rolePermissions || {};
  const [rolePermissions, setRolePermissions] = useState(() => ({ ...initialRolePerms }));

  // derive permission keys from rolePermissions
  const permissionKeys = useMemo(() => ["catalog.manage", "catalog.edit", "approvals.resolve", "tickets.edit", "tickets.create"], []);

  const presetRoles = ["Catalog Manager", "Admin", "Agent", "End User"];

  const roleOptions = useMemo(() => {
    const custom = (teamRoles || []).map((r) => r.name).filter(Boolean);
    const merged = [...FALLBACK_ROLES, ...custom];
    return Array.from(new Set(merged));
  }, [teamRoles]);

  const togglePermission = (role, perm) => {
    setRolePermissions((prev) => {
      const next = { ...(prev || {}) };
      const row = { ...(next[role] || {}) };
      row[perm] = !row[perm];
      next[role] = row;
      return next;
    });
  };

  const addPermissionKey = (key) => {
    const k = String(key || "").trim();
    if (!k) return;
    if (permissionKeys.includes(k)) return;
    // initialize flag false for all roles
    setRolePermissions((prev) => {
      const next = { ...(prev || {}) };
      roleOptions.forEach((r) => { next[r] = { ...(next[r] || {}) }; next[r][k] = false; });
      return next;
    });
  };

  const permissionDefinitions = useMemo(() => ([
    { key: "catalog.manage", label: "Manage catalog items", description: "Create and edit catalog items, approvers, and publishing settings." },
    { key: "catalog.edit", label: "Edit catalog items", description: "Change catalog content without full manage access." },
    { key: "approvals.resolve", label: "Resolve approvals", description: "Approve or reject pending requests." },
    { key: "tickets.edit", label: "Edit tickets", description: "Change ticket fields and status." },
    { key: "tickets.create", label: "Create tickets", description: "Open new incidents, requests, and changes." },
  ]), []);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        catalogEditable: !!catalogEditable,
        requireApprovals: !!requireApprovals,
        approvalMode,
        defaultCatalogApproverRole: defaultApproverRole || "",
        rolePermissions,
      });
    } finally {
      setSaving(false);
    }
  };

  const grantCatalogManager = async (user) => {
    const current = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean);
    if (current.includes("Catalog Manager")) return;
    setUserSaving(user.id);
    try {
      const next = [...current, "Catalog Manager"];
      await onUpdateMemberRoles?.({ userId: user.id, roles: next });
    } finally {
      setUserSaving(null);
    }
  };

  const revokeCatalogManager = async (user) => {
    const current = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean);
    if (!current.includes("Catalog Manager")) return;
    setUserSaving(user.id);
    try {
      const next = current.filter((r) => r !== "Catalog Manager");
      if (!next.length) next.push("End User");
      await onUpdateMemberRoles?.({ userId: user.id, roles: next });
    } finally {
      setUserSaving(null);
    }
  };

  const [newPerm, setNewPerm] = useState("");

  const applyPreset = (role, preset) => {
    const presets = {
      "Catalog Manager": { "catalog.manage": true, "catalog.edit": true, "approvals.resolve": true },
      "Agent": { "tickets.create": true, "tickets.edit": true },
      "End User": { "tickets.create": true },
      "Admin": { "catalog.manage": true, "catalog.edit": true, "approvals.resolve": true, "tickets.create": true, "tickets.edit": true },
    };
    const map = presets[preset] || presets[role] || {};
    setRolePermissions((prev) => {
      const next = { ...(prev || {}) };
      next[role] = { ...(next[role] || {}), ...map };
      return next;
    });
  };

  const allRoles = roleOptions.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
        This area controls who can manage the catalog and who can resolve approvals. Start with a preset, then fine-tune only if needed.
      </div>

      <div>
        <Label>Catalog Editing & Approvals</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={catalogEditable} onChange={(e) => setCatalogEditable(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Allow org members to edit service catalog items</span>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={requireApprovals} onChange={(e) => setRequireApprovals(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Require approvals for catalog requests</span>
          </label>
        </div>
      </div>

      <div>
        <Label>Approval Completion Rule</Label>
        <div style={{ fontSize: 12, color: t.text3, marginBottom: 6 }}>
          Choose when a request can move from Awaiting Approval to Open.
        </div>
        <Sel value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)}>
          <option value="all">All approvers must approve (team approval needs one team member)</option>
          <option value="any">Any one approval can open the ticket</option>
        </Sel>
      </div>

      <div>
        <Label>Default Approver Role</Label>
        <div style={{ fontSize: 12, color: t.text3, marginBottom: 6 }}>
          Used when a catalog item is approval-based but not tied to one user or team.
        </div>
        <Sel value={defaultApproverRole} onChange={(e) => setDefaultApproverRole(e.target.value)}>
          <option value="">- none -</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </Sel>
      </div>

      <div>
        <Label>Role permissions</Label>
        <div style={{ fontSize: 12, color: t.text3, marginBottom: 8 }}>
          Pick a preset to get started, then adjust only the permissions you need.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {presetRoles.map((role) => (
            <Btn key={role} size="sm" variant="secondary" onClick={() => applyPreset(role, role)}>
              {role === "Catalog Manager" ? "Catalog Manager preset" : `${role} preset`}
            </Btn>
          ))}
          <Btn size="sm" variant="ghost" onClick={() => {
            setRolePermissions({});
            presetRoles.forEach((role) => applyPreset(role, role));
          }}>
            Apply recommended defaults
          </Btn>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Input value={newPerm} onChange={(e) => setNewPerm(e.target.value)} placeholder="Add custom permission key, e.g. kb.edit" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPermissionKey(newPerm); setNewPerm(''); } }} />
          <Btn variant="secondary" onClick={() => { addPermissionKey(newPerm); setNewPerm(""); }}>Add</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {permissionDefinitions.map((perm) => (
            <div key={perm.key} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, background: t.surface2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{perm.label}</div>
                  <div style={{ fontSize: 12, color: t.text3, marginTop: 4, lineHeight: 1.5 }}>{perm.description}</div>
                </div>
                <div style={{ fontSize: 11, color: t.text3, alignSelf: "center" }}>{perm.key}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {allRoles.map((role) => {
                  const checked = !!((rolePermissions || {})[role]?.[perm.key]);
                  return (
                    <label key={`${role}-${perm.key}`} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 10px", background: checked ? t.accentBg : t.surface }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePermission(role, perm.key)} />
                      <span style={{ fontSize: 12, color: checked ? t.accentText : t.text2 }}>{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: t.text3 }}>
          Recommended defaults give Admin full access, Catalog Manager catalog control, Agents ticket actions, and End Users request creation only.
        </div>
      </div>

      <div>
        <Label>Assign Catalog Manager</Label>
        <div style={{ fontSize: 12, color: t.text3, marginBottom: 6 }}>
          Quick shortcut for users who should manage catalog items and approvals.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => {
            const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role].filter(Boolean);
            const has = roles.includes("Catalog Manager");
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: t.text3 }}>{roles.join(", ")}</div>
                </div>
                <div>
                  {has ? (
                    <Btn size="sm" variant="danger" onClick={() => revokeCatalogManager(u)} disabled={userSaving === u.id}>{userSaving === u.id ? "…" : "Revoke"}</Btn>
                  ) : (
                    <Btn size="sm" variant="primary" onClick={() => grantCatalogManager(u)} disabled={userSaving === u.id}>{userSaving === u.id ? "…" : "Grant"}</Btn>
                  )}
                </div>
              </div>
            );
          })}
          {users.length === 0 && <div style={{ color: t.text3 }}>No users in this organisation.</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Permissions"}</Btn>
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
  const [f, setF] = useState({ name: "", orgId: defaultOrgId || orgs[0]?.id, lead: "", icon: "IT" });
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
          {TEAM_ICONS.map((ic) => (
            <button key={ic} onClick={() => set("icon", ic)} style={{ fontSize: 16, width: 34, height: 34, border: `2px solid ${f.icon === ic ? t.accent : t.border}`, borderRadius: 8, background: f.icon === ic ? t.accentBg : t.surface2, cursor: "pointer" }}>
              {ic}
            </button>
          ))}
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

function AddMemberForm({ teamId, teams, orgs, teamRoles, onSave, onCancel }) {
  const t = useTokens();
  const team = teams.find((tm) => tm.id === teamId);
  const org = orgs.find((o) => o.id === team?.orgId);
  const roleOptions = useMemo(() => {
    const custom = (teamRoles || []).map((r) => r.name).filter(Boolean);
    const merged = [...FALLBACK_ROLES, ...custom];
    return Array.from(new Set(merged));
  }, [teamRoles]);

  const [f, setF] = useState({ name: "", email: "", title: "", roles: [roleOptions[0] || "End User"] });
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
    if (!f.name.trim() || !f.email.trim() || !team) return;
    if (!f.roles.length) {
      setError("Select at least one role.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: f.name.trim(),
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
      <div><Label>Full Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" autoFocus /></div>
      <div><Label>Email</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder={`jane@${org?.domain || "company.com"}`} type="email" /></div>
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
        <Btn variant="primary" onClick={submit} disabled={!f.name.trim() || !f.email.trim() || saving}>Add Member</Btn>
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
