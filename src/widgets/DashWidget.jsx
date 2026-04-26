// ─────────────────────────────────────────────────────────────────────────────
// WIDGET ROUTER: DashWidget
//
// This is the single place that maps a widget ID string to its React component.
// When you add a new widget:
//   1. Create its component file in src/widgets/
//   2. Import it here
//   3. Add a branch to the router below
// ─────────────────────────────────────────────────────────────────────────────

import { StatWidget }                          from "./StatWidget.jsx";
import { RecentTickets }                       from "./RecentTickets.jsx";
import { CriticalList, SLARisk, MyTickets, KBRecent } from "./ActivityWidgets.jsx";
import { ByStatusChart, ByPriorityChart, ByTypeChart } from "./BarChart.jsx";

/**
 * Renders the correct widget component for a given widget ID.
 *
 * @param {string}   id           - widget ID from the registry
 * @param {Array}    tickets      - full ticket array (unfiltered)
 * @param {Array}    articles     - knowledge base articles
 * @param {Array}    users        - all users
 * @param {Object}   currentUser  - the logged-in user
 * @param {Function} onOpenTicket - callback to open the detail panel
 */
export function DashWidget({ id, tickets, articles, users, currentUser, onOpenTicket }) {
  // ── Stat cards ──────────────────────────────────────────────────────────────
  if (id.startsWith("stat_")) {
    return <StatWidget id={id} tickets={tickets} currentUser={currentUser} />;
  }

  // ── Activity lists ───────────────────────────────────────────────────────────
  if (id === "recent")        return <RecentTickets tickets={tickets} users={users} onOpenTicket={onOpenTicket} />;
  if (id === "critical_list") return <CriticalList  tickets={tickets} onOpenTicket={onOpenTicket} />;
  if (id === "sla_risk")      return <SLARisk       tickets={tickets} onOpenTicket={onOpenTicket} />;
  if (id === "my_tickets")    return <MyTickets     tickets={tickets} currentUser={currentUser} onOpenTicket={onOpenTicket} />;

  // ── Charts ───────────────────────────────────────────────────────────────────
  if (id === "by_status")   return <ByStatusChart   tickets={tickets} />;
  if (id === "by_priority") return <ByPriorityChart tickets={tickets} />;
  if (id === "by_type")     return <ByTypeChart     tickets={tickets} />;

  // ── Knowledge Base ───────────────────────────────────────────────────────────
  if (id === "kb_recent") return <KBRecent articles={articles} users={users} />;

  // Unknown widget ID — fail silently so a misconfigured layout doesn't crash
  console.warn(`DashWidget: unknown widget id "${id}"`);
  return null;
}
