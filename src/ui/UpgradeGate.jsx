// ─────────────────────────────────────────────────────────────────────────────
// UpgradeGate — blocks access to features above the current plan
// PlansModal  — side-by-side plan comparison with upgrade CTA
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Btn, Modal } from "./primitives.jsx";
import { PLANS, PLAN_ORDER, normalizePlan, meetsMinPlan } from "../core/subscriptions.js";

// ── PlansModal ────────────────────────────────────────────────────────────────

export function PlansModal({ currentPlan, onClose, onSelectPlan }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const normalized = normalizePlan(currentPlan);

  return (
    <Modal title="Plans & Pricing" onClose={onClose} width={isMobile ? 360 : 740}>
      <p style={{ fontSize: 13, color: t.text3, marginTop: 0, marginBottom: 20 }}>
        Your current plan: <strong style={{ color: t.text }}>{normalized}</strong>. Upgrade to unlock more features.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === normalized;
          const isUpgrade = PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(normalized);

          return (
            <div
              key={key}
              style={{
                border: `2px solid ${isCurrent ? plan.color : t.border}`,
                borderRadius: 14,
                padding: "18px 16px",
                background: isCurrent ? plan.bgColor : t.surface2,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "relative",
              }}
            >
              {isCurrent && (
                <div style={{
                  position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                  background: plan.color, color: "#fff", fontSize: 10, fontWeight: 700,
                  padding: "2px 10px", borderRadius: 99, whiteSpace: "nowrap",
                }}>
                  Current plan
                </div>
              )}

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: plan.bgColor, display: "flex", alignItems: "center", justifyContent: "center", color: plan.color }}>
                    <I name={key === "Free" ? "user" : key === "Basic" ? "teams" : "star"} size={14} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: plan.color }}>{plan.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{plan.price}</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{plan.tagline}</div>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {plan.highlights.map((h, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: t.text2 }}>
                    <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}><I name="check" size={12} /></span>
                    {h}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div style={{ fontSize: 12, color: plan.color, fontWeight: 600, textAlign: "center", padding: "8px 0" }}>
                  Active plan
                </div>
              ) : isUpgrade ? (
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectPlan?.(key)}
                  style={{ background: plan.color, borderColor: plan.color }}
                >
                  <I name="zap" size={12} /> Upgrade to {plan.label}
                </Btn>
              ) : (
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => onSelectPlan?.(key)}
                >
                  Downgrade to {plan.label}
                </Btn>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, padding: "12px 14px", background: t.surface3, borderRadius: 10, fontSize: 12, color: t.text3, lineHeight: 1.6 }}>
        Contact support for enterprise pricing and custom contracts.
      </div>
    </Modal>
  );
}

// ── UpgradeGate ───────────────────────────────────────────────────────────────

/**
 * Wraps content that requires a higher plan.
 *
 * fullPage=true  → renders a centred upgrade prompt (pass no children)
 * fullPage=false → blurs children and overlays a lock card
 */
export function UpgradeGate({ plan, requiredPlan = "Basic", featureName, children, fullPage = false, onUpgrade }) {
  const t = useTokens();
  const [showPlans, setShowPlans] = useState(false);

  const locked = !meetsMinPlan(plan, requiredPlan);

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade(requiredPlan);
    } else {
      setShowPlans(true);
    }
  };

  const plansClosed = () => setShowPlans(false);

  if (!locked) {
    return (
      <>
        {children ?? null}
        {showPlans && <PlansModal currentPlan={plan} onClose={plansClosed} onSelectPlan={plansClosed} />}
      </>
    );
  }

  const required = PLANS[requiredPlan] || PLANS.Basic;

  if (fullPage) {
    return (
      <>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", minHeight: 420,
          gap: 20, padding: 40, textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: required.bgColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <I name="lock" size={30} style={{ color: required.color }} />
          </div>

          <div style={{ maxWidth: 380 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 10 }}>
              {featureName || requiredPlan + " plan feature"}
            </div>
            <div style={{ fontSize: 14, color: t.text3, lineHeight: 1.7 }}>
              This feature is included in the{" "}
              <strong style={{ color: required.color }}>{requiredPlan}</strong> plan ({required.price}).
              {" "}You're on the <strong style={{ color: t.text }}>{normalizePlan(plan)}</strong> plan.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Btn variant="primary" size="md" onClick={handleUpgrade}>
              <I name="zap" size={13} /> Upgrade to {requiredPlan}
            </Btn>
            <Btn variant="secondary" size="md" onClick={() => setShowPlans(true)}>
              View all plans
            </Btn>
          </div>

          <div style={{ fontSize: 12, color: t.text3 }}>
            {required.price} · {required.tagline}
          </div>
        </div>

        {showPlans && <PlansModal currentPlan={plan} onClose={plansClosed} onSelectPlan={plansClosed} />}
      </>
    );
  }

  // Inline gate — blur children, overlay lock
  return (
    <>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none", opacity: 0.55 }}>
          {children}
        </div>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8,
          background: t.bg + "cc",
          borderRadius: 10,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: required.bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="lock" size={18} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{requiredPlan} plan required</div>
          <Btn variant="primary" size="sm" onClick={handleUpgrade}>
            <I name="zap" size={11} /> Upgrade
          </Btn>
        </div>
      </div>

      {showPlans && <PlansModal currentPlan={plan} onClose={plansClosed} onSelectPlan={plansClosed} />}
    </>
  );
}

// ── PlanBadge ─────────────────────────────────────────────────────────────────
// Small inline badge showing the current plan

export function PlanBadge({ plan, onClick }) {
  const normalized = normalizePlan(plan);
  const cfg = PLANS[normalized] || PLANS.Free;

  return (
    <button
      onClick={onClick}
      title={`${cfg.price} · ${cfg.tagline}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 99,
        background: cfg.bgColor,
        border: `1px solid ${cfg.color}44`,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <I name={normalized === "Pro" ? "star" : normalized === "Basic" ? "zap" : "user"} size={10} style={{ color: cfg.color }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{normalized}</span>
    </button>
  );
}
