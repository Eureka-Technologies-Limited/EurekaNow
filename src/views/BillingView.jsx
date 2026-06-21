// ─────────────────────────────────────────────────────────────────────────────
// BILLING VIEW — Admin only
//
// Shows the current plan, plan cards to upgrade/downgrade, and a full invoice
// history pulled live from Stripe via Supabase Edge Functions.
//
// Access: Only org Admins can see this page. Non-admins get a locked screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { supabase } from "../core/supabase.js";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.replace(/\/$/, "");

const PLANS = {
  Free: {
    key: "Free",
    label: "Free",
    price: "£0",
    period: "forever",
    color: "#607d8b",
    features: ["Up to 5 agents", "Basic ticketing", "Email support", "1 team"],
    priceId: null,
  },
  Basic: {
    key: "Basic",
    label: "Basic",
    price: "£29",
    period: "/month",
    color: "#3182ce",
    features: ["Up to 25 agents", "Kanban & KB", "Priority support", "5 teams", "Reports & analytics"],
    priceId: "price_1TdZmTJzWbyeb81A8OaC9A9S",
  },
  Pro: {
    key: "Pro",
    label: "Pro",
    price: "£79",
    period: "/month",
    color: "#F57A55",
    features: ["Unlimited agents", "All features", "Dedicated support", "Unlimited teams", "Advanced analytics", "Custom roles"],
    priceId: "price_1TdZnYJzWbyeb81AHZuDaTqf",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role].filter(Boolean);
  return roles.some((r) => String(r).toLowerCase() === "admin");
}

function fmt(cents, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

async function callEdge(fnName, body, user) {
  // Prefer a Supabase Auth session (Google OAuth users).
  // Email/password users have no Supabase Auth session, so fall back to the
  // anon key + pass _userId in the body so the edge function can verify
  // identity against the users table instead.
  const { data: { session } } = await supabase.auth.getSession();
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const token   = session?.access_token || anonKey;

  if (!token) throw new Error("Not authenticated");

  const payload = session
    ? body
    : { ...body, _userId: user?.id }; // custom-auth path

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const t = useTokens();
  const map = {
    paid:     { bg: t.greenBg,  color: t.greenText,  label: "Paid"     },
    open:     { bg: t.yellowBg, color: t.yellowText, label: "Open"     },
    void:     { bg: t.grayBg,   color: t.grayText,   label: "Void"     },
    draft:    { bg: t.grayBg,   color: t.grayText,   label: "Draft"    },
    uncollectible: { bg: t.redBg, color: t.redText,  label: "Failed"   },
  };
  const s = map[status] || map.open;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
      background: s.bg, color: s.color, letterSpacing: "0.3px", textTransform: "uppercase",
    }}>
      {s.label}
    </span>
  );
}

function PlanCard({ plan, currentPlan, onSubscribe, loading }) {
  const t = useTokens();
  const isCurrent = currentPlan === plan.key;
  const isHigher = plan.key === "Pro" && currentPlan === "Basic";
  const isLower  = plan.key === "Basic" && currentPlan === "Pro";

  let btnLabel = "Upgrade";
  if (isCurrent)  btnLabel = "Current plan";
  else if (isHigher) btnLabel = "Upgrade to Pro";
  else if (isLower)  btnLabel = "Downgrade to Basic";
  else if (plan.key === "Free") btnLabel = "Downgrade to Free";

  return (
    <div style={{
      border: `2px solid ${isCurrent ? plan.color : t.border}`,
      borderRadius: 16,
      padding: "24px 22px",
      background: isCurrent ? (t.dark ? `${plan.color}11` : `${plan.color}08`) : t.surface,
      position: "relative",
      flex: 1,
      minWidth: 200,
    }}>
      {isCurrent && (
        <div style={{
          position: "absolute", top: -11, left: 20,
          background: plan.color, color: "#fff",
          fontSize: 10, fontWeight: 800, padding: "2px 10px", borderRadius: 99,
          letterSpacing: "0.5px", textTransform: "uppercase",
        }}>
          Current
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 4 }}>{plan.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: plan.color }}>{plan.price}</span>
        <span style={{ fontSize: 12, color: t.text3 }}>{plan.period}</span>
      </div>

      <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: t.text2 }}>
            <span style={{ color: plan.color, flexShrink: 0 }}><I name="check" size={13} /></span>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => !isCurrent && plan.key !== "Free" && onSubscribe(plan.priceId)}
        disabled={isCurrent || loading || plan.key === "Free"}
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: isCurrent ? `1px solid ${plan.color}44` : "none",
          background: isCurrent ? "transparent" : plan.color,
          color: isCurrent ? plan.color : (plan.key === "Pro" ? "#0f0f0e" : "#fff"),
          fontFamily: "'Sora', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: isCurrent || loading || plan.key === "Free" ? "default" : "pointer",
          opacity: (loading || plan.key === "Free") && !isCurrent ? 0.5 : 1,
          transition: "opacity .15s",
        }}
      >
        {loading ? "Loading…" : btnLabel}
      </button>
    </div>
  );
}

function InvoiceRow({ inv }) {
  const t = useTokens();
  return (
    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
      <td style={{ padding: "12px 14px", fontSize: 12, color: t.text2, fontFamily: "monospace" }}>
        {inv.number || inv.id?.slice(-8).toUpperCase()}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: t.text2 }}>
        {fmtDate(inv.created)}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: t.text2 }}>
        {inv.period_end ? fmtDate(inv.period_end) : "—"}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: t.text }}>
        {fmt(inv.amount_paid || inv.amount_due, inv.currency)}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <StatusBadge status={inv.status} />
      </td>
      <td style={{ padding: "12px 14px" }}>
        {inv.invoice_pdf ? (
          <a
            href={inv.invoice_pdf}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.accent, fontSize: 11, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            <I name="download" size={12} /> PDF
          </a>
        ) : (
          <span style={{ color: t.text3, fontSize: 11 }}>—</span>
        )}
      </td>
    </tr>
  );
}

function AccessDenied() {
  const t = useTokens();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 64, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: t.redBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: t.red }}>
        <I name="lock" size={28} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 8 }}>Admin Access Required</div>
      <div style={{ fontSize: 13, color: t.text3, maxWidth: 360, lineHeight: 1.6 }}>
        Billing information is only accessible to organization Admins. Contact your Admin if you need to make changes to the subscription.
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function BillingView({ currentUser, currentOrg, plan = "Free" }) {
  const t = useTokens();

  const [billingData, setBillingData] = useState(null);
  const [loadingData,  setLoadingData]  = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Detect return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      setSuccess("🎉 Subscription activated! Your plan will update shortly.");
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const loadBillingData = useCallback(async () => {
    if (!currentOrg?.id || !SUPABASE_URL) { setLoadingData(false); return; }
    setLoadingData(true);
    setError("");
    try {
      const data = await callEdge("get-billing-data", { orgId: currentOrg.id }, currentUser);
      setBillingData(data);
    } catch (err) {
      // If org has no Stripe customer yet, that's fine — show empty state
      if (!err.message?.includes("No Stripe customer")) {
        setError(err.message || "Failed to load billing data.");
      }
    } finally {
      setLoadingData(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => { loadBillingData(); }, [loadBillingData]);

  // Admin gate
  if (!isAdmin(currentUser)) return <AccessDenied />;

  const handleSubscribe = async (priceId) => {
    if (!priceId || !currentOrg?.id) return;
    setActionLoading(true);
    setError("");
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?billing=success`;
      const { url } = await callEdge("create-checkout-session", {
        orgId: currentOrg.id,
        priceId,
        returnUrl,
      }, currentUser);
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Failed to start checkout.");
      setActionLoading(false);
    }
  };

  const handleManage = async () => {
    if (!currentOrg?.id) return;
    setActionLoading(true);
    setError("");
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const { url } = await callEdge("create-billing-portal-session", {
        orgId: currentOrg.id,
        returnUrl,
      }, currentUser);
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Failed to open billing portal.");
      setActionLoading(false);
    }
  };

  const sub      = billingData?.subscription;
  const invoices = billingData?.invoices || [];
  const isPaid   = plan !== "Free";

  // Subscription status helpers
  const subStatus    = sub?.status;
  const cancelAtEnd  = sub?.cancel_at_period_end;
  const periodEnd    = sub?.current_period_end ? fmtDate(sub.current_period_end) : null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: t.text }}>Plans &amp; Billing</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: t.text3 }}>
            Manage your EurekaNow subscription and view invoices.
          </p>
        </div>

        {isPaid && (
          <button
            onClick={handleManage}
            disabled={actionLoading}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 10,
              background: t.surface2, border: `1px solid ${t.border}`,
              color: t.text, fontFamily: t.font, fontSize: 12, fontWeight: 700,
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.6 : 1,
            }}
          >
            <I name="settings" size={13} />
            {actionLoading ? "Loading…" : "Manage Billing"}
          </button>
        )}
      </div>

      {/* Success / Error banners */}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: t.greenBg, border: `1px solid ${t.green}44`, color: t.greenText, fontSize: 13, fontWeight: 600 }}>
          <I name="check" size={16} />
          {success}
        </div>
      )}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: t.redBg, border: `1px solid ${t.red}44`, color: t.redText, fontSize: 13 }}>
          <I name="incident" size={16} />
          {error}
        </div>
      )}

      {/* Current subscription status */}
      {isPaid && sub && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "20px 22px", display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: t.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.text }}>{plan}</div>
          </div>
          {periodEnd && (
            <div>
              <div style={{ fontSize: 11, color: t.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                {cancelAtEnd ? "Cancels On" : "Renews On"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: cancelAtEnd ? t.redText : t.text }}>{periodEnd}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: t.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Status</div>
            <StatusBadge status={cancelAtEnd ? "open" : subStatus || "paid"} />
          </div>
          {cancelAtEnd && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: t.yellowBg, border: `1px solid ${t.yellow}44`, color: t.yellowText, fontSize: 12, fontWeight: 600 }}>
              <I name="incident" size={13} />
              Subscription cancels at end of period. Reactivate via Manage Billing.
            </div>
          )}
        </div>
      )}

      {/* Plan cards */}
      <section>
        <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Choose a Plan
        </h2>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.values(PLANS).map((p) => (
            <PlanCard
              key={p.key}
              plan={p}
              currentPlan={plan}
              onSubscribe={handleSubscribe}
              loading={actionLoading}
            />
          ))}
        </div>
        {plan !== "Free" && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: t.text3 }}>
            To change plans or cancel, click <strong style={{ color: t.text2 }}>Manage Billing</strong> above — you'll be taken to the Stripe customer portal.
          </p>
        )}
      </section>

      {/* Invoices */}
      <section>
        <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Invoice History
        </h2>

        {loadingData ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: t.text3, fontSize: 13 }}>
            Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
            padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ color: t.text3, marginBottom: 8 }}><I name="ticket" size={32} /></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>No invoices yet</div>
            <div style={{ fontSize: 12, color: t.text3 }}>
              {plan === "Free"
                ? "Upgrade to a paid plan to see invoices here."
                : "Your first invoice will appear here after your next billing cycle."}
            </div>
          </div>
        ) : (
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: t.font }}>
              <thead>
                <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                  {["Invoice #", "Date", "Period End", "Amount", "Status", "Download"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.text3, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Organisation info */}
      {currentOrg && (
        <section style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "18px 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Billing Organisation</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: t.text3, marginBottom: 3 }}>Name</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{currentOrg.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: t.text3, marginBottom: 3 }}>Plan</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{plan}</div>
            </div>
            {billingData?.subscription?.id && (
              <div>
                <div style={{ fontSize: 11, color: t.text3, marginBottom: 3 }}>Subscription ID</div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: t.text2 }}>{billingData.subscription.id}</div>
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
}
