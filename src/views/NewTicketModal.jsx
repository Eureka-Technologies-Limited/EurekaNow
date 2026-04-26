// ─────────────────────────────────────────────────────────────────────────────
// VIEW: NewTicketModal
// Form for creating any ticket type. Pre-selects type based on current view.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, TICKET_TYPES, CATEGORIES } from "../core/constants.js";
import { Btn, Input, Label, Modal, Sel } from "../ui/primitives.jsx";

export function NewTicketModal({ users, teams, orgs, currentUser, onClose, onCreate, defaultType, priorityCatalog, urgencyLevels, orgSettings = [] }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const fallbackCatalog = (priorityCatalog && Object.keys(priorityCatalog).length) ? priorityCatalog : PRIORITIES;
  const fallbackUrgencies = useMemo(
    () => (urgencyLevels?.length ? urgencyLevels : ["Critical", "High", "Medium", "Low"]),
    [urgencyLevels]
  );
  const fallbackDefaultPriority = fallbackCatalog["Medium"] ? "Medium" : (Object.keys(fallbackCatalog)[0] || "Medium");

  const [form, setForm] = useState({
    title: "", description: "",
    type: defaultType || "Incident",
    category: CATEGORIES[0],
    priority: fallbackDefaultPriority,
    urgency: fallbackUrgencies.includes("Medium") ? "Medium" : fallbackUrgencies[0],
    orgId: currentUser.orgId,
    teamId: currentUser.teamId,
    assignee: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const resolvedSettings = useMemo(() => {
    const orgCfg = orgSettings.find((row) => row.orgId === form.orgId);
    if (orgCfg) return orgCfg;
    return { priorityMap: fallbackCatalog, urgencies: fallbackUrgencies };
  }, [form.orgId, orgSettings, fallbackCatalog, fallbackUrgencies]);

  const catalog = (resolvedSettings.priorityMap && Object.keys(resolvedSettings.priorityMap).length)
    ? resolvedSettings.priorityMap
    : fallbackCatalog;
  const catalogEntries = Object.entries(catalog);
  const urgencyOptions = resolvedSettings.urgencies?.length ? resolvedSettings.urgencies : fallbackUrgencies;

  useEffect(() => {
    if (!catalog[form.priority]) {
      const nextPriority = catalog["Medium"] ? "Medium" : (Object.keys(catalog)[0] || "Medium");
      set("priority", nextPriority);
    }
    if (!urgencyOptions.includes(form.urgency)) {
      set("urgency", urgencyOptions.includes("Medium") ? "Medium" : urgencyOptions[0]);
    }
  }, [catalog, form.priority, form.urgency, urgencyOptions]);

  const orgTeams = teams.filter((t2) => t2.orgId === form.orgId);
  const orgUsers = users.filter((u)  => u.orgId  === form.orgId);
  const roleLabel = (user) => {
    const roles = Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.role].filter(Boolean);
    return roles.join(", ") || "Member";
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    const tags   = form.tags
      ? form.tags.split(",").map((tg) => tg.trim().toLowerCase()).filter(Boolean)
      : [];

    try {
      await onCreate({
        title:       form.title.trim(),
        description: form.description.trim(),
        type:        form.type,
        category:    form.category,
        priority:    form.priority,
        urgency:     form.urgency,
        orgId:       form.orgId,
        teamId:      form.teamId,
        assignee:    form.assignee || currentUser.id,
        status:      "Open",
        tags,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create ticket.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Raise New Ticket" onClose={onClose} width={580}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Title */}
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief, descriptive summary…" autoFocus />
        </div>

        {/* Ticket type selector */}
        <div>
          <Label>Ticket Type</Label>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 7 }}>
            {TICKET_TYPES.map((tp) => (
              <button
                key={tp}
                onClick={() => set("type", tp)}
                style={{
                  border: `1.5px solid ${form.type === tp ? t.accent : t.border}`,
                  borderRadius: 9, padding: "8px 6px",
                  background: form.type === tp ? t.accentBg : t.surface2,
                  cursor: "pointer", fontFamily: t.font, textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: form.type === tp ? t.accentText : t.text2 }}>
                  {tp.split(" ")[0]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category + Priority */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Category</Label>
            <Sel value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Sel>
          </div>
          <div>
            <Label>Priority</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
              {catalogEntries.map(([p, cfg]) => (
                <button
                  key={p}
                  onClick={() => set("priority", p)}
                  style={{
                    border: `1.5px solid ${form.priority === p ? cfg.color : t.border}`,
                    borderRadius: 8, padding: "7px 2px",
                    background: form.priority === p ? cfg.color + "18" : t.surface2,
                    cursor: "pointer", fontFamily: t.font, textAlign: "center",
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, margin: "0 auto 3px" }} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: form.priority === p ? cfg.color : t.text3 }}>{p}</div>
                  <div style={{ fontSize: 8, color: t.text3 }}>{cfg.sla}h</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Urgency</Label>
          <Sel value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
            {urgencyOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </Sel>
        </div>

        {/* Org + Team */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Organisation</Label>
            <Sel value={form.orgId} onChange={(e) => { set("orgId", e.target.value); set("teamId", ""); set("assignee", ""); }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Sel>
          </div>
          <div>
            <Label>Team</Label>
            <Sel value={form.teamId} onChange={(e) => set("teamId", e.target.value)}>
              <option value="">— Select team —</option>
              {orgTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </Sel>
          </div>
        </div>

        {/* Assign To */}
        <div>
          <Label>Assign To</Label>
          <Sel value={form.assignee} onChange={(e) => set("assignee", e.target.value)}>
            <option value="">Auto-assign</option>
            {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({roleLabel(u)})</option>)}
          </Sel>
        </div>

        {/* Description */}
        <div>
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Steps to reproduce, impact, affected systems…" multiline rows={isMobile ? 3 : 4} />
        </div>

        {/* Tags */}
        <div>
          <Label>Tags (comma-separated)</Label>
          <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="vpn, auth, remote-work" />
        </div>

        {/* Actions */}
        {error && (
          <div style={{ background: t.redBg, border: `1px solid ${t.red}44`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: t.redText }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate} disabled={!form.title.trim() || saving}>{saving ? "Creating..." : "Raise Ticket"}</Btn>
        </div>
      </div>
    </Modal>
  );
}
