// ─────────────────────────────────────────────────────────────────────────────
// VIEW: TicketDetailPanel
// Slide-over panel on desktop; full-screen sheet on mobile.
// Allows inline status/priority/assignee editing and comment posting.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { PRIORITIES, STATUSES } from "../core/constants.js";
import { fmtTs } from "../core/utils.js";
import { Avatar, Btn, TypeBadge, SLABar } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

export function TicketDetailPanel({ ticket, users, currentUser, onClose, onPatch, onComment, priorityCatalog, urgencyLevels, review, onSaveReview, closingTemplates = [], pirFieldConfig = null }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const catalog = (priorityCatalog && Object.keys(priorityCatalog).length) ? priorityCatalog : PRIORITIES;
  const urgencyOptions = urgencyLevels?.length ? urgencyLevels : ["Critical", "High", "Medium", "Low"];
  const [tk, setTk] = useState(ticket);
  const [comment, setComment] = useState("");
  const [showCloseTemplate, setShowCloseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [reviewForm, setReviewForm] = useState({
    summary: review?.summary || "",
    rootCause: review?.rootCause || "",
    timeline: review?.timeline || "",
    actionItems: (review?.actionItems || []).join("\n"),
    owner: review?.owner || "",
    ...((review?.customData || {})),
  });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Get templates applicable to this ticket type
  const applicableTemplates = closingTemplates.filter((tmpl) =>
    tmpl.applyToTypes.includes(tk.type)
  );

  const roleLabel = (user) => {
    const roles = Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.role].filter(Boolean);
    return roles.join(", ") || "Member";
  };

  useEffect(() => {
    setTk(ticket);
  }, [ticket]);

  useEffect(() => {
    const customData = (review?.customData || {});
    setReviewForm({
      summary: review?.summary || "",
      rootCause: review?.rootCause || "",
      timeline: review?.timeline || "",
      actionItems: (review?.actionItems || []).join("\n"),
      owner: review?.owner || "",
      ...customData,
    });
  }, [review]);

  const applyTemplate = (templateId) => {
    const template = applicableTemplates.find((t) => t.id === templateId);
    if (!template) return;
    // Pre-fill resolution comment with template
    setComment(template.content);
    setSelectedTemplate(templateId);
    setShowCloseTemplate(false);
  };

  /** Merge field updates, persist to parent */
  const update = async (fields) => {
    if (saving) return;
    const previous = tk;
    const updated = { ...tk, ...fields };
    setTk(updated);

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
      if (created) {
        setTk((prev) => ({ ...prev, comments: [...prev.comments, created] }));
      }
      setComment("");
    } finally {
      setSaving(false);
    }
  };

  const saveReview = async () => {
    if (!onSaveReview || tk.type !== "Incident") return;
    setReviewSaving(true);
    try {
      // Separate standard fields from custom fields
      const standardFields = {
        id: review?.id,
        ticketId: tk.id,
        orgId: tk.orgId,
        teamId: tk.teamId,
        summary: reviewForm.summary,
        rootCause: reviewForm.rootCause,
        timeline: reviewForm.timeline,
        actionItems: reviewForm.actionItems.split("\n").map((row) => row.trim()).filter(Boolean),
        owner: reviewForm.owner,
      };

      // Extract custom fields (those not in the standard set)
      const customData = {};
      const fieldNames = ["summary", "rootCause", "timeline", "actionItems", "owner"];
      Object.keys(reviewForm).forEach((key) => {
        if (!fieldNames.includes(key)) {
          customData[key] = reviewForm[key];
        }
      });

      await onSaveReview({
        ...standardFields,
        customData,
      });
    } finally {
      setReviewSaving(false);
    }
  };

  const agents   = users.filter((u) => u.orgId === tk.orgId);
  const reporter = users.find((u) => u.id === tk.reporter);

  // ── Layout: full-screen on mobile, slide-over on desktop ──────────────────
  const overlay = isMobile
    ? { position: "fixed", inset: 0, background: t.surface, zIndex: 250, display: "flex", flexDirection: "column", overflowY: "auto", WebkitOverflowScrolling: "touch" }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" };

  const panel = isMobile
    ? { flex: 1, display: "flex", flexDirection: "column" }
    : { background: t.surface, width: "min(580px,100vw)", height: "100vh", display: "flex", flexDirection: "column", borderLeft: `1px solid ${t.border2}`, boxShadow: "-16px 0 64px rgba(0,0,0,0.4)" };

  const p = (v) => isMobile ? v[0] : v[1]; // responsive shorthand

  return (
    <div onClick={isMobile ? undefined : (e) => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={panel}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          borderLeft: `4px solid ${catalog[tk.priority]?.color || "#888"}`,
          padding: p(["14px 16px", "18px 22px"]),
          borderBottom: `1px solid ${t.border}`, flexShrink: 0, background: t.surface,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: t.mono, fontSize: 10, color: t.text3 }}>{tk.id}</span>
                <TypeBadge type={tk.type} />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: 0, lineHeight: 1.4 }}>{tk.title}</h2>
              {tk.tags && tk.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
                  {tk.tags.map((tg) => (
                    <span key={tg} style={{ fontSize: 10, color: t.text3, background: t.surface3, padding: "1px 6px", borderRadius: 99 }}>
                      #{tg}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 24, lineHeight: 1, padding: "0 0 0 12px", flexShrink: 0 }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Controls ───────────────────────────────────────────────────────── */}
          <div style={{ padding: p(["12px 16px", "14px 22px"]), borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {/* Status */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Status</div>
                <select
                  value={tk.status}
                  onChange={(e) => update({ status: e.target.value })}
                  disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}
                >
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {/* Priority */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Priority</div>
                <select
                  value={tk.priority}
                  onChange={(e) => update({ priority: e.target.value })}
                  disabled={saving}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}
                >
                  {Object.keys(catalog).map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Urgency</div>
              <select
                value={tk.urgency || urgencyOptions[0]}
                onChange={(e) => update({ urgency: e.target.value })}
                disabled={saving}
                style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}
              >
                {urgencyOptions.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            {/* Assignee */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 4 }}>Assign To</div>
              <select
                value={tk.assignee || ""}
                onChange={(e) => update({ assignee: e.target.value })}
                disabled={saving}
                style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: t.text, outline: "none", fontFamily: t.font, width: "100%" }}
              >
                <option value="">Unassigned</option>
                {agents.map((u) => <option key={u.id} value={u.id}>{u.name} ({roleLabel(u)})</option>)}
              </select>
            </div>
            {/* SLA */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 5 }}>
                SLA — {catalog[tk.priority]?.sla || 24}h target
              </div>
              <SLABar priority={tk.priority} createdAt={tk.createdAt} slaHours={catalog[tk.priority]?.sla} />
            </div>
            {/* Meta */}
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
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text3 }}>Created</div>
                <div style={{ fontSize: 11, color: t.text2, marginTop: 2 }}>{fmtTs(tk.createdAt)}</div>
              </div>
            </div>
          </div>

          {/* ── Activity log ───────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", padding: p(["12px 16px", "14px 22px"]), WebkitOverflowScrolling: "touch" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 12 }}>
              Activity ({tk.comments.length})
            </div>
            {tk.comments.length === 0 && (
              <div style={{ fontSize: 12, color: t.text3, fontStyle: "italic" }}>No comments yet.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

            {tk.type === "Incident" && (
              <div style={{ marginTop: 18, borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text3, marginBottom: 8 }}>
                  Post-Incident Review
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {/* Render fields based on config or defaults */}
                  {(!pirFieldConfig || pirFieldConfig.fields.length === 0) ? (
                    // Default fields
                    <>
                      <textarea
                        value={reviewForm.summary}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, summary: e.target.value }))}
                        placeholder="Incident summary"
                        rows={2}
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                      />
                      <textarea
                        value={reviewForm.rootCause}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, rootCause: e.target.value }))}
                        placeholder="Root cause"
                        rows={2}
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                      />
                      <textarea
                        value={reviewForm.timeline}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, timeline: e.target.value }))}
                        placeholder="Timeline"
                        rows={2}
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                      />
                      <textarea
                        value={reviewForm.actionItems}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, actionItems: e.target.value }))}
                        placeholder="Action items (one per line)"
                        rows={3}
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                      />
                      <select
                        value={reviewForm.owner}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, owner: e.target.value }))}
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font }}
                      >
                        <option value="">Select owner</option>
                        {agents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </>
                  ) : (
                    // Custom fields from config
                    pirFieldConfig.fields.map((field) => {
                      const value = reviewForm[field.name] || "";
                      const required = field.required ? "*" : "";
                      if (field.type === "text") {
                        return (
                          <textarea
                            key={field.name}
                            value={value}
                            onChange={(e) => setReviewForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                            placeholder={`${field.label}${required}`}
                            rows={field.rows || 2}
                            style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                          />
                        );
                      } else if (field.type === "user") {
                        return (
                          <select
                            key={field.name}
                            value={value}
                            onChange={(e) => setReviewForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                            style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font }}
                          >
                            <option value="">{field.label}{required}</option>
                            {agents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        );
                      } else if (field.type === "list") {
                        return (
                          <textarea
                            key={field.name}
                            value={value}
                            onChange={(e) => setReviewForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                            placeholder={`${field.label} (one per line)${required}`}
                            rows={3}
                            style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontFamily: t.font, resize: "vertical" }}
                          />
                        );
                      }
                      return null;
                    })
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Btn variant="secondary" size="sm" onClick={saveReview} disabled={reviewSaving}>{reviewSaving ? "Saving..." : "Save PIR"}</Btn>
                  </div>
                </div>
              </div>
            )}

            {/* Closing Template Selector */}
            {applicableTemplates.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={() => setShowCloseTemplate(!showCloseTemplate)}
                  style={{
                    width: "100%",
                    border: `1px solid ${t.border}`,
                    background: t.surface2,
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: t.text,
                    fontFamily: t.font,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  💬 Apply Closing Template
                </button>
                {showCloseTemplate && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {applicableTemplates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl.id)}
                        style={{
                          border: `1px solid ${t.border}`,
                          background: selectedTemplate === tmpl.id ? t.accentBg : t.surface3,
                          borderRadius: 6,
                          padding: "8px 10px",
                          color: selectedTemplate === tmpl.id ? t.accentText : t.text2,
                          fontFamily: t.font,
                          fontSize: 11,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{tmpl.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.8 }}>{tmpl.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Comment input ──────────────────────────────────────────────────── */}
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
        </div>
      </div>
    </div>
  );
}
