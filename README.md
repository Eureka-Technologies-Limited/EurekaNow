# EurekaNow Dashboard

EurekaNow is a React-based service desk application now backed by Supabase (no local sample data at runtime).

## What Changed

- Replaced in-memory demo/seed data with Supabase-backed reads and writes.
- Login now validates against the `users` table in Supabase.
- Ticket creation, ticket updates, comments, KB articles, organizations, teams, and members are persisted in Supabase.
- Organizations and teams can define custom priorities, SLA targets, urgency levels, and team roles.
- Incident tickets now support post-incident reviews.
- Ticket list includes multiple advanced search modes.

## Prerequisites

- Node.js 18+
- A Supabase project

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file from template:

```bash
copy .env.example .env
```

3. Fill in `.env` values:

```env
REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

4. In Supabase SQL editor, run:

- `supabase/schema.sql`

This creates all required tables/policies and inserts a bootstrap admin user.

If you already applied an older schema version, run the latest `supabase/schema.sql` again to add the new settings and post-incident tables.

## Default Bootstrap Login

After running the schema SQL, use:

- Email: `admin@example.com`
- Password: `admin123`

## Scripts

- `npm start` - start development server
- `npm run build` - build production bundle
- `npm test` - run tests

## Notes

- This project currently uses an app-level password column in `users` for simple bootstrap login flow.
- For production hardening, migrate authentication to Supabase Auth and enforce stricter RLS policies per user/org.
