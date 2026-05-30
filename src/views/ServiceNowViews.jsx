import { useMemo, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { DEFAULT_TEAM_ROLES } from "../core/constants.js";
import { Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

function hasRole(user, roleName) {
  const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role].filter(Boolean);
  return roles.some((role) => String(role).toLowerCase() === String(roleName).toLowerCase());
}

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
    description: "",
    justification: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orgTeams = teams.filter((team) => team.orgId === form.orgId);
  const orgUsers = users.filter((user) => user.orgId === form.orgId);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
      try {
      await onSubmit(item, {
        title: item.name,
        description: [item.description || "", form.description.trim(), form.justification.trim()].filter(Boolean).join("\n\n"),
        orgId: form.orgId,
        teamId: form.teamId,
        requestedFor: form.requestedFor || currentUser?.id,
        priority: form.priority,
        urgency: form.urgency,
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
            <Label>Request item</Label>
            <div style={{ padding: 10, borderRadius: 8, background: t.surface3 }}>{item.name}</div>
          </div>
          <div>
            <Label>Requested for</Label>
            <Sel value={form.requestedFor} onChange={(e) => setForm((prev) => ({ ...prev, requestedFor: e.target.value }))}>
              {orgUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Sel>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Organisation</Label>
            <Sel value={form.orgId} onChange={(e) => setForm((prev) => ({ ...prev, orgId: e.target.value, teamId: "", requestedFor: "" }))}>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
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
              {["Critical","High","Medium","Low"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </Sel>
          </div>
          <div>
            <Label>Item description</Label>
            <div style={{ padding: 10, borderRadius: 8, background: t.surface3, fontSize: 13, color: t.text2 }}>{item.description}</div>
          </div>
        </div>

        <div>
          <Label>Short description</Label>
          <Input multiline rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What do you need and why?" />
        </div>

        <div>
          <Label>Justification</Label>
          <Input multiline rows={3} value={form.justification} onChange={(e) => setForm((prev) => ({ ...prev, justification: e.target.value }))} placeholder="Add context that helps the approver decide." />
        </div>

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

function ManageCatalogModal({ item, users = [], teams = [], onClose, onSave }) {
  const t = useTokens();
  const [approverRole, setApproverRole] = useState(item.approverRole || "Admin");
  const [approverId, setApproverId] = useState(item.approverId || "");
  const [approverMode, setApproverMode] = useState(item.approverMode || "role"); // 'role' | 'user' | 'team'
  const [approverTeamId, setApproverTeamId] = useState(item.approverTeamId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orgUsers = users.filter((u) => u.orgId === item.orgId);
  const orgTeams = teams.filter((tm) => tm.orgId === item.orgId);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ approverRole, approverId, approverMode, approverTeamId });
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to save catalog item.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Manage: ${item.name}`} onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <Label>Approver type</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="radio" checked={approverMode === 'role'} onChange={() => setApproverMode('role')} /> Role</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="radio" checked={approverMode === 'user'} onChange={() => setApproverMode('user')} /> Specific user</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="radio" checked={approverMode === 'team'} onChange={() => setApproverMode('team')} /> Team (group)</label>
          </div>
        </div>

        {approverMode === 'role' && (
          <div>
            <Label>Approver role</Label>
            <Sel value={approverRole} onChange={(e) => setApproverRole(e.target.value)}>
              {DEFAULT_TEAM_ROLES.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </Sel>
          </div>
        )}

        {approverMode === 'user' && (
          <div>
            <Label>Specific approver (optional)</Label>
            <Sel value={approverId} onChange={(e) => setApproverId(e.target.value)}>
              <option value="">— Select user —</option>
              {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Sel>
          </div>
        )}

        {approverMode === 'team' && (
          <div>
            <Label>Approver team</Label>
            <Sel value={approverTeamId} onChange={(e) => setApproverTeamId(e.target.value)}>
              <option value="">— Select team —</option>
              {orgTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </Sel>
            <div style={{ fontSize: 12, color: t.text3, marginTop: 6 }}>Team approvals allow any member of the selected team to approve; only one approval is required.</div>
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

export function ServiceCatalogView({ items = [], currentUser, users, teams, orgs, orgSettings = [], onRequestItem, tickets = [], onUpdateCatalogItem }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeItem, setActiveItem] = useState(null);
  const [manageItem, setManageItem] = useState(null);

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
      <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <h1 style={{ margin: 0, color: t.text, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>Service Catalog</h1>
          <p style={{ margin: "4px 0 0", color: t.text3, fontSize: 12 }}>Standardized request items, approvals, and fulfillment.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog" style={{ minWidth: isMobile ? "100%" : 240 }} />
          <Sel value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ width: isMobile ? "100%" : 180 }}>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Sel>
        </div>
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
              const rolePerms = orgSetting.rolePermissions || {};
              const userRoles = Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role].filter(Boolean);
              const allowed = userRoles.some((r) => (rolePerms[r] && rolePerms[r]["catalog.manage"]) ) || hasRole(currentUser, "Admin") || hasRole(currentUser, "Catalog Manager");
              return allowed ? (
                <Btn variant="secondary" onClick={() => setManageItem(item)}>
                  <I name="settings" size={12} /> Manage
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
          onSubmit={async (payload) => onRequestItem(activeItem, payload)}
        />
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
          const orgSetting = (orgSettings || []).find((s) => s.orgId === approval.orgId) || {};
          const rolePerms = orgSetting.rolePermissions || {};
          const userRoles = Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role].filter(Boolean);
          // permission: approvals.resolve
          const roleAllowed = userRoles.some((r) => (rolePerms[r] && rolePerms[r]["approvals.resolve"]));
          const canAct = approval.status === "Pending" && (
            roleAllowed || hasRole(currentUser, approval.approverRole) || hasRole(currentUser, "Admin") || approval.approverId === currentUser?.id || (isTeamApproval && currentUser?.teamId === approval.approverTeamId)
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
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <Btn variant="secondary" size="sm" onClick={() => onOpenTicket?.(ticket)} disabled={!ticket}>Open ticket</Btn>
                  {canAct && <Btn variant="primary" size="sm" onClick={() => setSelected({ approval, item, ticket })}>Review</Btn>}
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
