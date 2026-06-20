import { useEffect, useMemo, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, DEFAULT_URGENCIES, DEFAULT_TICKET_TYPES } from "../core/constants.js";
import { Btn, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { getTicketTypes, canFeature } from "../core/subscriptions.js";
import { I } from "../core/icons.jsx";

export function NewTicketModal({ users, teams, orgs, currentUser, onClose, onCreate, defaultType, priorityCatalog, urgencyLevels, orgSettings = [], teamSettings = [], allTickets = [], plan = "Free", ticketTypes = DEFAULT_TICKET_TYPES }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  const isDefaultPriorityMap = (priorityMap = {}) => {
    const defaultEntries = Object.entries(PRIORITIES);
    const currentEntries = Object.entries(priorityMap || {});
    if (!currentEntries.length || currentEntries.length !== defaultEntries.length) return false;

    return defaultEntries.every(([name, cfg]) => {
      const current = priorityMap[name];
      return current && current.color === cfg.color && Number(current.sla) === Number(cfg.sla);
    });
  };

  const isDefaultUrgencies = (urgencies = []) => {
    if (!Array.isArray(urgencies) || urgencies.length !== DEFAULT_URGENCIES.length) return false;
    return urgencies.every((value, index) => value === DEFAULT_URGENCIES[index]);
  };

  const fallbackCatalog = (priorityCatalog && Object.keys(priorityCatalog).length) ? priorityCatalog : PRIORITIES;
  const fallbackUrgencies = useMemo(
    () => (urgencyLevels?.length ? urgencyLevels : ["Critical", "High", "Medium", "Low"]),
    [urgencyLevels]
  );
  const fallbackDefaultPriority = fallbackCatalog["Medium"] ? "Medium" : (Object.keys(fallbackCatalog)[0] || "Medium");

  const [form, setForm] = useState({
    title: "", description: "",
    type: defaultType || "Incident",
    category: "",
    priority: fallbackDefaultPriority,
    urgency: fallbackUrgencies.includes("Medium") ? "Medium" : fallbackUrgencies[0],
    orgId: currentUser.orgId,
    teamId: currentUser.teamId,
    assignee: "",
    tags: "",
    parentId: null,
    dueDate: "",
    estimateHours: "",
  });

  const [parentQuery, setParentQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ✅ FIX: reset category when org changes
  useEffect(() => {
    set("category", "");
    setCategoryQuery("");
  }, [form.orgId]);

  // Normalize orgSettings shape: accept array or object map
  const getOrgCategories = (settings, orgId) => {
    if (!settings) return [];
    if (Array.isArray(settings)) {
      const row = settings.find((r) => String(r?.orgId) === String(orgId));
      return Array.isArray(row?.categories) ? row.categories : [];
    }
    // object keyed by orgId
    const row = settings[String(orgId)] || settings?.orgId === orgId ? settings : null;
    return Array.isArray(row?.categories) ? row.categories : [];
  };

  const parentResults = parentQuery.length >= 1
    ? allTickets
        .filter((tk) =>
          tk.number.toLowerCase().includes(parentQuery.toLowerCase()) ||
          tk.title.toLowerCase().includes(parentQuery.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const resolvedSettings = useMemo(() => {
    const teamCfg = teamSettings.find((row) => row.teamId === form.teamId);
    const orgCfg = orgSettings.find((row) => row.orgId === form.orgId);
    const teamMap = teamCfg?.priorityMap || {};
    const orgMap = orgCfg?.priorityMap || {};
    const teamUrgencies = teamCfg?.urgencies || [];
    const orgUrgencies = orgCfg?.urgencies || [];

    const teamHasCustomPriority = Object.keys(teamMap).length && !isDefaultPriorityMap(teamMap);
    const teamHasCustomUrgencies = teamUrgencies.length && !isDefaultUrgencies(teamUrgencies);

    return {
      priorityMap: teamHasCustomPriority
        ? teamMap
        : (Object.keys(orgMap).length ? orgMap : (Object.keys(teamMap).length ? teamMap : fallbackCatalog)),
      urgencies: teamHasCustomUrgencies
        ? teamUrgencies
        : (orgUrgencies.length ? orgUrgencies : (teamUrgencies.length ? teamUrgencies : fallbackUrgencies)),
      categories: getOrgCategories(orgSettings, form.orgId), // ✅ org-only (normalized)
    };
  }, [form.orgId, form.teamId, orgSettings, teamSettings, fallbackCatalog, fallbackUrgencies]);

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

    const tags = form.tags
      ? form.tags.split(",").map((tg) => tg.trim().toLowerCase()).filter(Boolean)
      : [];

    try {
      const dueDateMs = form.dueDate ? new Date(`${form.dueDate}T23:59:59`).getTime() : null;
      const activeType = ticketTypes.find((tt) => tt.name === form.type);
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        prefix: activeType?.prefix,
        category: form.category,
        priority: form.priority,
        urgency: form.urgency,
        orgId: form.orgId,
        teamId: form.teamId,
        assignee: form.assignee || currentUser.id,
        status: "Open",
        tags,
        parentId: form.parentId || null,
        dueDate: dueDateMs,
        estimateHours: form.estimateHours === "" ? null : Number(form.estimateHours),
        spentHours: 0,
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
            {ticketTypes.map((tt) => {
              const name = tt.name;
              const isBuiltin = DEFAULT_TICKET_TYPES.some((d) => d.name === name);
              const allowed = getTicketTypes(plan);
              // Built-ins respect the per-plan allowed list; custom org types need Basic+
              const locked = isBuiltin ? !allowed.includes(name) : !canFeature(plan, "allTicketTypes");
              return (
                <button
                  key={name}
                  onClick={() => !locked && set("type", name)}
                  title={locked ? "Requires Basic plan" : ""}
                  style={{
                    border: `1.5px solid ${form.type === name ? t.accent : t.border}`,
                    borderRadius: 9, padding: "8px 6px",
                    background: form.type === name ? t.accentBg : locked ? t.surface3 : t.surface2,
                    cursor: locked ? "not-allowed" : "pointer",
                    fontFamily: t.font, textAlign: "center", position: "relative", opacity: locked ? 0.55 : 1,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: form.type === name ? t.accentText : t.text2 }}>
                    {name.split(" ")[0]}
                  </div>
                  {locked && (
                    <span style={{ position: "absolute", top: 4, right: 5, color: t.text3 }}>
                      <I name="lock" size={9} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {getTicketTypes(plan).length < DEFAULT_TICKET_TYPES.length && ticketTypes.length <= DEFAULT_TICKET_TYPES.length && (
            <div style={{ fontSize: 11, color: t.text3, marginTop: 6 }}>
              <I name="lock" size={10} /> Change Requests, Problems &amp; Tasks require the <strong>Basic</strong> plan.
            </div>
          )}
        </div>

        {/* Category + Priority */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Category</Label>
            <div style={{ position: "relative" }}>
              <Input
                value={categoryQuery || form.category}
                onChange={(e) => {
                  const value = e.target.value;
                  setCategoryQuery(value);
                  set("category", value);
                  setCategoryOpen(true);
                }}
                onFocus={() => setCategoryOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCategoryOpen(false);
                }}
                placeholder="Type or search categories…"
                aria-label="Category"
              />
              {categoryOpen && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 40 }}>
                  <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, marginTop: 6, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                    {(() => {
                      const options = resolvedSettings.categories || [];
                      const term = String(categoryQuery || form.category || "").trim().toLowerCase();
                      const filtered = term
                        ? options.filter((c) => c.toLowerCase().includes(term))
                        : options;
                      const shown = filtered.slice(0, 8);
                      return shown.length > 0 ? shown.map((c) => (
                        <Btn key={c} variant="ghost" full size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { set("category", c); setCategoryQuery(c); setCategoryOpen(false); }} style={{ justifyContent: "flex-start", borderBottom: `1px solid ${t.border}`, padding: "8px 10px", textAlign: "left", fontFamily: t.font }}>
                          {c}
                        </Btn>
                      )) : (
                        <div style={{ padding: 10, fontSize: 12, color: t.text3 }}>
                          No saved categories for this organisation yet. You can type a new one, or add categories in org settings.
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gap: 5 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              placeholder="Optional deadline"
            />
          </div>
          <div>
            <Label>Estimate (hours)</Label>
            <Input
              type="number"
              value={form.estimateHours}
              onChange={(e) => set("estimateHours", e.target.value)}
              placeholder="How long should this take?"
            />
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

        {/* Parent Incident */}
        <div>
          <Label>Parent Incident <span style={{ fontWeight: 400, fontSize: 10, color: t.text3 }}>optional</span></Label>
          {form.parentId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surface2, borderRadius: 9, padding: "9px 12px", border: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3, flexShrink: 0 }}>{form.parentId}</span>
              <span style={{ flex: 1, fontSize: 12, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {allTickets.find((tk) => tk.id === form.parentId)?.title || ""}
              </span>
              <button onClick={() => { set("parentId", null); setParentQuery(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Input
                value={parentQuery}
                onChange={(e) => setParentQuery(e.target.value)}
                placeholder="Search for a parent ticket by ID or title…"
              />
              {parentResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 9, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.15)", marginTop: 3 }}>
                  {parentResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { set("parentId", r.id); setParentQuery(""); }}
                      style={{ width: "100%", background: "none", border: "none", borderBottom: `1px solid ${t.border}`, cursor: "pointer", padding: "9px 12px", textAlign: "left", fontFamily: t.font, display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3, flexShrink: 0 }}>{r.id}</span>
                      <span style={{ fontSize: 12, color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      <span style={{ fontSize: 10, color: t.text3, flexShrink: 0 }}>{r.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
