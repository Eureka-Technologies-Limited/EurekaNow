import { useMemo, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { DEFAULT_TEAM_ROLES } from "../core/constants.js";
import { Avatar, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { canDo } from "../core/utils.js";

// removed unused helper: toDueTimestamp

function RequestModal({ item, currentUser, users, teams, orgs, onClose, onSubmit }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [form, setForm] = useState(() => ({
    orgId: currentUser?.orgId || orgs[0]?.id || "",
    teamId: currentUser?.teamId || "",
    requestedFor: currentUser?.id || "",
    priority: item?.defaultPriority || "Medium",
    urgency: item?.defaultUrgency || "Medium",
    shortDescription: "",
    justification: "",
    customValues: {},
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orgTeams = teams.filter((team) => team.orgId === form.orgId);
  const orgUsers = users.filter((user) => user.orgId === form.orgId);
  const extraFields = Array.isArray(item?.requestFields) ? item.requestFields : [];

  const setCustom = (key, value) =>
    setForm((prev) => ({ ...prev, customValues: { ...prev.customValues, [key]: value } }));

  const submit = async () => {
    if (saving) return;
    // Validate required custom fields
    for (const f of extraFields) {
      if (f.required && !String(form.customValues[f.key] || "").trim()) {
        setError(`"${f.label}" is required.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const customFields = {
        shortDescription: form.shortDescription.trim(),
        justification: form.justification.trim(),
        ...Object.fromEntries(extraFields.map((f) => [f.key, String(form.customValues[f.key] || "").trim()])),
      };
      // Keep plain text description for list views / backward compat
      const plainDescription = [
        form.shortDescription.trim(),
        form.justification.trim(),
        ...extraFields.map((f) => `${f.label}: ${form.customValues[f.key] || ""}`),
      ].filter(Boolean).join("\n\n");
      await onSubmit(item, {
        title: item.name,
        description: plainDescription,
        orgId: form.orgId,
        teamId: form.teamId,
        requestedFor: form.requestedFor || currentUser?.id,
        priority: form.priority,
        urgency: form.urgency,
        customFields,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to submit request.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Request: ${item.name}`} onClose={onClose} width={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Item summary */}
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: t.accentBg, display: "grid", placeItems: "center", color: t.accent }}>
              <I name={item.icon || "request"} size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{item.name}</div>
              <div style={{ fontSize: 12, color: t.text3 }}>{item.category}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: t.text2 }}>{item.description}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.requiresApproval && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: t.yellowBg, color: t.yellowText }}>Approval required</span>}
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: t.surface3, color: t.text3 }}>{item.defaultType}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Requested for</Label>
            <Sel value={form.requestedFor} onChange={(e) => setForm((prev) => ({ ...prev, requestedFor: e.target.value }))}>
              {orgUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Sel>
          </div>
          <div>
            <Label>Team</Label>
            <Sel value={form.teamId} onChange={(e) => setForm((prev) => ({ ...prev, teamId: e.target.value }))}>
              <option value="">— Select team —</option>
              {orgTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </Sel>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Priority</Label>
            <Sel value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
              {["Critical","High","Medium","Low"].map((p) => <option key={p} value={p}>{p}</option>)}
            </Sel>
          </div>
          <div>
            <Label>Urgency</Label>
            <Sel value={form.urgency} onChange={(e) => setForm((prev) => ({ ...prev, urgency: e.target.value }))}>
              {["Critical","High","Medium","Low"].map((u) => <option key={u} value={u}>{u}</option>)}
            </Sel>
          </div>
        </div>

        {/* Default fields: always shown */}
        <div>
          <Label>Short description</Label>
          <Input multiline rows={2} value={form.shortDescription} onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))} placeholder="What do you need?" />
        </div>
        <div>
          <Label>Justification</Label>
          <Input multiline rows={2} value={form.justification} onChange={(e) => setForm((prev) => ({ ...prev, justification: e.target.value }))} placeholder="Why do you need this? Add context for the approver." />
        </div>

        {/* Custom fields defined per catalog item */}
        {extraFields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}{f.required && " *"}</Label>
            {f.type === "textarea" ? (
              <Input multiline rows={3} value={form.customValues[f.key] || ""} onChange={(e) => setCustom(f.key, e.target.value)} placeholder={f.placeholder || ""} />
            ) : f.type === "select" && Array.isArray(f.options) ? (
              <Sel value={form.customValues[f.key] || ""} onChange={(e) => setCustom(f.key, e.target.value)}>
                <option value="">— Select —</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Sel>
            ) : (
              <Input type={f.type === "date" ? "date" : "text"} value={form.customValues[f.key] || ""} onChange={(e) => setCustom(f.key, e.target.value)} placeholder={f.placeholder || ""} />
            )}
          </div>
        ))}

        {error && (
          <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>{error}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || !item?.name}>{saving ? "Submitting..." : "Submit request"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function ApprovalDecisionModal({ approval, item, ticket, currentUser, onClose, onResolve }) {
  const t = useTokens();
  const [decision, setDecision] = useState("Approved");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onResolve(approval.id, decision, comments);
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to save approval decision.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`${decision} request`} onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 4 }}>{item?.name || "Approval"}</div>
          <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.6 }}>{ticket?.title || "Requested item"}</div>
          {ticket?.description && (
            <div style={{ marginTop: 8, fontSize: 12, color: t.text2, whiteSpace: "pre-wrap" }}>{ticket.description}</div>
          )}
        </div>
        <div>
          <Label>Decision</Label>
          <Sel value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="Approved">Approve</option>
            <option value="Rejected">Reject</option>
          </Sel>
        </div>
        <div>
          <Label>Comment</Label>
          <Input multiline rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional note for the requester" />
        </div>
        {error && <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving..." : decision}</Btn>
        </div>
      </div>
    </Modal>
  );
}

const FIELD_TYPES = ["text", "textarea", "select", "date"];

function ManageCatalogModal({ item, users = [], teams = [], onClose, onSave }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState("approver");
  const [approverRole, setApproverRole] = useState(item.approverRole || "Admin");
  const [approverId, setApproverId] = useState(item.approverId || "");
  const [approverMode, setApproverMode] = useState(item.approverMode || "role");
  const [approverTeamId, setApproverTeamId] = useState(item.approverTeamId || "");
  const [requestFields, setRequestFields] = useState(() =>
    Array.isArray(item.requestFields) ? item.requestFields.map((f) => ({ ...f })) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orgUsers = users.filter((u) => u.orgId === item.orgId);
  const orgTeams = teams.filter((tm) => tm.orgId === item.orgId);

  const addField = () =>
    setRequestFields((prev) => [
      ...prev,
      { key: `field_${Date.now()}`, label: "", type: "text", required: false, placeholder: "", options: [] },
    ]);

  const updateField = (i, patch) =>
    setRequestFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const removeField = (i) =>
    setRequestFields((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (saving) return;
    for (const f of requestFields) {
      if (!f.label.trim()) { setError("All custom fields need a label."); return; }
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ approverRole, approverId, approverMode, approverTeamId, requestFields });
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to save catalog item.");
      setSaving(false);
    }
  };

  const tabs = [
    { id: "approver", label: "Approver" },
    { id: "fields", label: "Request fields" },
  ];

  return (
    <Modal title={`Manage: ${item.name}`} onClose={onClose} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, gap: 4 }}>
          {tabs.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: t.font,
              fontSize: 13, fontWeight: 700, color: tab === tb.id ? t.accent : t.text3,
              borderBottom: `2px solid ${tab === tb.id ? t.accent : "transparent"}`,
              padding: "8px 14px 10px", marginBottom: -1,
            }}>{tb.label}</button>
          ))}
        </div>

        {tab === "approver" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Label>Approver type</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ id: "role", label: "Role" }, { id: "user", label: "User" }, { id: "team", label: "Team" }].map((option) => (
                  <Btn key={option.id} variant={approverMode === option.id ? "primary" : "secondary"} size="sm" onClick={() => setApproverMode(option.id)}>
                    {option.label}
                  </Btn>
                ))}
              </div>
            </div>
            {approverMode === "role" && (
              <div>
                <Label>Approver role</Label>
                <Sel value={approverRole} onChange={(e) => setApproverRole(e.target.value)}>
                  {DEFAULT_TEAM_ROLES.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                </Sel>
              </div>
            )}
            {approverMode === "user" && (
              <div>
                <Label>Specific approver (optional)</Label>
                <Sel value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                  <option value="">— Select user —</option>
                  {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </Sel>
              </div>
            )}
            {approverMode === "team" && (
              <div>
                <Label>Approver team</Label>
                <Sel value={approverTeamId} onChange={(e) => setApproverTeamId(e.target.value)}>
                  <option value="">— Select team —</option>
                  {orgTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </Sel>
                <div style={{ fontSize: 12, color: t.text3, marginTop: 6 }}>Any member of the selected team can approve; only one approval is needed.</div>
              </div>
            )}
          </div>
        )}

        {tab === "fields" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.5 }}>
              Add extra fields that requesters must fill in. <strong>Short description</strong> and <strong>Justification</strong> are always included.
            </div>
            {requestFields.map((f, i) => (
              <div key={f.key} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                  <div>
                    <Label>Label</Label>
                    <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="e.g. Department" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Sel value={f.type} onChange={(e) => updateField(i, { type: e.target.value })}>
                      {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
                    </Sel>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr auto", gap: 8, alignItems: "flex-end" }}>
                  <div>
                    <Label>Placeholder</Label>
                    <Input value={f.placeholder || ""} onChange={(e) => updateField(i, { placeholder: e.target.value })} placeholder="Helper text shown inside the field" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
                    <input type="checkbox" id={`req-${i}`} checked={!!f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                    <label htmlFor={`req-${i}`} style={{ fontSize: 12, color: t.text2, cursor: "pointer" }}>Required</label>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={() => removeField(i)} aria-label="Remove field">
                    <I name="trash" size={12} />
                  </Btn>
                </div>
                {f.type === "select" && (
                  <div>
                    <Label>Options (one per line)</Label>
                    <Input
                      multiline rows={3}
                      value={(f.options || []).join("\n")}
                      onChange={(e) => updateField(i, { options: e.target.value.split("\n") })}
                      placeholder={"Option A\nOption B\nOption C"}
                    />
                  </div>
                )}
              </div>
            ))}
            <Btn variant="secondary" size="sm" onClick={addField} style={{ alignSelf: "flex-start" }}>
              <I name="plus" size={12} /> Add field
            </Btn>
          </div>
        )}

        {error && <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function ServiceCatalogView({ items = [], currentUser, users, teams, orgs, orgSettings = [], onRequestItem, onCreateCatalogItem, tickets = [], onUpdateCatalogItem }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeItem, setActiveItem] = useState(null);
  const [manageItem, setManageItem] = useState(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    orgId: currentUser?.orgId || orgs[0]?.id || "",
    teamId: currentUser?.teamId || "",
    name: "",
    description: "",
    category: "General",
    icon: "request",
    defaultType: "Service Request",
    defaultPriority: "Medium",
    defaultUrgency: "Medium",
    requiresApproval: false,
    approverMode: "role",
    approverRole: "Admin",
    approverId: "",
    approverTeamId: "",
    requestFields: [],
  });

  const teamMap = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team])), [teams]);
  const approverCandidates = useMemo(() => {
    const orgUsers = users.filter((user) => user.orgId === createForm.orgId);
    if (createForm.approverMode === "user") return orgUsers;
    if (createForm.approverMode === "team") {
      const team = teamMap[createForm.approverTeamId];
      return team ? orgUsers.filter((user) => user.teamId === team.id) : orgUsers;
    }
    return orgUsers;
  }, [users, createForm.orgId, createForm.approverMode, createForm.approverTeamId, teamMap]);

  const categories = ["All", ...new Set(items.map((item) => item.category))];
  const filteredItems = useMemo(() => items.filter((item) => {
    if (!item.active) return false;
    if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
    if (!query.trim()) return true;
    const haystack = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [items, query, selectedCategory]);

  return (
    <div>
      {/* Header row: title + add button */}
      <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <h1 style={{ margin: 0, color: t.text, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>Service Catalog</h1>
          <p style={{ margin: "4px 0 0", color: t.text3, fontSize: 12 }}>Standardised request items, approvals, and fulfillment.</p>
        </div>
        <Btn variant="primary" onClick={() => setCreatingItem(true)}>
          <I name="plus" size={12} /> Add catalog item
        </Btn>
      </div>

      {/* Full-width search bar */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.text3, pointerEvents: "none" }}>
          <I name="search" size={13} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalog…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: t.surface2, border: `1px solid ${t.border}`,
            borderRadius: 9, padding: "9px 12px 9px 34px",
            fontSize: 13, color: t.text, fontFamily: t.font, outline: "none",
          }}
        />
      </div>

      {/* Category filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? t.accentBg : t.surface2,
              color: selectedCategory === cat ? t.accentText : t.text2,
              border: `1px solid ${selectedCategory === cat ? t.accent : t.border}`,
              borderRadius: 99, padding: "5px 13px",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: t.font,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filteredItems.map((item) => (
          <Card key={item.id} style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 190 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: t.accentBg, display: "grid", placeItems: "center", color: t.accent }}>
                <I name={item.icon || "request"} size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{item.name}</div>
                <div style={{ fontSize: 11, color: t.text3 }}>{item.category}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: t.text2, flex: 1 }}>{item.description}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {item.requiresApproval && <span style={{ fontSize: 10, fontWeight: 700, background: t.yellowBg, color: t.yellowText, borderRadius: 99, padding: "2px 7px" }}>Approval</span>}
              <span style={{ fontSize: 10, fontWeight: 700, background: t.surface2, color: t.text3, borderRadius: 99, padding: "2px 7px" }}>{item.defaultType}</span>
            </div>
            <Btn variant="primary" onClick={() => setActiveItem(item)}>
              <I name="plus" size={12} /> Request
            </Btn>
            {(() => {
              const orgSetting = (orgSettings || []).find((s) => s.orgId === item.orgId) || {};
              const allowed = canDo(currentUser, orgSetting, "catalog.manage");
              return allowed ? (
                <Btn variant="secondary" onClick={() => setManageItem(item)} style={{ border: `1px solid ${t.border}`, background: t.surface2 }}>
                  <I name="settings" size={12} /> Manage catalog item
                </Btn>
              ) : null;
            })()}
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <Card style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>No matching catalog items</div>
          <div style={{ fontSize: 13, color: t.text3 }}>Try a different search or category.</div>
        </Card>
      )}

      {activeItem && (
        <RequestModal
          item={activeItem}
          currentUser={currentUser}
          users={users}
          teams={teams}
          orgs={orgs}
          onClose={() => setActiveItem(null)}
          onSubmit={async (_item, payload) => onRequestItem(activeItem, payload)}
        />
      )}

      {creatingItem && (
        <Modal title="Add catalog item" onClose={() => { setCreatingItem(false); setCreateError(""); }} width={640}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Organisation</Label>
                <Sel value={createForm.orgId} onChange={(e) => setCreateForm((prev) => ({ ...prev, orgId: e.target.value, teamId: "", approverId: "", approverTeamId: "" }))}>
                  {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </Sel>
              </div>
              <div>
                <Label>Team</Label>
                <Sel value={createForm.teamId} onChange={(e) => setCreateForm((prev) => ({ ...prev, teamId: e.target.value }))}>
                  <option value="">All teams</option>
                  {teams.filter((team) => team.orgId === createForm.orgId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Name</Label>
                <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. New laptop request" />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={createForm.category} onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="e.g. Hardware" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input multiline rows={3} value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What is this item for?" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <Label>Type</Label>
                <Sel value={createForm.defaultType} onChange={(e) => setCreateForm((prev) => ({ ...prev, defaultType: e.target.value }))}>
                  <option>Service Request</option>
                  <option>Change Request</option>
                  <option>Incident</option>
                  <option>Task</option>
                </Sel>
              </div>
              <div>
                <Label>Priority</Label>
                <Sel value={createForm.defaultPriority} onChange={(e) => setCreateForm((prev) => ({ ...prev, defaultPriority: e.target.value }))}>
                  {["Critical", "High", "Medium", "Low"].map((priority) => <option key={priority}>{priority}</option>)}
                </Sel>
              </div>
              <div>
                <Label>Urgency</Label>
                <Sel value={createForm.defaultUrgency} onChange={(e) => setCreateForm((prev) => ({ ...prev, defaultUrgency: e.target.value }))}>
                  {["Critical", "High", "Medium", "Low"].map((urgency) => <option key={urgency}>{urgency}</option>)}
                </Sel>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface2 }}>
              <input type="checkbox" checked={createForm.requiresApproval} onChange={(e) => setCreateForm((prev) => ({ ...prev, requiresApproval: e.target.checked }))} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Require approval</div>
                <div style={{ fontSize: 12, color: t.text3 }}>Turn this on to route new requests through an approver.</div>
              </div>
            </div>
            {createForm.requiresApproval && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>Approver mode</Label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[{ id: "role", label: "Role" }, { id: "user", label: "User" }, { id: "team", label: "Team" }].map((option) => (
                      <Btn key={option.id} size="sm" variant={createForm.approverMode === option.id ? "primary" : "secondary"} onClick={() => setCreateForm((prev) => ({ ...prev, approverMode: option.id }))}>
                        {option.label}
                      </Btn>
                    ))}
                  </div>
                </div>
                {createForm.approverMode === "role" && (
                  <div>
                    <Label>Approver role</Label>
                    <Sel value={createForm.approverRole} onChange={(e) => setCreateForm((prev) => ({ ...prev, approverRole: e.target.value }))}>
                      {DEFAULT_TEAM_ROLES.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
                    </Sel>
                  </div>
                )}
                {createForm.approverMode === "user" && (
                  <div>
                    <Label>Approver user</Label>
                    <Sel value={createForm.approverId} onChange={(e) => setCreateForm((prev) => ({ ...prev, approverId: e.target.value }))}>
                      <option value="">Select user</option>
                      {approverCandidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </Sel>
                  </div>
                )}
                {createForm.approverMode === "team" && (
                  <div>
                    <Label>Approver team</Label>
                    <Sel value={createForm.approverTeamId} onChange={(e) => setCreateForm((prev) => ({ ...prev, approverTeamId: e.target.value }))}>
                      <option value="">Select team</option>
                      {teams.filter((team) => team.orgId === createForm.orgId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </Sel>
                  </div>
                )}
              </div>
            )}
            {createError && <div style={{ color: t.redText, background: t.redBg, border: `1px solid ${t.red}33`, borderRadius: 8, padding: 10, fontSize: 12 }}>{createError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="secondary" onClick={() => { setCreatingItem(false); setCreateError(""); }}>Cancel</Btn>
              <Btn variant="primary" disabled={createSaving} onClick={async () => {
                try {
                  setCreateSaving(true);
                  setCreateError("");
                  const created = await onCreateCatalogItem({ ...createForm });
                  setCreateForm((prev) => ({ ...prev, name: "", description: "" }));
                  if (created) setManageItem(created);
                } catch (err) {
                  setCreateError(err?.message || "Unable to create catalog item.");
                } finally {
                  setCreateSaving(false);
                }
              }}>{createSaving ? "Creating..." : "Create item"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {manageItem && (
        <ManageCatalogModal
          item={manageItem}
          users={users}
          teams={teams}
          onClose={() => setManageItem(null)}
          onSave={async (updates) => {
            try {
              await onUpdateCatalogItem(manageItem.id, updates);
              setManageItem(null);
            } catch (err) {
              // ignore — modal will show errors if needed
            }
          }}
        />
      )}
    </div>
  );
}

export function ApprovalsView({ approvals = [], catalogItems = [], tickets = [], currentUser, users, teams = [], orgSettings = [], onResolveApproval, onOpenTicket }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [selected, setSelected] = useState(null);

  const itemMap = useMemo(() => Object.fromEntries(catalogItems.map((item) => [item.id, item])), [catalogItems]);
  const ticketMap = useMemo(() => Object.fromEntries(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const teamMap = useMemo(() => Object.fromEntries(teams.map((tm) => [tm.id, tm])), [teams]);

  const filtered = approvals.filter((approval) => statusFilter === "All" || approval.status === statusFilter);

  const pendingCount = approvals.filter((approval) => approval.status === "Pending").length;
  const approvedCount = approvals.filter((approval) => approval.status === "Approved").length;
  const rejectedCount = approvals.filter((approval) => approval.status === "Rejected").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <h1 style={{ margin: 0, color: t.text, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>Approvals</h1>
          <p style={{ margin: "4px 0 0", color: t.text3, fontSize: 12 }}>Pending decisions for service requests and changes.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["Pending", pendingCount], ["Approved", approvedCount], ["Rejected", rejectedCount]].map(([label, count]) => (
            <button
              key={label}
              onClick={() => setStatusFilter(label)}
              style={{
                background: statusFilter === label ? t.accentBg : t.surface2,
                color: statusFilter === label ? t.accentText : t.text2,
                border: `1px solid ${statusFilter === label ? t.accent : t.border}`,
                borderRadius: 99,
                padding: "6px 11px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: t.font,
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((approval) => {
          const item = itemMap[approval.catalogItemId];
          const ticket = ticketMap[approval.ticketId];
          const assignee = users.find((user) => user.id === approval.approverId);
          const isTeamApproval = approval.approverMode === "team" && approval.approverTeamId;
          const teamApprovers = isTeamApproval ? users.filter((user) => user.teamId === approval.approverTeamId) : [];
          const approvalOrgSetting = (orgSettings || []).find((s) => s.orgId === approval.orgId) || {};
          const userRoles = Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role].filter(Boolean);
          const canAct = approval.status === "Pending" && canDo(currentUser, approvalOrgSetting, "approvals.resolve") && (
            (approval.approverMode === "user" && approval.approverId === currentUser?.id) ||
            (approval.approverMode === "team" && currentUser?.teamId === approval.approverTeamId) ||
            (approval.approverMode === "role" && userRoles.includes(approval.approverRole))
          );

          return (
            <Card key={approval.id} style={{ borderLeft: `4px solid ${approval.status === "Approved" ? t.green : approval.status === "Rejected" ? t.red : t.yellow}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3 }}>{approval.id}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "2px 7px", background: approval.status === "Approved" ? t.greenBg : approval.status === "Rejected" ? t.redBg : t.yellowBg, color: approval.status === "Approved" ? t.greenText : approval.status === "Rejected" ? t.redText : t.yellowText }}>
                      {approval.status}
                    </span>
                    {item && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 7px", background: t.surface3, color: t.text3 }}>{item.name}</span>}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: t.text }}>{ticket?.title || "Approval item"}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: t.text2, lineHeight: 1.5 }}>{item?.description || "No catalog item found."}</div>
                  {ticket?.description && (
                    <div style={{ marginTop: 8, fontSize: 13, color: t.text, lineHeight: 1.5 }}>
                      <div style={{ fontSize: 11, color: t.text3, marginBottom: 6, fontWeight: 700 }}>Requester reason / justification</div>
                      <div style={{ fontSize: 12, color: t.text2, whiteSpace: "pre-wrap" }}>{ticket.description}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: t.text3 }}>
                    <span>Requester: {users.find((user) => user.id === approval.requestedBy)?.name || approval.requestedBy}</span>
                    <span>Approver: {isTeamApproval ? `Team: ${teamMap[approval.approverTeamId]?.name || approval.approverTeamId}` : (assignee?.name || approval.approverRole)}</span>
                    {approval.dueAt && <span>Due: {new Date(approval.dueAt).toLocaleDateString("en-GB")}</span>}
                  </div>
                  {isTeamApproval && teamApprovers.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, marginBottom: 6 }}>Eligible approvers</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {teamApprovers.map((member) => (
                          <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}` }}>
                            <Avatar name={member.name} size={22} fs={8} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{member.name}</div>
                              <div style={{ fontSize: 11, color: t.text3 }}>{member.role || (Array.isArray(member.roles) ? member.roles.join(", ") : "Member")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <Btn variant="secondary" size="sm" onClick={() => onOpenTicket?.(ticket)} disabled={!ticket}>Open ticket</Btn>
                  {canAct && <Btn variant="primary" size="sm" onClick={() => setSelected({ approval, item, ticket })}>Review</Btn>}
                  {!canAct && (
                    <span style={{ fontSize: 12, color: t.text3, alignSelf: "center" }}>
                      Ticket status: {ticket?.status || "Unknown"}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>No approvals in this view</div>
            <div style={{ fontSize: 13, color: t.text3 }}>Try switching to another status filter.</div>
          </Card>
        )}
      </div>

      {selected && (
        <ApprovalDecisionModal
          approval={selected.approval}
          item={selected.item}
          ticket={selected.ticket}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onResolve={onResolveApproval}
        />
      )}
    </div>
  );
}
