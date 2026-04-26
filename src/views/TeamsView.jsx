import { useEffect, useMemo, useState } from "react";
import { DEFAULT_URGENCIES, PRIORITIES } from "../core/constants.js";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { Avatar, Badge, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

const TEAM_ICONS = ["IT","ENG","OPS","APP","NET","SEC","DATA","QA","PM","UX","HR","FIN"];
const FALLBACK_ROLES = ["Admin", "Agent", "End User"];

const defaultPriorityRows = () => Object.entries(PRIORITIES).map(([name, cfg]) => ({
  name,
  color: cfg.color,
  sla: cfg.sla,
}));

const normalizePriorityRows = (rows) => {
  const list = (rows || [])
    .map((row) => ({
      name: String(row?.name || "").trim(),
      color: String(row?.color || "").trim() || "#888888",
      sla: Number(row?.sla || 0),
    }))
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
  teamRoles,
  onCreateOrg,
  onCreateTeam,
  onCreateMember,
  onUpdateMemberRoles,
  onSaveOrgSettings,
  onSaveTeamSettings,
  onAddTeamRole,
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
  const [addRoleTeamId, setAddRoleTeamId] = useState(null);

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
  const orgTeams = teams.filter((tm) => tm.orgId === selOrg);
  const selectedTeam = teams.find((tm) => tm.id === settingsTeamId);
  const roleTeam = teams.find((tm) => tm.id === addRoleTeamId);
  const selectedMember = users.find((u) => u.id === editRolesUserId);
  const selectedMemberTeamRoles = teamRoles.filter((r) => r.teamId === selectedMember?.teamId);

  const orgSetting = orgSettings.find((row) => row.orgId === selOrg);

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
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <Badge label={org.industry} color={t.accentText} bg={t.accentBg} />
                      <Badge label={org.plan} color={t.blueText} bg={t.blueBg} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn variant="secondary" size="sm" onClick={() => setSettingsOrgOpen(true)}>
                      <I name="settings" size={12} /> SLA & Priority
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
                    <Card key={team.id} noPad>
                      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 18 }}>{team.icon}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{team.name}</div>
                            {lead && <div style={{ fontSize: 10, color: t.text3 }}>Lead: {lead.name}</div>}
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

                      <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 10, color: t.text3, marginBottom: 4 }}>Team roles</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {roles.length === 0 && <span style={{ fontSize: 11, color: t.text3 }}>No custom roles yet.</span>}
                          {roles.map((role) => (
                            <Badge key={role.id} label={role.name} color={t.accentText} bg={t.accentBg} size={10} />
                          ))}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 10, color: t.text3 }}>
                          Urgencies: {(teamCfg?.urgencies || orgSetting?.urgencies || DEFAULT_URGENCIES).join(" / ")}
                        </div>
                      </div>

                      {members.map((u, i) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
                          <Avatar name={u.name} size={30} fs={10} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.name}</div>
                            <div style={{ fontSize: 10, color: t.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
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
                  <div style={{ textAlign: "center", padding: 40, color: t.text3, fontSize: 13 }}>No teams yet. Create one to get started.</div>
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
        <Modal title="Organisation SLA, Priority & Urgency" onClose={() => setSettingsOrgOpen(false)} width={620}>
          <SettingsForm
            defaultPriorities={normalizePriorityRows(orgSetting?.priorities)}
            defaultUrgencies={orgSetting?.urgencies || DEFAULT_URGENCIES}
            onSave={async (settings) => {
              await onSaveOrgSettings({ orgId: org.id, ...settings });
              setSettingsOrgOpen(false);
            }}
            onCancel={() => setSettingsOrgOpen(false)}
          />
        </Modal>
      )}

      {settingsTeamId && selectedTeam && (
        <Modal title={`Team Settings - ${selectedTeam.name}`} onClose={() => setSettingsTeamId(null)} width={620}>
          <SettingsForm
            defaultPriorities={normalizePriorityRows(teamSettings.find((cfg) => cfg.teamId === settingsTeamId)?.priorities || orgSetting?.priorities)}
            defaultUrgencies={teamSettings.find((cfg) => cfg.teamId === settingsTeamId)?.urgencies || orgSetting?.urgencies || DEFAULT_URGENCIES}
            onSave={async (settings) => {
              await onSaveTeamSettings({ teamId: settingsTeamId, ...settings });
              setSettingsTeamId(null);
            }}
            onCancel={() => setSettingsTeamId(null)}
          />
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
    </div>
  );
}

function SettingsForm({ defaultPriorities, defaultUrgencies, onSave, onCancel }) {
  const t = useTokens();
  const [priorities, setPriorities] = useState(defaultPriorities);
  const [urgenciesText, setUrgenciesText] = useState((defaultUrgencies || []).join(", "));
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

  const submit = async () => {
    setSaving(true);
    setError("");
    const nextPriorities = normalizePriorityRows(priorities);
    const urgencies = urgenciesText.split(",").map((u) => u.trim()).filter(Boolean);
    if (!urgencies.length) {
      setError("Add at least one urgency level.");
      setSaving(false);
      return;
    }
    try {
      await onSave({ priorities: nextPriorities, urgencies });
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
            <div key={`${p.name}-${i}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 110px 110px auto", gap: 8 }}>
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
        <Label>Urgency Levels (comma-separated)</Label>
        <Input value={urgenciesText} onChange={(e) => setUrgenciesText(e.target.value)} placeholder="Critical, High, Medium, Low" />
      </div>

      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Btn>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
