# EurekaNow Dashboard

EurekaNow is a React-based service desk application now backed by Supabase (no local sample data at runtime).

## What Changed

- Ticket creation, ticket updates, comments, KB articles, organizations, teams, and members are persisted in Supabase.
- Organizations and teams can define custom priorities, SLA targets, urgency levels, and team roles.
- Incident tickets now support post-incident reviews.
- Ticket list includes multiple advanced search modes.


## Legal Documents

- Terms of Service: `TERMS_OF_SERVICE.md`
- Privacy Policy: `PRIVACY_POLICY.md`

Version 2.0.0

## Database migration (Supabase)

This project includes schema changes required for the permissions and approvals features. Run the SQL in `supabase/schema.sql` against your Supabase database to apply the new columns (`org_settings.role_permissions`, `org_settings.require_approvals`, `service_catalog_items.approver_mode`, `service_catalog_items.approver_team_id`, and related `approvals` fields).

To apply the migration:

1. Open your Supabase project SQL editor.
2. Copy the contents of `supabase/schema.sql` and run it.
3. Verify the new columns are present in the `org_settings`, `service_catalog_items`, and `approvals` tables.

After migrating the database, rebuild and redeploy the frontend:

```bash
npm install
npm run build
# deploy the contents of `build/` to your static hosting provider
```
