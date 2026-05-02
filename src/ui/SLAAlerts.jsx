import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Badge, Avatar } from "./primitives.jsx";
import { checkSLAStatus } from "../core/api.js";

export function SLAAlerts({ tickets, priorityCatalog, users }) {
  const t = useTokens();

  // Find breached and at-risk tickets
  const slaIssues = tickets
    .filter((tk) => !["Resolved", "Closed"].includes(tk.status))
    .map((tk) => {
      const slaHours = priorityCatalog?.[tk.priority]?.sla || 24;
      const status = checkSLAStatus(tk, slaHours);
      return { ticket: tk, slaStatus: status, severity: status.isBreached ? "breached" : "risk" };
    })
    .filter(({ slaStatus }) => slaStatus.isBreached || slaStatus.isRisk)
    .sort((a, b) => {
      // Sort by severity (breached first) then by hoursRemaining
      if (a.slaStatus.isBreached !== b.slaStatus.isBreached) {
        return a.slaStatus.isBreached ? -1 : 1;
      }
      return a.slaStatus.hoursRemaining - b.slaStatus.hoursRemaining;
    })
    .slice(0, 5); // Show top 5

  if (slaIssues.length === 0) {
    return (
      <div style={{
        padding: 16,
        background: t.surfaceGreen,
        borderRadius: 9,
        border: `1px solid ${t.greenText}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <I name="check" size={18} style={{ color: t.greenText, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: t.greenText, fontWeight: 600 }}>
          All SLAs on track
        </span>
      </div>
    );
  }

  const breachedCount = slaIssues.filter((x) => x.slaStatus.isBreached).length;
  const atRiskCount = slaIssues.filter((x) => !x.slaStatus.isBreached).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: 12,
        background: breachedCount > 0 ? t.redBg : t.yellowBg,
        borderRadius: 9,
        border: `1px solid ${breachedCount > 0 ? t.red : "#d69e2e"}`,
      }}>
        <I name={breachedCount > 0 ? "alert" : "warning"} size={16} style={{ color: breachedCount > 0 ? t.red : "#d69e2e", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: breachedCount > 0 ? t.redText : "#b7791f" }}>
            {breachedCount > 0 ? `${breachedCount} SLA Breach${breachedCount > 1 ? "es" : ""}` : `${atRiskCount} At Risk`}
          </div>
          <div style={{ fontSize: 10, color: breachedCount > 0 ? t.redText : "#b7791f", opacity: 0.8 }}>
            Requires immediate attention
          </div>
        </div>
      </div>

      {/* Issue list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slaIssues.map(({ ticket, slaStatus, severity }) => {
          const assignee = users.find((u) => u.id === ticket.assignee);
          return (
            <div key={ticket.id} style={{
              padding: 12,
              background: t.surface,
              border: `1px solid ${severity === "breached" ? t.red : t.border}`,
              borderLeft: `3px solid ${severity === "breached" ? t.red : "#d69e2e"}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: severity === "breached" ? `${t.red}22` : `#d69e2e22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <I name={severity === "breached" ? "alert" : "clock"} size={14} style={{ color: severity === "breached" ? t.red : "#d69e2e" }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                  {ticket.id}
                </div>
                <div style={{
                  fontSize: 11,
                  color: severity === "breached" ? t.red : "#d69e2e",
                  fontWeight: 600,
                }}>
                  {severity === "breached"
                    ? `BREACHED by ${slaStatus.elapsedHours - (priorityCatalog?.[ticket.priority]?.sla || 24)} hours`
                    : `${slaStatus.hoursRemaining}h remaining`}
                </div>
              </div>

              {assignee && (
                <div style={{ flexShrink: 0 }}>
                  <Avatar name={assignee.name} size={24} fs={8} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// test