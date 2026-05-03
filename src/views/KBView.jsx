// ─────────────────────────────────────────────────────────────────────────────
// VIEW: KBView
// Knowledge base article grid with search, category filter, and article reader.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { fmtTs } from "../core/utils.js";
import { Avatar, Badge, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

// ── KBView ────────────────────────────────────────────────────────────────────

export function KBView({ articles, users, currentUser, orgSettings = [], onCreateArticle, onUpdateArticle, onViewArticle }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  const [search,   setSearch]   = useState("");
  const [selCat,   setSelCat]   = useState("All");
  const [selFolder, setSelFolder] = useState("All");
  const [viewing,  setViewing]  = useState(null);
  const [addOpen,  setAddOpen]  = useState(false);
  const [editing,  setEditing]  = useState(null);

  const getOrgCategories = (settings, orgId) => {
    if (!settings) return [];
    if (Array.isArray(settings)) {
      const row = settings.find((r) => String(r?.orgId) === String(orgId));
      return Array.isArray(row?.categories) ? row.categories : [];
    }
    const row = settings[String(orgId)] || (settings?.orgId === orgId ? settings : null);
    return Array.isArray(row?.categories) ? row.categories : [];
  };

  useEffect(() => {
    if (!viewing) return;
    const latest = articles.find((a) => a.id === viewing.id);
    if (latest) setViewing(latest);
  }, [articles, viewing]);

  const cats     = ["All", ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))];
  const folders  = ["All", ...Array.from(new Set(articles.map((a) => a.folder || "General").filter(Boolean)))];
  const orgCategories = useMemo(() => {
    const fromSettings = getOrgCategories(orgSettings, currentUser?.orgId);
    const fromArticles = Array.from(new Set(articles.map((a) => a.category).filter(Boolean)));
    return Array.from(new Set([...(fromSettings || []), ...fromArticles]));
  }, [articles, currentUser?.orgId, orgSettings]);
  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    const folder = a.folder || "General";
    return (
      (!q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)) &&
      (selCat === "All" || a.category === selCat) &&
      (selFolder === "All" || folder === selFolder)
    );
  });

  const folderList = useMemo(() => Array.from(new Set(articles.map((a) => a.folder || "General"))).sort(), [articles]);

  // ── Article reader ──────────────────────────────────────────────────────────
  if (viewing) {
    const author = users.find((u) => u.id === viewing.author);
    const isOwner = currentUser?.id === viewing.author;
    const editors = Array.isArray(viewing.editors) ? viewing.editors : [];
    const isEditor = isOwner || editors.includes(currentUser?.id);
    const canEdit = isOwner || isEditor;
    return (
      <>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Btn variant="ghost" size="sm" onClick={() => setViewing(null)}>
              <I name="back" size={13} /> Back
            </Btn>
            <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, margin: 0, color: t.text, flex: 1, minWidth: 0 }}>
              {viewing.title}
            </h1>
            {canEdit && (
              <Btn variant="secondary" size="sm" onClick={() => setEditing(viewing)}>
                <I name="settings" size={12} /> Edit
              </Btn>
            )}
          </div>
          <Card style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Badge label={viewing.category} color={t.accentText} bg={t.accentBg} />
              <Badge label={viewing.folder || "General"} color={t.blueText} bg={t.blueBg} />
              {viewing.tags?.map((tg) => (
                <span key={tg} style={{ fontSize: 10, color: t.text3, background: t.surface2, padding: "1px 6px", borderRadius: 99 }}>#{tg}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
              {author && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar name={author.name} size={20} fs={7} />
                  <span style={{ fontSize: 12, color: t.text2 }}>{author.name}</span>
                </div>
              )}
              {editors.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: t.text3, textTransform: "uppercase", fontWeight: 700 }}>Editors:</span>
                  {editors.map((editorId) => {
                    const editor = users.find((u) => u.id === editorId);
                    return editor ? <Avatar key={editorId} name={editor.name} size={20} fs={7} /> : null;
                  })}
                </div>
              )}
              <span style={{ fontSize: 12, color: t.text3 }}>{fmtTs(viewing.createdAt)}</span>
              <span style={{ fontSize: 12, color: t.text3 }}>{viewing.views} views</span>
            </div>
            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.85, whiteSpace: "pre-line" }}>
              {viewing.content}
            </div>
          </Card>
          <RenderModals
            addOpen={addOpen}
            setAddOpen={setAddOpen}
            editing={editing}
            setEditing={setEditing}
            currentUser={currentUser}
            folders={folderList}
            categories={orgCategories}
            users={users}
            folderList={folderList}
            orgCategories={orgCategories}
            onCreateArticle={onCreateArticle}
            onUpdateArticle={onUpdateArticle}
            setViewing={setViewing}
          />
        </div>
      </>
    );
  }

  // ── Article grid ────────────────────────────────────────────────────────────
  return (
    <>
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, margin: 0, color: t.text }}>Knowledge Base</h1>
          <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <I name="plus" size={12} />
            {!isMobile && " New Article"}
          </Btn>
        </div>

        {/* Search + category filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.text3 }}>
              <I name="search" size={13} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              style={{
                width: "100%", background: t.surface2, border: `1px solid ${t.border}`,
                borderRadius: 9, padding: "10px 12px 10px 32px",
                fontSize: 14, color: t.text, outline: "none", fontFamily: t.font, boxSizing: "border-box",
              }}
            />
          </div>
          <select value={selFolder} onChange={(e) => setSelFolder(e.target.value)} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, color: t.text, outline: "none", fontFamily: t.font, minWidth: 120 }}>
            {folders.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select
            value={selCat}
            onChange={(e) => setSelCat(e.target.value)}
            style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, color: t.text, outline: "none", fontFamily: t.font, minWidth: 120 }}
          >
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Card grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
          {filtered.map((a) => {
            const author = users.find((u) => u.id === a.author);
            return (
              <Card
                key={a.id}
                onClick={() => {
                  setViewing({ ...a, views: (a.views || 0) + 1 });
                  onViewArticle?.(a);
                }}
                style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 9 }}
              >
                <Badge label={a.category} color={t.accentText} bg={t.accentBg} />
                <Badge label={a.folder || "General"} color={t.blueText} bg={t.blueBg} />
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: t.text2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.content.slice(0, 110)}…
                </div>
                {a.tags && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {a.tags.slice(0, 3).map((tg) => (
                      <span key={tg} style={{ fontSize: 9, color: t.text3, background: t.surface2, padding: "1px 6px", borderRadius: 99 }}>#{tg}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 11, color: t.text3 }}>
                  <span>{author?.name}</span>
                  <span>{a.views} views</span>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 48, color: t.text3, fontSize: 13 }}>No articles found.</div>
          )}
        </div>
      </div>
      <RenderModals
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        editing={editing}
        setEditing={setEditing}
        currentUser={currentUser}
        folders={folderList}
        categories={orgCategories}
        users={users}
        folderList={folderList}
        orgCategories={orgCategories}
        onCreateArticle={onCreateArticle}
        onUpdateArticle={onUpdateArticle}
        setViewing={setViewing}
      />
    </>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
// Render modals outside the viewing/grid conditional so they work from anywhere

function RenderModals({ addOpen, setAddOpen, editing, setEditing, currentUser, folders, categories, users, folderList, orgCategories, onCreateArticle, onUpdateArticle, setViewing }) {
  const t = useTokens();
  
  return (
    <>
      {addOpen && (
        <Modal title="New KB Article" onClose={() => setAddOpen(false)} width={520}>
          <AddArticleForm
            currentUser={currentUser}
            folders={folderList}
            categories={orgCategories}
            users={users}
            onSave={async (a) => {
              const saved = await onCreateArticle(a);
              setAddOpen(false);
              setViewing(saved);
            }}
            onCancel={() => setAddOpen(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit KB Article" onClose={() => setEditing(null)} width={520}>
          <ArticleForm
            currentUser={currentUser}
            folders={folderList}
            categories={orgCategories}
            users={users}
            initial={editing}
            onSave={async (a) => {
              const saved = await onUpdateArticle(editing.id, a);
              setEditing(null);
              setViewing(saved);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}

// ── AddArticleForm ────────────────────────────────────────────────────────────

function AddArticleForm({ currentUser, folders, categories, users = [], onSave, onCancel }) {
  return <ArticleForm currentUser={currentUser} folders={folders} categories={categories} users={users} onSave={onSave} onCancel={onCancel} />;
}

function ArticleForm({ currentUser, folders, categories = [], initial = null, onSave, onCancel, users = [] }) {
  const t = useTokens();
  const [f, setF] = useState({
    title: initial?.title || "",
    category: initial?.category || "IT Support",
    folder: initial?.folder || "General",
    content: initial?.content || "",
    tags: (initial?.tags || []).join(", "),
  });
  const [editors, setEditors] = useState(initial?.editors || []);
  const [catQuery, setCatQuery] = useState(initial?.category || "");
  const [catOpen, setCatOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const folderOptions = Array.from(new Set(["General", ...(folders || [])])).filter(Boolean);
  const categoryOptions = useMemo(() => {
    const defaults = ["IT Support", "Network", "Security", "Software", "Hardware", "Access Management", "Onboarding", "Process", "Other"];
    return Array.from(new Set([...(categories || []), ...defaults]));
  }, [categories]);

  // Get available collaborators (other users in the org, not including the owner)
  const availableCollaborators = useMemo(() => {
    const orgUsers = (users || []).filter((u) => u.orgId === currentUser?.orgId && u.id !== currentUser.id);
    if (!userQuery.trim()) return orgUsers.slice(0, 8);
    const term = userQuery.toLowerCase();
    return orgUsers.filter((u) => u.name.toLowerCase().includes(term)).slice(0, 8);
  }, [users, currentUser?.orgId, currentUser?.id, userQuery]);

  const addEditor = (userId) => {
    if (!editors.includes(userId)) {
      setEditors([...editors, userId]);
    }
    setUserQuery("");
    setUserOpen(false);
  };

  const removeEditor = (userId) => {
    setEditors(editors.filter((id) => id !== userId));
  };

  useEffect(() => {
    if (!folders?.length) return;
    if (!folderOptions.includes(f.folder)) set("folder", folderOptions[0] || "General");
  }, [folders, folderOptions, f.folder]);

  useEffect(() => {
    if (initial?.category) {
      setCatQuery(initial.category);
    }
  }, [initial?.category]);

  const publish = async () => {
    if (!f.title.trim() || !f.content.trim()) return;
    setSaving(true);
    setError("");
    const tags = f.tags ? f.tags.split(",").map((tg) => tg.trim().toLowerCase()).filter(Boolean) : [];

    try {
      await onSave({
        title: f.title.trim(),
        category: f.category,
        folder: f.folder,
        content: f.content.trim(),
        author: currentUser.id,
        orgId: currentUser.orgId,
        tags,
        editors,
      });
    } catch (err) {
      setError(err?.message || "Failed to publish article.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="How to…" autoFocus /></div>
      <div>
        <Label>Category</Label>
        <div style={{ position: "relative" }}>
          <Input
            value={catQuery || f.category}
            onChange={(e) => {
              const value = e.target.value;
              setCatQuery(value);
              set("category", value);
              setCatOpen(true);
            }}
            onFocus={() => setCatOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") setCatOpen(false); }}
            placeholder="Type or search categories…"
            aria-label="Category"
          />
          {catOpen && (
            <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50 }}>
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, marginTop: 6, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                {(() => {
                  const term = String(catQuery || f.category || "").trim().toLowerCase();
                  const shown = (term ? categoryOptions.filter((c) => c.toLowerCase().includes(term)) : categoryOptions).slice(0, 10);
                  return shown.length > 0 ? shown.map((c) => (
                    <Btn key={c} variant="ghost" full size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { set("category", c); setCatQuery(c); setCatOpen(false); }} style={{ justifyContent: "flex-start", borderBottom: `1px solid ${t.border}`, padding: "8px 10px", textAlign: "left", fontFamily: t.font }}>
                      {c}
                    </Btn>
                  )) : (
                    <div style={{ padding: 10, fontSize: 12, color: t.text3 }}>No matching categories. You can keep typing a new one.</div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      <div>
        <Label>Folder</Label>
        <Sel value={f.folder} onChange={(e) => set("folder", e.target.value)} style={{ width: "100%" }}>
          {folderOptions.map((folder) => <option key={folder}>{folder}</option>)}
        </Sel>
      </div>
      <div><Label>Content</Label><Input value={f.content} onChange={(e) => set("content", e.target.value)} placeholder="Write step-by-step instructions…" multiline rows={6} /></div>
      <div><Label>Tags (comma-separated)</Label><Input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="vpn, password, network" /></div>
      {initial && (
        <div>
          <Label>Collaborators (can edit)</Label>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setUserOpen(true);
              }}
              onFocus={() => setUserOpen(true)}
              onKeyDown={(e) => { if (e.key === "Escape") setUserOpen(false); }}
              placeholder="Search users in your organization…"
              aria-label="Add collaborators"
            />
            {userOpen && userQuery.trim() && (
              <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50 }}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, marginTop: 6, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto" }}>
                  {availableCollaborators.filter((u) => !editors.includes(u.id)).length > 0 ? (
                    availableCollaborators.filter((u) => !editors.includes(u.id)).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => addEditor(u.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{ width: "100%", padding: "10px 12px", background: "none", border: "none", borderBottom: `1px solid ${t.border}`, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: t.font, fontSize: 13, color: t.text, transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = t.surface2}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <Avatar name={u.name} size={20} fs={8} />
                        <span>{u.name}</span>
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: 10, fontSize: 12, color: t.text3 }}>No matching users or already added.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {editors.map((editorId) => {
              const editor = users.find((u) => u.id === editorId);
              return editor ? (
                <div
                  key={editorId}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 20,
                    background: t.surface2, border: `1px solid ${t.border}`, fontSize: 12,
                  }}
                >
                  <Avatar name={editor.name} size={16} fs={6} />
                  <span>{editor.name}</span>
                  <button
                    onClick={() => removeEditor(editorId)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, padding: 0, marginLeft: 4 }}
                    aria-label={`Remove ${editor.name}`}
                  >
                    ×
                  </button>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={!f.title.trim() || !f.content.trim() || saving}
          onClick={publish}
        >
          {saving ? (initial ? "Saving..." : "Publishing...") : (initial ? "Save Changes" : "Publish")}
        </Btn>
      </div>
    </div>
  );
}
