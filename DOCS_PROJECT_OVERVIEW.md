# EurekaNow — Project Overview

This document describes the architecture, data model, and how the major features work (permissions, service catalog, approvals).

## Project structure

- `src/` — React application (Create React App)
  - `core/` — API layer and helpers (`api.js`, `constants.js`, `utils.js`)
  - `layout/` — App shell and top-level routing (`AppShell.jsx`)
  - `views/` — Main page views (tickets, teams, ServiceNow-like catalog/approvals)
  - `ui/` — Primitive UI components (buttons, modals, inputs)
  - `supabase/` — SQL schema for Supabase

## Data model highlights

- `organizations`, `teams`, `users`, `tickets` — core entities.
- `service_catalog_items` — catalog items with approval configuration.
  - New fields: `approver_mode` (`role` | `user` | `team`) and `approver_team_id` for group/team approvals.
- `approvals` — approval objects created when requests require approval. Includes `approver_mode` and `approver_team_id`.
- `org_settings` — stores organisation-level settings including `role_permissions` (map of role → { permissionKey: true }) and `require_approvals`.

## Permissions system

- Org admins can configure `role_permissions` in Organisation Settings (Teams view → Permissions tab).
- `role_permissions` is a JSON map: `{ "Agent": { "tickets.create": true, "catalog.manage": true }, "End User": { "tickets.create": true } }`.
- UI components consult `org_settings.role_permissions` to decide whether to show action buttons (e.g., catalog Manage button) and whether a user can act on approvals (permission `approvals.resolve`). Admins and `Catalog Manager` still have fallbacks.

## Approvals

- Catalog items may require approval (`requires_approval`). Each item has an approver configuration:
  - `approverMode`: `role` (default), `user`, or `team`.
  - `approverRole` when using `role` mode.
  - `approverId` when using `user` mode (specific user).
  - `approverTeamId` when using `team` mode (group approval).
- When a request is submitted for an item that requires approval, the app creates a `ticket` and an `approval` row.
  - If `approverMode` is `team`, the approval is actionable by any member of the selected team and only a single approval is needed.
  - If `approverMode` is `role`, users with that role (or Admin) can act on the approval.
  - If `approverMode` is `user`, only that user can act.

## Demo mode vs Supabase

- The app supports a demo mode (client-side seeded state) when Supabase is not configured.
- All new fields are supported in demo mode and persisted to `localStorage` while using demo credentials.
- To use Supabase in production, run the SQL in `supabase/schema.sql` and provide `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.

## How to extend permissions and approvals

- Add new permission keys (e.g. `kb.edit`) via Organisation Settings → Permissions tab.
- Map those permission keys to role names in `role_permissions`.
- Update UI components to consult `org_settings.role_permissions` for the new keys to gate features.

## Developer notes

- API helpers are in `src/core/api.js`. Key functions:
  - `fetchAppData()` — loads all data including `orgSettings` and `approvals`.
  - `upsertOrgSettings(payload)` — saves org settings (now supports `rolePermissions` and `requireApprovals`).
  - `updateCatalogItem(itemId, payload)` — supports `approverMode`/`approverTeamId` updates.
  - `createApproval(payload)` / `resolveApproval(id, payload)` — create/resolve approvals.
- UI files to inspect for approval/permission behavior:
  - `src/views/ServiceNowViews.jsx` — catalog and approvals views and modals.
  - `src/views/TeamsView.jsx` — Organisation Settings → Permissions tab (edit `rolePermissions`).

## Migration notes

- `supabase/schema.sql` includes migrations to add `approver_mode`, `approver_team_id`, `role_permissions`, and `require_approvals` fields. Run it in Supabase SQL editor to apply.

## Suggested next steps

- Enforce more granular checks across UI (already applied to catalog manage and approvals resolving; extend to editing catalog items and ticket actions).
- Add audit logs for permission and approval changes (activity_log exists; consider writing events there when approvals created/resolved or permissions changed).

-- End
