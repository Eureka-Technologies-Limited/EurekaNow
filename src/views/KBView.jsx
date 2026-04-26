// ─────────────────────────────────────────────────────────────────────────────
// VIEW: KBView
// Knowledge base article grid with search, category filter, and article reader.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { KB_CATEGORIES } from "../core/constants.js";
import { fmtTs } from "../core/utils.js";
import { Avatar, Badge, Btn, Card, Input, Label, Modal, Sel } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";

// ── KBView ────────────────────────────────────────────────────────────────────

export function KBView({ articles, users, currentUser, onCreateArticle, onViewArticle }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();

  const [search,   setSearch]   = useState("");
  const [selCat,   setSelCat]   = useState("All");
  const [viewing,  setViewing]  = useState(null);
  const [addOpen,  setAddOpen]  = useState(false);

  useEffect(() => {
    if (!viewing) return;
    const latest = articles.find((a) => a.id === viewing.id);
    if (latest) setViewing(latest);
  }, [articles, viewing]);

  const cats     = ["All", ...Array.from(new Set(articles.map((a) => a.category)))];
  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    return (
      (!q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)) &&
      (selCat === "All" || a.category === selCat)
    );
  });

  // ── Article reader ──────────────────────────────────────────────────────────
  if (viewing) {
    const author = users.find((u) => u.id === viewing.author);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Btn variant="ghost" size="sm" onClick={() => setViewing(null)}>
            <I name="back" size={13} /> Back
          </Btn>
          <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, margin: 0, color: t.text, flex: 1, minWidth: 0 }}>
            {viewing.title}
          </h1>
        </div>
        <Card style={{ maxWidth: 700 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Badge label={viewing.category} color={t.accentText} bg={t.accentBg} />
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
            <span style={{ fontSize: 12, color: t.text3 }}>{fmtTs(viewing.createdAt)}</span>
            <span style={{ fontSize: 12, color: t.text3 }}>{viewing.views} views</span>
          </div>
          <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.85, whiteSpace: "pre-line" }}>
            {viewing.content}
          </div>
        </Card>
      </div>
    );
  }

  // ── Article grid ────────────────────────────────────────────────────────────
  return (
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

      {/* Add article modal */}
      {addOpen && (
        <Modal title="New KB Article" onClose={() => setAddOpen(false)} width={520}>
          <AddArticleForm
            currentUser={currentUser}
            onSave={async (a) => {
              const saved = await onCreateArticle(a);
              setAddOpen(false);
              setViewing(saved);
            }}
            onCancel={() => setAddOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// ── AddArticleForm ────────────────────────────────────────────────────────────

function AddArticleForm({ currentUser, onSave, onCancel }) {
  const [f, setF] = useState({ title: "", category: "IT Support", content: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const publish = async () => {
    if (!f.title.trim() || !f.content.trim()) return;
    setSaving(true);
    setError("");
    const tags = f.tags ? f.tags.split(",").map((tg) => tg.trim().toLowerCase()).filter(Boolean) : [];

    try {
      await onSave({
        title: f.title.trim(),
        category: f.category,
        content: f.content.trim(),
        author: currentUser.id,
        orgId: currentUser.orgId,
        tags,
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
        <Sel value={f.category} onChange={(e) => set("category", e.target.value)} style={{ width: "100%" }}>
          {KB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Sel>
      </div>
      <div><Label>Content</Label><Input value={f.content} onChange={(e) => set("content", e.target.value)} placeholder="Write step-by-step instructions…" multiline rows={6} /></div>
      <div><Label>Tags (comma-separated)</Label><Input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="vpn, password, network" /></div>
      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={!f.title.trim() || !f.content.trim() || saving}
          onClick={publish}
        >
          {saving ? "Publishing..." : "Publish"}
        </Btn>
      </div>
    </div>
  );
}
