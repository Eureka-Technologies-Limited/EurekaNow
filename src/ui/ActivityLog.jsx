import { useTokens } from "../core/hooks.js";
import { I } from "../core/icons.jsx";
import { Avatar, Badge } from "./primitives.jsx";

export function ActivityLog({ activities, users }) {
  const t = useTokens();

  const actionLabels = {
    created:   "created",
    updated:   "updated",
    assigned:  "assigned",
    commented: "commented on",
  };

  const getActionColor = (action) => {
    if (action === "created")   return t.greenText;
    if (action === "updated")   return t.yellowText;
    if (action === "assigned")  return t.blueText;
    if (action === "commented") return t.purpleText;
    return t.text2;
  };

  if (!activities || activities.length === 0) {
    return (
      <div style={{ fontSize: 12, color: t.text3, padding: "16px 0" }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {activities.map((log, i) => {
        const user = users.find((u) => u.id === log.userId);
        const ts = new Date(log.createdAt).toLocaleString();

        return (
          <div key={log.id} style={{
            display: "flex",
            gap: 12,
            paddingBottom: i < activities.length - 1 ? 12 : 0,
            borderBottom: i < activities.length - 1 ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{ flexShrink: 0 }}>
              {user ? (
                <Avatar name={user.name} size={32} fs={10} />
              ) : (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: t.surface2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <I name="user" size={16} />
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                  {user?.name || "Unknown"}
                </span>
                <span style={{ fontSize: 11, color: getActionColor(log.action), fontWeight: 600 }}>
                  {actionLabels[log.action] || log.action}
                </span>
                {log.field && (
                  <>
                    <span style={{ fontSize: 11, color: t.text2 }}>
                      {log.field}
                    </span>
                    {log.oldValue && log.newValue && (
                      <span style={{ fontSize: 10, color: t.text3 }}>
                        from <strong>{log.oldValue}</strong> to <strong>{log.newValue}</strong>
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={{ fontSize: 10, color: t.text3, fontFamily: t.mono }}>
                {ts}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
