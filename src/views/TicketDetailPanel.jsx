// ─────────────────────────────────────────────────────────────────────────────
// VIEW: TicketDetailPanel
// Slide-over panel on desktop; full-screen sheet on mobile.
// Tabs: Activity | Related | PIR (Incident + Closed only)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, STATUSES } from "../core/constants.js";
import { fmtTs, slaForPriority, findPriorityCfg } from "../core/utils.js";
import { Avatar, Btn, Card, Input, TypeBadge, SLABar, StatusBadge } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { canFeature } from "../core/subscriptions.js";

export function TicketDetailPanel({ ticket, users, currentUser, onClose, onPatch, onComment, priorityCatalog, urgencyLevels, review, onSaveReview, closingTemplates = [], pirFieldConfig = null, allTickets = [], onOpenTicket, plan = "Free", onUpgrade, approvals = [], onResolveApproval, onAddApproval }) {
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
  const [approvalComments, setApprovalComments] = useState({});
  const [approvalSaving, setApprovalSaving] = useState({});
  const [nextApproverId, setNextApproverId] = useState("");
  const [addingApprover, setAddingApprover] = useState(false);
  const [addApproverError, setAddApproverError] = useState("");

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

  const update = async (fields) => {
    if (saving) return;
    const previous = tk;
    setTk({ ...tk, ...fields });
    if (!onPatch) return;
    setSaving(true);
    try {
      const saved = await onPatch(tk.id, fields);
      if (saved) setTk(saved);

      // If status changed on a parent ticket, propagate to its children
      if (fields.status) {
        const newStatus = fields.status;
        const children = allTickets.filter((t) => t.parentId === tk.id);
        if (children.length > 0) {
          await Promise.all(children.map((c) => onPatch?.(c.id, { status: newStatus })));
        }
      }
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
  const ticketApprovals = (approvals || []).filter((a) => a.ticketId === tk.id);
  const pendingApproverIds = new Set(
    ticketApprovals
      .filter((a) => a.status === "Pending" && a.approverId)
      .map((a) => a.approverId)
  );
  const addableApprovers = agents.filter((u) => !pendingApproverIds.has(u.id));
  const canManageApprovals = Boolean(
    currentUser?.id === tk.reporter ||
    currentUser?.id === tk.assignee ||
    currentUserRoles.includes("Admin") ||
    currentUserRoles.includes("Manager") ||
    currentUserRoles.includes("Team Lead")
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
    { id: "related",  label: "Related",      badge: relatedCount || null },
    ...(showPIR ? [{ id: "pir", label: "Post-Incident Review" }] : []),
    // Show approvals tab for request tickets and approval-based requests
    ...((tk.type === "Service Request" || tk.type === "Change Request" || tk.status === "Awaiting Approval" || (approvals || []).length > 0 || tk.catalogItemId) ? [{ id: "approvals", label: "Approvals", badge: ticketApprovals.length || null }] : []),
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
                <span style={{ fontFamily: t.mono, fontSize: 10, color: t.text3 }}>{tk.id}</span>
                <TypeBadge type={tk.type} />
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
                <select value={tk.status} onChange={(e) => update({ status: e.target.value })} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Priority</div>
                <select value={tk.priority} onChange={(e) => update({ priority: e.target.value })} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {Object.keys(catalog).map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Urgency</div>
                <select value={tk.urgency || urgencyOptions[0]} onChange={(e) => update({ urgency: e.target.value })} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
                  {urgencyOptions.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Assign To</div>
                <select value={tk.assignee || ""} onChange={(e) => update({ assignee: e.target.value })} disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}>
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
                  value={formatDateInput(tk.dueDate)}
                  onChange={(e) => update({ dueDate: e.target.value ? new Date(`${e.target.value}T23:59:59`).getTime() : null })}
                  style={{ padding: "7px 10px", fontSize: 12 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Estimate / Spent</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                  <Input
                    type="number"
                    value={tk.estimateHours ?? ""}
                    onChange={(e) => update({ estimateHours: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Estimate"
                    style={{ padding: "7px 10px", fontSize: 12 }}
                  />
                  <Input
                    type="number"
                    value={tk.spentHours ?? 0}
                    onChange={(e) => update({ spentHours: e.target.value === "" ? 0 : Number(e.target.value) })}
                    placeholder="Spent"
                    style={{ padding: "7px 10px", fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
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
                {tk.description && (
                  (() => {
                    // For service requests created from catalog items we often append a justification paragraph.
                    // When possible, split the description on blank lines and surface the last paragraph as a dedicated justification.
                    const isRequestLike = !!tk.catalogItemId || tk.type === "Service Request" || tk.type === "Service request";
                    if (isRequestLike) {
                      const parts = String(tk.description || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
                      if (parts.length > 1) {
                        const desc = parts.slice(0, parts.length - 1).join("\n\n");
                        const just = parts[parts.length - 1];
                        return (
                          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Description</div>
                            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{desc}</div>
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11, color: t.text3, marginBottom: 6, fontWeight: 700 }}>Reason / Business justification</div>
                              <div style={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>{just}</div>
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
                  })()
                )}

                {/* Show requestedFor / requested for user when present (catalog requests) */}
                {tk.requestedFor && tk.requestedFor !== tk.reporter && (
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 6 }}>Requested for</div>
                    <div style={{ fontSize: 13, color: t.text2 }}>{(users.find((u) => u.id === tk.requestedFor) || {}).name || tk.requestedFor}</div>
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
