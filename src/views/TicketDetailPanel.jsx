// ─────────────────────────────────────────────────────────────────────────────
// VIEW: TicketDetailPanel
// Slide-over panel on desktop; full-screen sheet on mobile.
// Tabs: Activity | Related | PIR (Incident + Closed only)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, STATUSES } from "../core/constants.js";
import { fmtTs, slaForPriority, findPriorityCfg, canDo } from "../core/utils.js";
import { Avatar, Btn, Card, Input, TypeBadge, SLABar, StatusBadge } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { canFeature } from "../core/subscriptions.js";

export function TicketDetailPanel({ ticket, users, currentUser, onClose, onPatch, onComment, priorityCatalog, urgencyLevels, review, onSaveReview, closingTemplates = [], pirFieldConfig = null, allTickets = [], onOpenTicket, plan = "Free", onUpgrade, approvals = [], onResolveApproval, onAddApproval, ticketTypes = [], orgSettings = [] }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const catalog = (priorityCatalog && Object.keys(priorityCatalog).length) ? priorityCatalog : PRIORITIES;
  const urgencyOptions = urgencyLevels?.length ? urgencyLevels : ["Critical", "High", "Medium", "Low"];

  const [tk,              setTk]             = useState(ticket);
  const [tab,             setTab]            = useState("activity");
  const [comment,         setComment]        = useState("");
  const [showCloseTemplate, setShowCloseTemplate] = useState(false);
  const [selectedTemplate,  setSelectedTemplate]  = useState("");
  const [showParentSearch, setShowParentSearch] = useState(false);
  const [parentQuery,      setParentQuery]      = useState("");
  const [showChildSearch,  setShowChildSearch]  = useState(false);
  const [childQuery,       setChildQuery]       = useState("");
  const [reviewForm, setReviewForm] = useState({
    summary:     review?.summary    || "",
    rootCause:   review?.rootCause  || "",
    timeline:    review?.timeline   || "",
    actionItems: (review?.actionItems || []).join("\n"),
    owner:       review?.owner      || "",
    ...((review?.customData || {})),
  });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [approvalComments, setApprovalComments] = useState({});
  const [approvalSaving, setApprovalSaving] = useState({});
  const [nextApproverId, setNextApproverId] = useState("");
  const [addingApprover, setAddingApprover] = useState(false);
  const [addApproverError, setAddApproverError] = useState("");
  const [cfEdit, setCfEdit] = useState(false);
  const [cfDraft, setCfDraft] = useState({});

  const [cfSaving, setCfSaving] = useState(false);
  const [cfErr, setCfErr] = useState("");

  const now = Date.now();
  const isOverdue = !!tk.dueDate && tk.dueDate < now && !["Resolved", "Closed"].includes(tk.status);
  const remainingHours = tk.dueDate ? Math.ceil((tk.dueDate - now) / 3600000) : null;

  // PIR is only accessible when the ticket is a Closed Incident
  const showPIR = tk.type === "Incident" && (tk.status === "Closed" || tk.status === "Resolved");

  // Relationship helpers
  const parentTicket = tk.parentId ? (allTickets.find((t) => t.id === tk.parentId) || null) : null;
  const childTickets = allTickets.filter((t) => t.parentId === tk.id);
  const childIds     = new Set(childTickets.map((t) => t.id));
  const relatedCount = childTickets.length + (tk.parentId ? 1 : 0);

  const parentSearchResults = parentQuery.length >= 1
    ? allTickets
        .filter((t) => t.id !== tk.id && !childIds.has(t.id) && (
          t.id.toLowerCase().includes(parentQuery.toLowerCase()) ||
          t.title.toLowerCase().includes(parentQuery.toLowerCase())
        ))
        .slice(0, 6)
    : [];

  const childSearchResults = childQuery.length >= 1
    ? allTickets
        .filter((t) => t.id !== tk.id && !childIds.has(t.id) && t.id !== tk.parentId && (
          t.id.toLowerCase().includes(childQuery.toLowerCase()) ||
          t.title.toLowerCase().includes(childQuery.toLowerCase())
        ))
        .slice(0, 6)
    : [];

  const applicableTemplates = closingTemplates.filter((tmpl) =>
    tmpl.applyToTypes.includes(tk.type)
  );

  const roleLabel = (user) => {
    const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean);
    return roles.join(", ") || "Member";
  };

  useEffect(() => { setTk(ticket); }, [ticket]);

  // If PIR tab is active but the ticket no longer qualifies, fall back to Activity
  useEffect(() => {
    if (tab === "pir" && !showPIR) setTab("activity");
  }, [tk.status, tk.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset sidebar draft whenever a different ticket is opened
  useEffect(() => { setDraft(null); }, [tk.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const customData = (review?.customData || {});
    setReviewForm({
      summary:     review?.summary   || "",
      rootCause:   review?.rootCause || "",
      timeline:    review?.timeline  || "",
      actionItems: (review?.actionItems || []).join("\n"),
      owner:       review?.owner     || "",
      ...customData,
    });
  }, [review]);

  const applyTemplate = (templateId) => {
    const template = applicableTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setComment(template.content);
    setSelectedTemplate(templateId);
    setShowCloseTemplate(false);
  };

  // Sidebar draft helpers — changes don't save until saveChanges() is called
  const isDirty = draft !== null;
  const setField = (k, v) => setDraft((prev) => {
    const base = prev ?? {
      status: tk.status,
      priority: tk.priority,
      urgency: tk.urgency || "",
      assignee: tk.assignee || "",
      dueDate: tk.dueDate || null,
      estimateHours: tk.estimateHours ?? "",
      spentHours: tk.spentHours ?? 0,
    };
    return { ...base, [k]: v };
  });

  const saveChanges = async () => {
    if (!draft || saving) return;
    const fields = {};
    if (draft.status !== tk.status) fields.status = draft.status;
    if (draft.priority !== tk.priority) fields.priority = draft.priority;
    if (draft.urgency !== (tk.urgency || "")) fields.urgency = draft.urgency;
    if (draft.assignee !== (tk.assignee || "")) fields.assignee = draft.assignee;
    if (draft.dueDate !== (tk.dueDate || null)) fields.dueDate = draft.dueDate;
    if (String(draft.estimateHours ?? "") !== String(tk.estimateHours ?? "")) fields.estimateHours = draft.estimateHours;
    if (String(draft.spentHours ?? 0) !== String(tk.spentHours ?? 0)) fields.spentHours = draft.spentHours;
    if (!Object.keys(fields).length) { setDraft(null); return; }
    setSaving(true);
    const previous = tk;
    const savedDraft = draft;
    setTk((prev) => ({ ...prev, ...fields }));
    setDraft(null);
    try {
      const saved = await onPatch(tk.id, fields);
      if (saved) setTk(saved);
      if (fields.status) {
        const children = allTickets.filter((c) => c.parentId === tk.id);
        if (children.length > 0) {
          await Promise.all(children.map((c) => onPatch?.(c.id, { status: fields.status })));
        }
      }
    } catch {
      setTk(previous);
      setDraft(savedDraft);
    } finally {
      setSaving(false);
    }
  };

  // Immediate update — used for operations like parent linking that should save right away
  const update = async (fields) => {
    if (saving) return;
    const previous = tk;
    setTk({ ...tk, ...fields });
    if (!onPatch) return;
    setSaving(true);
    try {
      const saved = await onPatch(tk.id, fields);
      if (saved) setTk(saved);
    } catch {
      setTk(previous);
    } finally {
      setSaving(false);
    }
  };

  const postComment = async () => {
    const text = comment.trim();
    if (!text || saving || !onComment) return;
    setSaving(true);
    try {
      const created = await onComment(tk.id, { userId: currentUser.id, text });
      // Parent updates `tickets` and `activeTicket`; avoid optimistic local append
      // to prevent duplicate comments when the parent prop refreshes.
      console.log("Comment created:", created);
      setComment("");
    } finally {
      setSaving(false);
    }
  };

  const saveReview = async () => {
    if (!onSaveReview || !showPIR) return;
    setReviewSaving(true);
    try {
      const standardFields = {
        id:          review?.id,
        ticketId:    tk.id,
        orgId:       tk.orgId,
        teamId:      tk.teamId,
        summary:     reviewForm.summary,
        rootCause:   reviewForm.rootCause,
        timeline:    reviewForm.timeline,
        actionItems: reviewForm.actionItems.split("\n").map((r) => r.trim()).filter(Boolean),
        owner:       reviewForm.owner,
      };
      const customData = {};
      const stdKeys = ["summary", "rootCause", "timeline", "actionItems", "owner"];
      Object.keys(reviewForm).forEach((k) => { if (!stdKeys.includes(k)) customData[k] = reviewForm[k]; });
      await onSaveReview({ ...standardFields, customData });
    } finally {
      setReviewSaving(false);
    }
  };

  const agents   = users.filter((u) => u.orgId === tk.orgId);
  const reporter = users.find((u) => u.id === tk.reporter);
  const currentUserRoles = Array.isArray(currentUser?.roles) && currentUser.roles.length
    ? currentUser.roles
    : [currentUser?.role].filter(Boolean);
  const orgSetting = orgSettings.find((s) => s.orgId === tk.orgId);
  const canEditCustomFields = canDo(currentUser, orgSetting, "tickets.customFields") || canDo(currentUser, orgSetting, "tickets.edit");
  // Fields that apply to this ticket type (empty ticketTypes = all types)
  const orgCustomFields = (orgSetting?.customTicketFields || []).filter(
    (f) => !f.ticketTypes?.length || f.ticketTypes.includes(tk.type)
  );
  const ticketApprovals = (approvals || []).filter((a) => a.ticketId === tk.id);
  const pendingApproverIds = new Set(
    ticketApprovals
      .filter((a) => a.status === "Pending" && a.approverId)
      .map((a) => a.approverId)
  );
  // Only users who have the approvals.resolve permission are valid approvers
  const addableApprovers = agents.filter(
    (u) => !pendingApproverIds.has(u.id) && canDo(u, orgSetting, "approvals.resolve")
  );
  const canManageApprovals = Boolean(
    currentUser?.id === tk.reporter ||
    currentUser?.id === tk.assignee ||
    canDo(currentUser, orgSetting, "approvals.resolve")
  );

  const overlay = isMobile
    ? { position: "fixed", inset: 0, background: t.surface, zIndex: 250, display: "flex", flexDirection: "column", overflowY: "auto", WebkitOverflowScrolling: "touch" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" };

  const panel = isMobile
    ? { flex: 1, display: "flex", flexDirection: "column" }
    : { background: t.surface, width: "min(580px,100vw)", height: "100vh", display: "flex", flexDirection: "column", borderLeft: `1px solid ${t.border2}`, boxShadow: "-16px 0 64px rgba(0,0,0,0.4)" };

  const p = (v) => isMobile ? v[0] : v[1];
  const formatDateInput = (ms) => {
    if (!ms) return "";
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ── Shared search dropdown ─────────────────────────────────────────────────
  const SearchDropdown = ({ results, onSelect }) => results.length === 0 ? null : (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, marginTop: 3, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
      {results.map((r) => (
        <Btn
          key={r.id}
          variant="ghost"
          full
          onClick={() => onSelect(r)}
          style={{ justifyContent: "flex-start", borderBottom: `1px solid ${t.border}`, padding: "8px 10px", textAlign: "left", fontFamily: t.font, display: "flex", gap: 8, alignItems: "center" }}
        >
          <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3, flexShrink: 0 }}>{r.id}</span>
          <span style={{ fontSize: 12, color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
          <StatusBadge status={r.status} />
        </Btn>
      ))}
    </div>
  );

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs = [
    { id: "activity", label: "Activity",     badge: tk.comments.length || null },
    { id: "related",    label: "Related",           badge: relatedCount || null },
    { id: "approvals",  label: "Approvals",          badge: ticketApprovals.filter((a) => a.status === "Pending").length || null },
    ...(showPIR ? [{ id: "pir", label: "Post-Incident Review" }] : []),
  ];

  const tabBtn = (tb) => (
    <button
      key={tb.id}
      onClick={() => setTab(tb.id)}
      style={{
        background: "none", border: "none",
        borderBottom: tab === tb.id ? `2px solid ${t.accent}` : "2px solid transparent",
        padding: "9px 14px 10px", marginBottom: -1, cursor: "pointer",
        fontFamily: t.font, fontSize: 12, fontWeight: tab === tb.id ? 700 : 500,
        color: tab === tb.id ? t.accent : t.text2,
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
      }}
    >
      {tb.label}
      {tb.badge > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700, background: tab === tb.id ? t.accent : t.surface3,
          color: tab === tb.id ? "#fff" : t.text3,
          borderRadius: 99, padding: "1px 5px", lineHeight: "14px",
        }}>{tb.badge}</span>
      )}
    </button>
  );

  return (
    <div onClick={isMobile ? undefined : (e) => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={panel}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          borderLeft: `4px solid ${((findPriorityCfg(catalog, tk.priority) || {}).color) || "#888"}`,
          padding: p(["14px 16px", "18px 22px"]),
          borderBottom: `1px solid ${t.border}`, flexShrink: 0, background: t.surface,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: t.mono, fontSize: 10, color: t.text3 }}>{tk.number}</span>
                <TypeBadge type={tk.type} ticketTypes={ticketTypes} />
                {tk.parentId && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: t.surface3, color: t.text3, borderRadius: 99, padding: "2px 7px", border: `1px solid ${t.border}` }}>
                    child ticket
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: 0, lineHeight: 1.4 }}>{tk.title}</h2>
              {tk.tags && tk.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
                  {tk.tags.map((tg) => (
                    <span key={tg} style={{ fontSize: 10, color: t.text3, background: t.surface3, padding: "1px 6px", borderRadius: 99 }}>#{tg}</span>
                  ))}
                </div>
              )}
            </div>
            <Btn variant="ghost" onClick={onClose} style={{ fontSize: 22, padding: 2, color: t.text3, lineHeight: 1, flexShrink: 0 }}>×</Btn>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Controls ───────────────────────────────────────────────────────── */}
          <div style={{ padding: p(["12px 16px", "14px 22px"]), borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Status</div>
                <select value={draft?.status ?? tk.status} onChange={(e) => setField("status", e.target.value)} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${isDirty ? t.accent : t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Priority</div>
                <select value={draft?.priority ?? tk.priority} onChange={(e) => setField("priority", e.target.value)} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${isDirty ? t.accent : t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {Object.keys(catalog).map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Urgency</div>
                <select value={draft?.urgency ?? (tk.urgency || urgencyOptions[0])} onChange={(e) => setField("urgency", e.target.value)} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${isDirty ? t.accent : t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {urgencyOptions.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Assign To</div>
                <select value={draft?.assignee ?? (tk.assignee || "")} onChange={(e) => setField("assignee", e.target.value)} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${isDirty ? t.accent : t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  <option value="">Unassigned</option>
                  {agents.map((u) => <option key={u.id} value={u.id}>{u.name} ({roleLabel(u)})</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Due Date</div>
                <Input
                  type="date"
                  value={formatDateInput(draft?.dueDate ?? tk.dueDate)}
                  onChange={(e) => setField("dueDate", e.target.value ? new Date(`${e.target.value}T23:59:59`).getTime() : null)}
                  style={{ padding: "7px 10px", fontSize: 12, borderColor: isDirty ? t.accent : undefined }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Estimate / Spent</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                  <Input
                    type="number"
                    value={draft?.estimateHours ?? (tk.estimateHours ?? "")}
                    onChange={(e) => setField("estimateHours", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="Estimate"
                    style={{ padding: "7px 10px", fontSize: 12, borderColor: isDirty ? t.accent : undefined }}
                  />
                  <Input
                    type="number"
                    value={draft?.spentHours ?? (tk.spentHours ?? 0)}
                    onChange={(e) => setField("spentHours", e.target.value === "" ? 0 : Number(e.target.value))}
                    placeholder="Spent"
                    style={{ padding: "7px 10px", fontSize: 12, borderColor: isDirty ? t.accent : undefined }}
                  />
                </div>
              </div>
            </div>
            {isDirty && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Btn variant="primary" size="sm" onClick={saveChanges} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Btn>
                <Btn variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={saving}>
                  Discard
                </Btn>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>
                {(() => {
                  const cfg = findPriorityCfg(catalog, tk.priority);
                  const slaDisplay = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(tk.priority);
                  return `SLA — ${slaDisplay}h target`;
                })()}
              </div>
              <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={(findPriorityCfg(catalog, tk.priority) && Number(findPriorityCfg(catalog, tk.priority).sla) > 0) ? Number(findPriorityCfg(catalog, tk.priority).sla) : slaForPriority(tk.priority)} endAt={tk.resolvedAt} />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {reporter && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar name={reporter.name} size={20} fs={7} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3 }}>Reporter</div>
                    <div style={{ fontSize: 11, color: t.text2 }}>{reporter.name}</div>
                  </div>
                </div>
              )}
              {tk.dueDate && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3 }}>Deadline</div>
                  <div style={{ fontSize: 11, color: isOverdue ? t.redText : t.text2, marginTop: 2 }}>
                    {isOverdue ? `Overdue by ${Math.max(1, Math.abs(remainingHours || 0))}h` : remainingHours !== null ? `${remainingHours}h left` : fmtTs(tk.dueDate)}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3 }}>Created</div>
                <div style={{ fontSize: 11, color: t.text2, marginTop: 2 }}>{fmtTs(tk.createdAt)}</div>
              </div>
            </div>
          </div>

          {/* ── Tab bar ────────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, flexShrink: 0, paddingLeft: p(["4px", "8px"]), overflowX: "auto" }}>
            {tabs.map(tabBtn)}
          </div>

          {/* ── Tab content ────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", padding: p(["12px 16px", "14px 22px"]), WebkitOverflowScrolling: "touch" }}>

            {/* ── ACTIVITY tab ──────────────────────────────────────────────── */}
            {tab === "activity" && (
              <div>
                {(() => {
                  // Structured custom fields (new catalog requests) take priority over plain description.
                  // Exclude keys that are org-defined custom fields — those show in the Custom Fields section below.
                  const cf = tk.customFields || {};
                  const orgFieldKeys = new Set(orgCustomFields.map((f) => f.key));
                  const cfKeys = Object.keys(cf).filter((k) => cf[k] && !orgFieldKeys.has(k));
                  if (cfKeys.length > 0) {
                    const fieldOrder = ["shortDescription", "justification", ...cfKeys.filter((k) => k !== "shortDescription" && k !== "justification")];
                    const fieldLabel = { shortDescription: "Short description", justification: "Justification" };
                    return (
                      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 12 }}>
                        {fieldOrder.filter((k) => cf[k]).map((k) => (
                          <div key={k}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>
                              {fieldLabel[k] || k}
                            </div>
                            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{cf[k]}</div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  // Fallback: plain description (old tickets or non-catalog tickets)
                  if (!tk.description) return null;
                  const isRequestLike = !!tk.catalogItemId || tk.type === "Service Request";
                  if (isRequestLike) {
                    const parts = String(tk.description).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
                    if (parts.length > 1) {
                      return (
                        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Short description</div>
                          <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{parts.slice(0, -1).join("\n\n")}</div>
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Justification</div>
                            <div style={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>{parts[parts.length - 1]}</div>
                          </div>
                        </div>
                      );
                    }
                  }
                  return (
                    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Description</div>
                      <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tk.description}</div>
                    </div>
                  );
                })()}

                {/* Show requestedFor / requested for user when present (catalog requests) */}
                {tk.requestedFor && tk.requestedFor !== tk.reporter && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Requested for</div>
                    <div style={{ fontSize: 13, color: t.text2 }}>{(users.find((u) => u.id === tk.requestedFor) || {}).name || tk.requestedFor}</div>
                  </div>
                )}

                {/* ── Custom fields (org-defined only) ───────────────────────── */}
                {orgCustomFields.length > 0 && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3 }}>Custom Fields</div>
                      {canEditCustomFields && !cfEdit && (
                        <Btn variant="secondary" size="sm" onClick={() => { setCfDraft({ ...(tk.customFields || {}) }); setCfEdit(true); }}>
                          <I name="edit" size={11} /> Edit
                        </Btn>
                      )}
                    </div>

                    {!cfEdit ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {orgCustomFields.map((f) => {
                          const val = tk.customFields?.[f.key];
                          return (
                            <div key={f.key}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.text3, marginBottom: 3 }}>
                                {f.label}{f.required && <span style={{ color: t.red }}> *</span>}
                              </div>
                              <div style={{ fontSize: 13, color: val ? t.text2 : t.text3, fontStyle: val ? "normal" : "italic" }}>
                                {val || "Not set"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {orgCustomFields.map((f) => (
                          <div key={f.key}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: t.text3, marginBottom: 5 }}>
                              {f.label}{f.required && <span style={{ color: t.red }}> *</span>}
                            </div>
                            {f.type === "textarea" ? (
                              <textarea
                                value={cfDraft[f.key] || ""}
                                onChange={(e) => setCfDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                placeholder={f.placeholder || ""}
                                rows={3}
                                style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: 12, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontFamily: "inherit", resize: "vertical" }}
                              />
                            ) : f.type === "select" ? (
                              <select
                                value={cfDraft[f.key] || ""}
                                onChange={(e) => setCfDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                style={{ width: "100%", padding: "7px 9px", fontSize: 12, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontFamily: "inherit" }}
                              >
                                <option value="">— Select —</option>
                                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input
                                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                value={cfDraft[f.key] || ""}
                                onChange={(e) => setCfDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                placeholder={f.placeholder || ""}
                                style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: 12, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text }}
                              />
                            )}
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn
                            variant="primary"
                            size="sm"
                            disabled={cfSaving}
                            onClick={async () => {
                              setCfSaving(true);
                              setCfErr("");
                              try {
                                const merged = { ...(tk.customFields || {}) };
                                for (const f of orgCustomFields) {
                                  merged[f.key] = cfDraft[f.key] ?? "";
                                }
                                await onPatch(tk.id, { customFields: merged });
                                setTk((prev) => ({ ...prev, customFields: merged }));
                                setCfEdit(false);
                              } catch (e) {
                                setCfErr(e?.message || "Failed to save custom fields.");
                              } finally { setCfSaving(false); }
                            }}
                          >
                            {cfSaving ? "Saving…" : "Save"}
                          </Btn>
                          <Btn variant="secondary" size="sm" onClick={() => { setCfEdit(false); setCfErr(""); }}>
                            Cancel
                          </Btn>
                        </div>
                        {cfErr && <div style={{ fontSize: 11, color: t.red, marginTop: 6 }}>{cfErr}</div>}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 12 }}>
                  Comments ({tk.comments.length})
                </div>
                {tk.comments.length === 0 && (
                  <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic", marginBottom: 16 }}>No comments yet.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: applicableTemplates.length > 0 ? 16 : 0 }}>
                  {tk.comments.map((c) => {
                    const author = users.find((u) => u.id === c.userId);
                    return (
                      <div key={c.id} style={{ display: "flex", gap: 9 }}>
                        <Avatar name={author?.name || "?"} size={26} fs={9} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{author?.name}</span>
                            <span style={{ fontSize: 10, color: t.text3 }}>{fmtTs(c.createdAt)}</span>
                          </div>
                          <div style={{ background: t.surface2, borderRadius: 9, padding: "8px 12px", fontSize: 13, color: t.text2, lineHeight: 1.55 }}>
                            {c.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Closing templates */}
                {applicableTemplates.length > 0 && (
                  <div style={{ paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
                    <Btn variant="secondary" size="md" full onClick={() => setShowCloseTemplate(!showCloseTemplate)} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, fontWeight: 600 }}>
                      💬 Apply Closing Template
                    </Btn>
                    {showCloseTemplate && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {applicableTemplates.map((tmpl) => (
                          <Btn
                            key={tmpl.id}
                            variant={selectedTemplate === tmpl.id ? "primary" : "secondary"}
                            size="sm"
                            full
                            onClick={() => applyTemplate(tmpl.id)}
                            style={{ justifyContent: "flex-start", borderRadius: 6, padding: "8px 10px", textAlign: "left" }}
                          >
                            <div style={{ textAlign: "left", width: "100%" }}>
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>{tmpl.name}</div>
                              <div style={{ fontSize: 10, opacity: 0.8 }}>{tmpl.description}</div>
                            </div>
                          </Btn>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "approvals" && (
              <div>
                {canManageApprovals && (
                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Add extra approver</div>
                        <select
                          value={nextApproverId}
                          onChange={(e) => setNextApproverId(e.target.value)}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, fontSize: 12 }}
                        >
                          <option value="">Select user…</option>
                          {addableApprovers.map((user) => (
                            <option key={user.id} value={user.id}>{user.name} ({roleLabel(user)})</option>
                          ))}
                        </select>
                        {addApproverError && (
                          <div style={{ marginTop: 6, fontSize: 11, color: t.redText }}>{addApproverError}</div>
                        )}
                      </div>
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={!nextApproverId || addingApprover || !onAddApproval}
                        onClick={async () => {
                          if (!nextApproverId || !onAddApproval) return;
                          try {
                            setAddingApprover(true);
                            setAddApproverError("");
                            await onAddApproval(tk.id, {
                              approverMode: "user",
                              approverId: nextApproverId,
                              requestedFor: tk.requestedFor || tk.reporter,
                              dueAt: tk.dueDate || null,
                            });
                            setNextApproverId("");
                          } catch (err) {
                            setAddApproverError(err?.message || "Could not add approver.");
                          } finally {
                            setAddingApprover(false);
                          }
                        }}
                      >
                        {addingApprover ? "Adding..." : "Add approver"}
                      </Btn>
                    </div>
                  </Card>
                )}

                {ticketApprovals.length === 0 && (
                  <div style={{ color: t.text3 }}>No approvals for this ticket.</div>
                )}
                {ticketApprovals.map((appr) => {
                  const approver = users.find((u) => u.id === appr.approverId);
                  const teamApprovers = appr.approverMode === "team"
                    ? users.filter((u) => u.teamId === appr.approverTeamId)
                    : [];
                  const requester = users.find((u) => u.id === appr.requestedBy) || {};
                  const requestedFor = users.find((u) => u.id === appr.requestedFor) || {};
                  const canAct = appr.status === "Pending" && (
                    (appr.approverMode === "user" && currentUser?.id === appr.approverId) ||
                    (appr.approverMode === "team" && currentUser?.teamId === appr.approverTeamId) ||
                    (appr.approverMode === "role" && currentUserRoles.includes(appr.approverRole))
                  );
                  return (
                    <Card key={appr.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{appr.id} — {appr.status}</div>
                            {approver && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <Avatar name={approver.name} size={20} fs={8} />
                              <div style={{ fontSize: 12, color: t.text3 }}>{approver.name}</div>
                            </div>}
                          </div>
                          <div style={{ fontSize: 12, color: t.text3, marginTop: 6 }}>
                            Approver: {appr.approverMode === "team" ? `Team: ${appr.approverTeamId || '—'}` : (approver?.name || appr.approverRole)}
                          </div>
                          {appr.approverMode === "team" && teamApprovers.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 11, color: t.text3, marginBottom: 6, fontWeight: 700 }}>Eligible approvers</div>
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
                          <div style={{ fontSize: 12, color: t.text3, marginTop: 6 }}>Requested by: {requester.name || appr.requestedBy} — For: {requestedFor.name || appr.requestedFor}</div>
                          {appr.dueAt && <div style={{ fontSize: 12, color: t.text3, marginTop: 6 }}>Due: {new Date(appr.dueAt).toLocaleDateString()}</div>}
                          {appr.comments && <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: t.text2 }}>{appr.comments}</div>}
                          {/* inline action area for approvers */}
                          {canAct && appr.status === "Pending" && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 11, color: t.text3, marginBottom: 6 }}>Your note (optional)</div>
                              <Input multiline rows={3} value={approvalComments[appr.id] || ""} onChange={(e) => setApprovalComments((prev) => ({ ...prev, [appr.id]: e.target.value }))} placeholder="Add a note for the requester or audit log" />
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                          {canAct ? (
                            <div style={{ fontSize: 12, color: t.text3 }}>Pending your decision</div>
                          ) : (
                            <div style={{ fontSize: 12, color: t.text3 }}>Ticket status: {tk.status}</div>
                          )}
                          {canAct && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <Btn size="sm" variant="primary" disabled={approvalSaving[appr.id]} onClick={async () => {
                                try {
                                  setApprovalSaving((s) => ({ ...s, [appr.id]: true }));
                                  await onResolveApproval?.(appr.id, "Approved", approvalComments[appr.id] || "");
                                  setApprovalComments((p) => ({ ...p, [appr.id]: "" }));
                                } finally { setApprovalSaving((s) => ({ ...s, [appr.id]: false })); }
                              }}>{approvalSaving[appr.id] ? "…" : "Approve"}</Btn>
                              <Btn size="sm" variant="danger" disabled={approvalSaving[appr.id]} onClick={async () => {
                                try {
                                  setApprovalSaving((s) => ({ ...s, [appr.id]: true }));
                                  await onResolveApproval?.(appr.id, "Rejected", approvalComments[appr.id] || "");
                                  setApprovalComments((p) => ({ ...p, [appr.id]: "" }));
                                } finally { setApprovalSaving((s) => ({ ...s, [appr.id]: false })); }
                              }}>{approvalSaving[appr.id] ? "…" : "Reject"}</Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── RELATED tab ───────────────────────────────────────────────── */}
            {tab === "related" && (
              <div>
                {/* Parent incident */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <I name="link" size={11} /> Parent Incident
                  </div>
                  {parentTicket ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surface2, borderRadius: 8, padding: "9px 12px", border: `1px solid ${t.border}` }}>
                      <div
                        role="button" tabIndex={0}
                        onClick={() => onOpenTicket?.(parentTicket)}
                        onKeyDown={(e) => e.key === "Enter" && onOpenTicket?.(parentTicket)}
                        style={{ flex: 1, cursor: "pointer", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3, flexShrink: 0 }}>{parentTicket.id}</span>
                        <span style={{ fontSize: 12, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parentTicket.title}</span>
                      </div>
                      <StatusBadge status={parentTicket.status} />
                      <Btn variant="ghost" size="sm" onClick={() => update({ parentId: null })} title="Unlink parent" style={{ padding: "2px 4px", borderRadius: 4, flexShrink: 0 }}>
                        <I name="x" size={11} />
                      </Btn>
                    </div>
                  ) : showParentSearch ? (
                    <div>
                      <input
                        autoFocus value={parentQuery}
                        onChange={(e) => setParentQuery(e.target.value)}
                        placeholder="Search by ID or title…"
                        style={{ width: "100%", background: t.surface2, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: t.text, fontFamily: t.font, outline: "none", boxSizing: "border-box" }}
                      />
                      <SearchDropdown results={parentSearchResults} onSelect={async (r) => { await update({ parentId: r.id }); setShowParentSearch(false); setParentQuery(""); }} />
                      <Btn variant="ghost" size="sm" onClick={() => { setShowParentSearch(false); setParentQuery(""); }} style={{ marginTop: 6, fontSize: 11, padding: 0 }}>{"Cancel"}</Btn>
                    </div>
                  ) : (
                    <Btn variant="secondary" size="sm" onClick={() => setShowParentSearch(true)}>
                      <I name="link" size={11} /> Set parent incident
                    </Btn>
                  )}
                </div>

                {/* Child tickets */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <I name="ticket" size={11} /> Child Tickets {childTickets.length > 0 ? `(${childTickets.length})` : ""}
                  </div>
                  {childTickets.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      {childTickets.map((child) => (
                        <div key={child.id} style={{ display: "flex", alignItems: "center", gap: 8, background: t.surface2, borderRadius: 8, padding: "9px 12px", border: `1px solid ${t.border}` }}>
                          <div
                            role="button" tabIndex={0}
                            onClick={() => onOpenTicket?.(child)}
                            onKeyDown={(e) => e.key === "Enter" && onOpenTicket?.(child)}
                            style={{ flex: 1, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}
                          >
                            <span style={{ fontSize: 10, fontFamily: t.mono, color: t.text3, flexShrink: 0 }}>{child.id}</span>
                            <span style={{ fontSize: 12, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.title}</span>
                          </div>
                          <StatusBadge status={child.status} />
                          <Btn variant="ghost" size="sm" onClick={() => onPatch?.(child.id, { parentId: null })} title="Unlink child" style={{ padding: "2px 4px", borderRadius: 4, flexShrink: 0 }}>
                            <I name="x" size={11} />
                          </Btn>
                        </div>
                      ))}
                    </div>
                  )}
                  {showChildSearch ? (
                    <div>
                      <input
                        autoFocus value={childQuery}
                        onChange={(e) => setChildQuery(e.target.value)}
                        placeholder="Search by ID or title…"
                        style={{ width: "100%", background: t.surface2, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: t.text, fontFamily: t.font, outline: "none", boxSizing: "border-box" }}
                      />
                      <SearchDropdown results={childSearchResults} onSelect={async (r) => { await onPatch?.(r.id, { parentId: tk.id }); setShowChildSearch(false); setChildQuery(""); }} />
                      <Btn variant="ghost" size="sm" onClick={() => { setShowChildSearch(false); setChildQuery(""); }} style={{ marginTop: 6, fontSize: 11, padding: 0 }}>{"Cancel"}</Btn>
                    </div>
                  ) : (
                    <Btn variant="secondary" size="sm" onClick={() => setShowChildSearch(true)}>
                      <I name="plus" size={11} /> Link child ticket
                    </Btn>
                  )}
                </div>
              </div>
            )}

            {/* ── PIR tab (Closed Incidents only) ───────────────────────────── */}
            {tab === "pir" && showPIR && !canFeature(plan, "pir") && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 260, gap: 14, textAlign: "center", padding: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#9f7aea22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <I name="lock" size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>Post-Incident Reviews require Pro</div>
                  <div style={{ fontSize: 12, color: t.text3, lineHeight: 1.6 }}>Upgrade to the Pro plan to document root causes and corrective actions.</div>
                </div>
                <Btn variant="primary" size="sm" onClick={onUpgrade}>
                  <I name="zap" size={12} /> Upgrade to Pro
                </Btn>
              </div>
            )}
            {tab === "pir" && showPIR && canFeature(plan, "pir") && (
              <div>
                <p style={{ fontSize: 12, color: t.text2, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                  Document what happened, the root cause, and corrective actions for this incident.
                </p>
                <div style={{ display: "grid", gap: 10 }}>
                  {(!pirFieldConfig || pirFieldConfig.fields.length === 0) ? (
                    <>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Summary</div>
                        <textarea value={reviewForm.summary} onChange={(e) => setReviewForm((prev) => ({ ...prev, summary: e.target.value }))}
                          placeholder="What happened and who was affected?" rows={3}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical", boxSizing: "border-box", fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Root Cause</div>
                        <textarea value={reviewForm.rootCause} onChange={(e) => setReviewForm((prev) => ({ ...prev, rootCause: e.target.value }))}
                          placeholder="Underlying cause of the incident" rows={2}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical", boxSizing: "border-box", fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Timeline</div>
                        <textarea value={reviewForm.timeline} onChange={(e) => setReviewForm((prev) => ({ ...prev, timeline: e.target.value }))}
                          placeholder="Key events and timestamps" rows={2}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical", boxSizing: "border-box", fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Action Items</div>
                        <textarea value={reviewForm.actionItems} onChange={(e) => setReviewForm((prev) => ({ ...prev, actionItems: e.target.value }))}
                          placeholder="One action per line" rows={3}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical", boxSizing: "border-box", fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Owner</div>
                        <select value={reviewForm.owner} onChange={(e) => setReviewForm((prev) => ({ ...prev, owner: e.target.value }))}
                          style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, fontSize: 13 }}>
                          <option value="">Select owner</option>
                          {agents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    pirFieldConfig.fields.map((field) => {
                      const value = reviewForm[field.name] || "";
                      const required = field.required ? " *" : "";
                      if (field.type === "text" || field.type === "list") {
                        return (
                          <div key={field.name}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>{field.label}{required}</div>
                            <textarea value={value} onChange={(e) => setReviewForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.type === "list" ? "One per line" : field.label}
                              rows={field.rows || (field.type === "list" ? 3 : 2)}
                              style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical", boxSizing: "border-box", fontSize: 13 }} />
                          </div>
                        );
                      }
                      if (field.type === "user") {
                        return (
                          <div key={field.name}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>{field.label}{required}</div>
                            <select value={value} onChange={(e) => setReviewForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                              style={{ width: "100%", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, fontSize: 13 }}>
                              <option value="">Select…</option>
                              {agents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </div>
                        );
                      }
                      return null;
                    })
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                    <Btn variant="primary" size="sm" onClick={saveReview} disabled={reviewSaving}>
                      {reviewSaving ? "Saving…" : "Save PIR"}
                    </Btn>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Comment input (Activity tab only) ──────────────────────────── */}
          {tab === "activity" && (
            <div style={{ padding: p(["12px 16px", "12px 22px"]), borderTop: `1px solid ${t.border}`, flexShrink: 0, background: t.surface }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Avatar name={currentUser.name} size={26} fs={9} />
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
                  placeholder="Add a comment…"
                  disabled={saving}
                  style={{ flex: 1, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: t.text, outline: "none", fontFamily: t.font }}
                />
                <Btn variant="primary" size="sm" onClick={postComment} disabled={!comment.trim() || saving}>
                  <I name="send" size={12} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── PIR tab banner — visible when Incident not yet Closed ──────── */}
          {tab === "pir" && !showPIR && (
            <div style={{ padding: p(["12px 16px", "14px 22px"]), flexShrink: 0 }}>
              <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 12, color: t.text2, textAlign: "center", lineHeight: 1.6 }}>
                Post-Incident Review is available once the incident status is set to <strong style={{ color: t.text }}>Closed</strong>.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
