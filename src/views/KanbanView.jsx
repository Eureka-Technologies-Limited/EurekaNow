import { useState } from "react";
import { useTokens } from "../core/hooks.js";
import { PRIORITIES, STATUSES, TICKET_TYPES } from "../core/constants.js";
import { Avatar, PriorityBadge, StatusBadge, TypeBadge, SLABar, Btn } from "../ui/primitives.jsx";
import { I } from "../core/icons.jsx";
import { KanbanConfig } from "./KanbanConfig.jsx";
import { findPriorityCfg, slaForPriority } from "../core/utils.js";
import { ColorSwatch, SWATCH_COLORS } from "./KanbanConfig.jsx";

const STORAGE_KEY = (orgId, teamId) =>
  `kanban_${orgId || "global"}_${teamId || "global"}`;

const COLUMN_MAP_KEY = (orgId, teamId) =>
  `kanban_map_${orgId || "global"}_${teamId || "global"}`;

const DEFAULT_BOARD = {
  name: "Team Board",
  columns: [
    { id: "c_open",     name: "Open",        color: "#3182ce", statusMap: ["Open"],                   wipLimit: null },
    { id: "c_progress", name: "In Progress",  color: "#805ad5", statusMap: ["In Progress"],            wipLimit: null },
    { id: "c_pending",  name: "Pending",      color: "#d69e2e", statusMap: ["Pending"],                wipLimit: null },
    { id: "c_done",     name: "Done",         color: "#38a169", statusMap: ["Resolved", "Closed"],     wipLimit: null },
  ],
  autoAdd:    { types: [], priorities: [] },
  cardFields: ["priority", "type", "assignee", "sla"],
};

function loadBoard(orgId, teamId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(orgId, teamId));
    if (!raw) return structuredClone(DEFAULT_BOARD);
    return JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_BOARD);
  }
}

function persistBoard(orgId, teamId, board) {
  try {
    localStorage.setItem(STORAGE_KEY(orgId, teamId), JSON.stringify(board));
  } catch {}
}

function loadColumnMap(orgId, teamId) {
  try {
    const raw = localStorage.getItem(COLUMN_MAP_KEY(orgId, teamId));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistColumnMap(orgId, teamId, map) {
  try {
    localStorage.setItem(COLUMN_MAP_KEY(orgId, teamId), JSON.stringify(map));
  } catch {}
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({ ticket, users, catalog, cardFields, onOpenTicket, onDragStart, onDragEnd, isDragging, isChild, isParent, isCollapsed, onToggleChildren }) {
  const t = useTokens();
  const assignee = users.find((u) => u.id === ticket.assignee);
  const cfg = findPriorityCfg(catalog, ticket.priority);
  const slaHours = cfg && Number(cfg.sla) > 0 ? Number(cfg.sla) : slaForPriority(ticket.priority);
  const priorityColor = (cfg && cfg.color) || "#888";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderLeft: isChild ? `3px dashed ${priorityColor}` : `3px solid ${priorityColor}`,
        marginLeft: isChild ? 12 : 0,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.45 : 1,
        boxShadow: isDragging ? "none" : "0 1px 4px rgba(0,0,0,0.07)",
        transition: "opacity 0.15s, box-shadow 0.15s",
        userSelect: "none",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenTicket(ticket)}
        onKeyDown={(e) => e.key === "Enter" && onOpenTicket(ticket)}
        style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.45, marginBottom: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
      >
        {isParent && (
          <button onClick={(e) => { e.stopPropagation(); onToggleChildren?.(ticket.id); }}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: t.text3 }} aria-label={isCollapsed ? "Expand" : "Collapse"}>
            <I name={isCollapsed ? "chev-right" : "chev-down"} size={12} />
          </button>
        )}
        <div style={{ marginLeft: isParent ? 0 : (isChild ? 8 : 0) }}>{ticket.title}</div>
      </div>

      <div style={{ fontSize: 10, color: t.text3, fontFamily: t.mono, marginBottom: cardFields.length > 0 ? 8 : 0 }}>
        {ticket.id}
      </div>

      {(cardFields.includes("priority") || cardFields.includes("type") || cardFields.includes("status") || cardFields.includes("assignee")) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: cardFields.includes("sla") ? 8 : 0 }}>
          {cardFields.includes("priority") && <PriorityBadge priority={ticket.priority} />}
          {cardFields.includes("type")     && <TypeBadge     type={ticket.type} />}
          {cardFields.includes("status")   && <StatusBadge   status={ticket.status} />}
          {cardFields.includes("assignee") && assignee && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
              <Avatar name={assignee.name} size={18} fs={6} />
            </div>
          )}
        </div>
      )}

      {cardFields.includes("sla") && slaHours && (
        <SLABar priority={ticket.priority} createdAt={ticket.createdAt} slaHours={slaHours} />
      )}
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({ col, tickets, users, catalog, cardFields, isOver, onOpenTicket, onDragStart, onDragEnd, draggingId, onDragOver, onDragLeave, onDrop, onUpdateColumn }) {
  const t = useTokens();
  const atWip = col.wipLimit !== null && tickets.length >= col.wipLimit;
  const overWip = col.wipLimit !== null && tickets.length > col.wipLimit;
  const [collapsedParents, setCollapsedParents] = useState(() => new Set());

  // Build quick lookup and parent->children map for tickets in this column
  const ticketsById = Object.fromEntries(tickets.map((tk) => [tk.id, tk]));
  const childrenMap = {};
  tickets.forEach((tk) => {
    if (tk.parentId && ticketsById[tk.parentId]) {
      childrenMap[tk.parentId] = childrenMap[tk.parentId] || [];
      childrenMap[tk.parentId].push(tk);
    }
  });

  const roots = tickets.filter((tk) => !tk.parentId || !ticketsById[tk.parentId]);

  const toggleParent = (id) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: 270,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: isOver ? `${col.color}0d` : t.surface2,
        border: `1.5px solid ${isOver ? col.color + "88" : t.border}`,
        borderRadius: 12,
        maxHeight: "calc(100vh - 175px)",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {/* Column header */}
      <div style={{
        padding: "10px 12px 9px",
        borderBottom: `2px solid ${col.color}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <ColorSwatch value={col.color} onChange={(c) => onUpdateColumn?.(col.id, { color: c })} colors={SWATCH_COLORS} />
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{col.name}</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
          background: overWip ? "#fee2e2" : atWip ? "#fef9c3" : t.surface3,
          color: overWip ? "#dc2626" : atWip ? "#854d0e" : t.text3,
          border: `1px solid ${overWip ? "#fca5a5" : atWip ? "#fde047" : "transparent"}`,
        }}>
          {tickets.length}{col.wipLimit !== null ? `/${col.wipLimit}` : ""}
        </span>
      </div>

      {/* Cards (group parents & children) */}
      <div style={{ padding: "8px 8px 12px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {roots.map((root) => (
          <div key={root.id}>
            <KanbanCard
              ticket={root}
              users={users}
              catalog={catalog}
              cardFields={cardFields}
              onOpenTicket={onOpenTicket}
              isDragging={draggingId === root.id}
              isParent={Boolean(childrenMap[root.id] && childrenMap[root.id].length)}
              isCollapsed={collapsedParents.has(root.id)}
              onToggleChildren={toggleParent}
              onDragStart={(e) => { e.dataTransfer.setData("kanban_ticket", root.id); onDragStart(root.id); }}
              onDragEnd={onDragEnd}
            />

            {childrenMap[root.id] && !collapsedParents.has(root.id) && (
              childrenMap[root.id].map((child) => (
                <KanbanCard
                  key={child.id}
                  ticket={child}
                  users={users}
                  catalog={catalog}
                  cardFields={cardFields}
                  onOpenTicket={onOpenTicket}
                  isDragging={draggingId === child.id}
                  isChild={true}
                  onDragStart={(e) => { e.dataTransfer.setData("kanban_ticket", child.id); onDragStart(child.id); }}
                  onDragEnd={onDragEnd}
                />
              ))
            )}
          </div>
        ))}

        {tickets.length === 0 && (
          <div style={{
            border: `2px dashed ${isOver ? col.color + "66" : t.border}`,
            borderRadius: 8, padding: "20px 12px", textAlign: "center",
            color: t.text3, fontSize: 12, fontStyle: "italic",
            transition: "border-color 0.15s",
          }}>
            {isOver ? "Drop here" : "No tickets"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KanbanView ────────────────────────────────────────────────────────────────

export function KanbanView({ tickets, users, currentUser, priorityCatalog, onOpenTicket, onPatchTicket }) {
  const t = useTokens();
  const [board, setBoard] = useState(() => loadBoard(currentUser?.orgId, currentUser?.teamId));
  const [columnMap, setColumnMap] = useState(() => loadColumnMap(currentUser?.orgId, currentUser?.teamId));
  const [showConfig, setShowConfig] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [overColId, setOverColId]   = useState(null);

  const catalog = Object.keys(priorityCatalog || {}).length ? priorityCatalog : PRIORITIES;

  const updateBoard = (next) => {
    setBoard(next);
    persistBoard(currentUser?.orgId, currentUser?.teamId, next);
  };

  const updateColumn = (colId, patch) => {
    const next = structuredClone(board);
    next.columns = next.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c));
    updateBoard(next);
  };

  const updateColumnMap = (next) => {
    setColumnMap(next);
    persistColumnMap(currentUser?.orgId, currentUser?.teamId, next);
  };

  // Apply auto-add filters to decide which tickets appear on this board
  const boardTickets = tickets.filter((tk) => {
    const { types, priorities } = board.autoAdd;
    if (types.length > 0      && !types.includes(tk.type))         return false;
    if (priorities.length > 0 && !priorities.includes(tk.priority)) return false;
    return true;
  });

  const getColTickets = (col) => {
    // If no statuses mapped, use column-specific ticket map
    if (col.statusMap.length === 0) {
      const ticketIds = columnMap[col.id] || [];
      return ticketIds.map((id) => tickets.find((t) => t.id === id)).filter(Boolean);
    }
    // Otherwise filter by status
    return boardTickets.filter((tk) => col.statusMap.includes(tk.status));
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData("kanban_ticket");
    setOverColId(null);
    setDraggingId(null);
    if (!ticketId) return;

    const tk = tickets.find((t) => t.id === ticketId);
    const col = board.columns.find((c) => c.id === targetColId);
    if (!tk || !col) return;

    // If column has statuses mapped, update the ticket status
    if (col.statusMap.length > 0) {
      const newStatus = col.statusMap[0];
      if (tk.status !== newStatus) {
        await onPatchTicket(ticketId, { status: newStatus });

        // propagate status change to child tickets that belong to the same board
        const children = tickets.filter((t) => t.parentId === ticketId);
        if (children.length > 0) {
          await Promise.all(children.map((c) => onPatchTicket(c.id, { status: newStatus })));
        }
      }
      // Remove from blank column maps when moved to a status-mapped column
      const newMap = structuredClone(columnMap);
      Object.keys(newMap).forEach((colId) => {
        newMap[colId] = newMap[colId].filter((id) => id !== ticketId);
      });
      updateColumnMap(newMap);
    } else {
      // Blank column: add ticket to this column's map
      const newMap = structuredClone(columnMap);
      if (!newMap[targetColId]) newMap[targetColId] = [];
      if (!newMap[targetColId].includes(ticketId)) {
        newMap[targetColId].push(ticketId);
      }
      // Remove from other blank columns
      Object.keys(newMap).forEach((colId) => {
        if (colId !== targetColId) {
          newMap[colId] = newMap[colId].filter((id) => id !== ticketId);
        }
      });
      updateColumnMap(newMap);
    }
  };

  const totalOnBoard = board.columns.reduce((sum, col) => sum + getColTickets(col).length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexShrink: 0, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.4px", color: t.text }}>
            {board.name}
          </h1>
          <p style={{ fontSize: 12, color: t.text3, margin: "4px 0 0" }}>
            {totalOnBoard} tickets · {board.columns.length} columns
            {board.autoAdd.types.length > 0 && ` · ${board.autoAdd.types.join(", ")}`}
            {board.autoAdd.priorities.length > 0 && ` · ${board.autoAdd.priorities.join(", ")} only`}
          </p>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => setShowConfig(true)}>
          <I name="settings" size={12} /> Configure Board
        </Btn>
      </div>

      {/* Board */}
      <div style={{
        display: "flex", gap: 12, overflowX: "auto", flex: 1,
        paddingBottom: 16, alignItems: "flex-start",
      }}>
        {board.columns.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            tickets={getColTickets(col)}
            users={users}
            catalog={catalog}
            cardFields={board.cardFields}
            isOver={overColId === col.id}
            onOpenTicket={onOpenTicket}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(e) => { e.preventDefault(); setOverColId(col.id); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverColId(null);
            }}
            onDrop={(e) => handleDrop(e, col.id)}
            onUpdateColumn={updateColumn}
          />
        ))}

        {/* Add column shortcut */}
        <button
          onClick={() => setShowConfig(true)}
          style={{
            width: 200, flexShrink: 0, height: 80,
            background: "none", border: `2px dashed ${t.border}`,
            borderRadius: 12, cursor: "pointer", color: t.text3,
            fontSize: 12, fontFamily: t.font, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border;  e.currentTarget.style.color = t.text3; }}
        >
          <I name="plus" size={14} /> Add Column
        </button>
      </div>

      {showConfig && (
        <KanbanConfig
          board={board}
          statuses={STATUSES}
          ticketTypes={TICKET_TYPES}
          priorities={Object.keys(catalog)}
          onSave={(updated) => { updateBoard(updated); setShowConfig(false); }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
