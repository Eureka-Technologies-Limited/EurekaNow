-- ════════════════════════════════════════════════════════════════════════════
-- EUREKANOW — SUPABASE SCHEMA  (v2.1)
-- ════════════════════════════════════════════════════════════════════════════
--
-- HOW TO IMPORT:
--   1. Open your Supabase project → SQL Editor → New Query
--   2. Paste this entire file and click Run
--   3. Copy your Project URL and anon key from Project → Settings → API
--   4. Add them to your .env file:
--        REACT_APP_SUPABASE_URL=https://<ref>.supabase.co
--        REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
--
-- Safe to re-run on an existing database — all statements are idempotent.
-- ════════════════════════════════════════════════════════════════════════════


-- ── TABLES ──────────────────────────────────────────────────────────────────

create table if not exists organizations (
  id         text        primary key,
  name       text        not null,
  domain     text,
  industry   text,
  plan       text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id         text        primary key,
  org_id     text        not null,
  name       text        not null,
  lead       text,
  icon       text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id         text        primary key,
  name       text        not null,
  email      text        not null unique,
  role       text        not null default 'End User',
  roles      jsonb       not null default '[]'::jsonb,
  org_id     text        not null,
  team_id    text,
  title      text,
  -- NOTE: passwords are stored in plain text here because the app uses a
  -- simple custom auth layer, not Supabase Auth. Suitable for internal/demo
  -- use. Replace with Supabase Auth for production-grade security.
  password   text        not null default 'changeme',
  created_at timestamptz not null default now()
);

-- Backfill roles array for any existing rows that have role but empty roles.
-- "role" must be quoted — it is a reserved keyword outside CREATE TABLE.
update users
set    roles = jsonb_build_array("role")
where  "role" is not null
  and  (roles = '[]'::jsonb or jsonb_typeof(roles) <> 'array');

create table if not exists tickets (
  id          text   primary key,
  title       text   not null,
  description text,
  type        text   not null,
  category    text   not null,
  org_id      text   not null,
  team_id     text,
  assignee    text,
  reporter    text   not null,
  priority    text   not null default 'Medium',
  urgency     text   not null default 'Medium',
  status      text   not null default 'Open',
  resolved_at bigint,
  -- Unix milliseconds — matches Date.now() in the application layer
  created_at  bigint not null,
  tags        jsonb  not null default '[]'::jsonb,
    parent_id   text,
    due_date    bigint,
    estimate_hours numeric,
    spent_hours  numeric not null default 0
);

-- Migration guards (safe no-ops if columns already exist)
alter table tickets add column if not exists urgency   text  not null default 'Medium';
alter table tickets add column if not exists resolved_at bigint;
alter table tickets add column if not exists parent_id text;
  alter table tickets add column if not exists due_date bigint;
  alter table tickets add column if not exists estimate_hours numeric;
  alter table tickets add column if not exists spent_hours numeric not null default 0;
-- Separate display number (e.g. INC-0001) from the internal primary key.
alter table tickets add column if not exists number text not null default '';
-- Structured request data from service catalog submissions.
alter table tickets add column if not exists custom_fields jsonb not null default '{}'::jsonb;
-- Backfill: existing tickets whose id is already in sequential format keep that as their number.
update tickets set number = id where number = '' and id ~ '^[A-Z]+-[0-9]+$';

-- Ensure `category` has a safe default and backfill any existing NULLs so
-- inserting rows without an explicit category doesn't fail with a NOT NULL
-- constraint violation (useful for older deployments or demo imports).
alter table tickets alter column category set default 'General';
update tickets set category = 'General' where category is null;

create table if not exists ticket_comments (
  id         text   primary key,
  ticket_id  text   not null,
  user_id    text   not null,
  text       text   not null,
  created_at bigint not null
);

create table if not exists articles (
  id         text    primary key,
  title      text    not null,
  org_id     text    not null,
  category   text    not null,
  folder     text    not null default 'General',
  author     text    not null,
  editors    jsonb   not null default '[]'::jsonb,
  content    text    not null default '',
  views      integer not null default 0,
  tags       jsonb   not null default '[]'::jsonb,
  created_at bigint  not null
);

-- Migration guards
alter table articles add column if not exists folder  text  not null default 'General';
alter table articles add column if not exists editors jsonb not null default '[]'::jsonb;

create table if not exists org_settings (
  org_id     text   primary key,
  priorities jsonb  not null default '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
  urgencies  jsonb  not null default '["Critical","High","Medium","Low"]'::jsonb,
  categories jsonb  not null default '["Network","Software","Hardware","Security","Access Management","Onboarding","Facilities","Healthcare","Engineering","Finance","Legal","Other"]'::jsonb,
  role_permissions jsonb not null default '{}',
  require_approvals boolean not null default false,
  approval_mode text not null default 'all',
  updated_at bigint not null default 0
);

-- Migration guard
alter table org_settings add column if not exists
  categories jsonb not null default '["Network","Software","Hardware","Security","Access Management","Onboarding","Facilities","Healthcare","Engineering","Finance","Legal","Other"]'::jsonb;
alter table org_settings add column if not exists approval_mode text not null default 'all';
alter table org_settings add column if not exists ticket_types jsonb not null default '[]'::jsonb;
alter table org_settings add column if not exists org_roles jsonb not null default '[]'::jsonb;
-- Custom request field definitions per catalog item.
alter table service_catalog_items add column if not exists request_fields jsonb not null default '[]'::jsonb;

create table if not exists api_keys (
  id           text    primary key,
  org_id       text    not null references organizations(id) on delete cascade,
  name         text    not null,
  key_value    text    not null,
  key_prefix   text    not null,
  created_by   text,
  created_at   bigint  not null,
  last_used_at bigint,
  is_active    boolean not null default true
);
create index if not exists idx_api_keys_org_id on api_keys(org_id);

create table if not exists team_settings (
  team_id    text   primary key,
  priorities jsonb  not null default '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
  urgencies  jsonb  not null default '["Critical","High","Medium","Low"]'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists team_roles (
  id          text   primary key,
  team_id     text   not null,
  name        text   not null,
  description text,
  created_at  bigint not null
);

create table if not exists post_incident_reviews (
  id           text   primary key,
  ticket_id    text   not null unique,
  org_id       text   not null,
  team_id      text,
  summary      text,
  root_cause   text,
  timeline     text,
  action_items jsonb  not null default '[]'::jsonb,
  owner        text,
  data         jsonb  not null default '{}'::jsonb,
  created_at   bigint not null,
  updated_at   bigint not null
);

-- Migration guard (unique constraint may already exist under a different name)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where  conname = 'post_incident_reviews_ticket_id_key'
  ) then
    alter table post_incident_reviews
      add constraint post_incident_reviews_ticket_id_key unique (ticket_id);
  end if;
end $$;

create table if not exists closing_templates (
  id             text   primary key,
  org_id         text   not null,
  team_id        text,
  name           text   not null,
  description    text,
  content        text   not null,
  apply_to_types jsonb  not null default '["Incident"]'::jsonb,
  created_at     bigint not null,
  updated_at     bigint not null
);

create table if not exists pir_field_configs (
  id         text   primary key,
  org_id     text   not null,
  team_id    text,
  fields     jsonb  not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists service_catalog_items (
  id                text   primary key,
  org_id            text   not null,
  team_id           text,
  name              text   not null,
  description       text   not null default '',
  category          text   not null default 'General',
  icon              text   not null default 'request',
  default_type      text   not null default 'Service Request',
  default_priority  text   not null default 'Medium',
  default_urgency   text   not null default 'Medium',
  requires_approval boolean not null default false,
  approver_role     text   not null default 'Admin',
  approver_id       text,
  approver_mode     text   not null default 'role', -- 'role' | 'user' | 'team'
  approver_team_id  text,
  active            boolean not null default true,
  created_at        bigint not null,
  updated_at        bigint not null
);

create table if not exists approvals (
  id             text   primary key,
  org_id         text   not null,
  team_id        text,
  ticket_id      text   not null,
  catalog_item_id text,
  requested_by   text   not null,
  requested_for  text   not null,
  approver_id    text,
  approver_role  text   not null default 'Admin',
  approver_mode  text   not null default 'role',
  approver_team_id text,
  status         text   not null default 'Pending',
  decision       text   not null default '',
  comments       text   not null default '',
  due_at         bigint,
  created_at     bigint not null,
  decided_at     bigint
);

create table if not exists activity_log (
  id         text   primary key,
  ticket_id  text   not null,
  org_id     text   not null,
  team_id    text,
  user_id    text   not null,
  action     text   not null,
  field      text,
  old_value  text,
  new_value  text,
  created_at bigint not null
);


create table if not exists org_invitations (
  id          text   primary key,
  org_id      text   not null,
  team_id     text,
  email       text   not null,
  role        text   not null default 'End User',
  roles       jsonb  not null default '[]'::jsonb,
  status      text   not null default 'Pending',
  sent_at     bigint not null,
  accepted_at bigint
);

create index if not exists idx_org_invitations_email   on org_invitations(lower(email));
create index if not exists idx_org_invitations_org_id  on org_invitations(org_id);
create index if not exists idx_org_invitations_status  on org_invitations(status);

-- Per-org sequential ticket numbering.
-- last_val holds the most recently issued number; next ticket = last_val + 1.
create table if not exists ticket_sequences (
  org_id   text    not null,
  prefix   text    not null,
  last_val integer not null default 0,
  primary key (org_id, prefix)
);

-- Atomic increment function. Seeds from the number column on first call per
-- org+prefix so migrated databases never repeat a number.
create or replace function next_ticket_seq(p_org_id text, p_prefix text)
returns integer
language plpgsql
as $$
declare
  v_next integer;
begin
  -- Ensure a row exists; seed last_val from the highest existing ticket number.
  insert into ticket_sequences (org_id, prefix, last_val)
  select
    p_org_id,
    p_prefix,
    coalesce(
      (select max(substring(number from '\d+$')::integer)
       from   tickets
       where  org_id = p_org_id
         and  number ~ ('^' || p_prefix || '-[0-9]+$')),
      0
    )
  where not exists (
    select 1 from ticket_sequences
    where org_id = p_org_id and prefix = p_prefix
  );

  -- Row-level lock + increment is atomic; two concurrent calls get distinct values.
  update ticket_sequences
  set    last_val = last_val + 1
  where  org_id = p_org_id and prefix = p_prefix
  returning last_val into v_next;

  return v_next;
end;
$$;

-- Custom reports saved per organisation.
create table if not exists custom_reports (
  id         text   primary key,
  org_id     text   not null,
  name       text   not null,
  config     jsonb  not null default '{}'::jsonb,
  created_by text,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_custom_reports_org_id on custom_reports(org_id);

-- ── INDEXES ──────────────────────────────────────────────────────────────────

create index if not exists idx_teams_org_id              on teams(org_id);
create index if not exists idx_users_org_id              on users(org_id);
create index if not exists idx_users_team_id             on users(team_id);
create index if not exists idx_users_email_lower         on users(lower(email));
create index if not exists idx_tickets_org_id            on tickets(org_id);
create index if not exists idx_tickets_team_id           on tickets(team_id);
create index if not exists idx_tickets_assignee          on tickets(assignee);
create index if not exists idx_tickets_status            on tickets(status);
create index if not exists idx_tickets_parent_id         on tickets(parent_id);
create index if not exists idx_ticket_comments_ticket_id on ticket_comments(ticket_id);
create index if not exists idx_articles_org_id           on articles(org_id);
create index if not exists idx_team_roles_team_id        on team_roles(team_id);
create index if not exists idx_pir_ticket_id             on post_incident_reviews(ticket_id);
create index if not exists idx_pir_org_id                on post_incident_reviews(org_id);
create index if not exists idx_closing_templates_org_id  on closing_templates(org_id);
create index if not exists idx_closing_templates_team_id on closing_templates(team_id);
create index if not exists idx_pir_field_configs_org_id  on pir_field_configs(org_id);
create index if not exists idx_pir_field_configs_team_id on pir_field_configs(team_id);
create index if not exists idx_catalog_items_org_id      on service_catalog_items(org_id);
create index if not exists idx_catalog_items_team_id     on service_catalog_items(team_id);
create index if not exists idx_catalog_items_active      on service_catalog_items(active);
-- Migration guards: ensure approver and related columns exist before creating indexes
alter table service_catalog_items add column if not exists approver_id text;
alter table service_catalog_items add column if not exists approver_mode text not null default 'role';
alter table service_catalog_items add column if not exists approver_team_id text;

alter table approvals add column if not exists approver_id text;
alter table approvals add column if not exists approver_mode text not null default 'role';
alter table approvals add column if not exists approver_team_id text;

alter table org_settings add column if not exists role_permissions jsonb not null default '{}';
alter table org_settings add column if not exists require_approvals boolean not null default false;

create index if not exists idx_catalog_items_approver_id on service_catalog_items(approver_id);
create index if not exists idx_approvals_org_id          on approvals(org_id);
create index if not exists idx_approvals_team_id         on approvals(team_id);
create index if not exists idx_approvals_ticket_id       on approvals(ticket_id);
create index if not exists idx_approvals_status          on approvals(status);
create index if not exists idx_activity_log_ticket_id    on activity_log(ticket_id);
create index if not exists idx_activity_log_org_id       on activity_log(org_id);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- All tables allow full read/write via the anon key.
-- This is intentional for a single-tenant internal tool using app-layer auth.
-- To add user-level isolation, replace these policies with JWT-based checks
-- once you migrate to Supabase Auth.

alter table organizations         enable row level security;
alter table teams                 enable row level security;
alter table users                 enable row level security;
alter table tickets               enable row level security;
alter table ticket_comments       enable row level security;
alter table articles              enable row level security;
alter table org_settings          enable row level security;
alter table team_settings         enable row level security;
alter table team_roles            enable row level security;
alter table post_incident_reviews enable row level security;
alter table closing_templates     enable row level security;
alter table pir_field_configs     enable row level security;
alter table service_catalog_items  enable row level security;
alter table approvals             enable row level security;
alter table activity_log          enable row level security;
alter table ticket_sequences      enable row level security;
alter table custom_reports        enable row level security;

-- Drop all existing policies on every table, then create a single open policy.
-- Using a DO block avoids per-table boilerplate and handles any old policy names.
do $$
declare
  tbl  text;
  pol  text;
begin
  foreach tbl in array array[
    'organizations', 'teams', 'users', 'tickets', 'ticket_comments',
    'articles', 'org_settings', 'team_settings', 'team_roles',
    'post_incident_reviews', 'closing_templates', 'pir_field_configs',
    'service_catalog_items', 'approvals', 'activity_log',
    'ticket_sequences', 'custom_reports'
  ] loop
    for pol in
      select policyname
      from   pg_policies
      where  schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on %I', pol, tbl);
    end loop;
    execute format(
      'create policy "allow_all" on %I for all using (true) with check (true)',
      tbl
    );
  end loop;
end $$;


-- No seed data needed.
-- The first person to sign up via the app becomes the Admin of their own org.



-- ════════════════════════════════════════════════════════════════════════════
-- SETUP INSTRUCTIONS
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1. Run this entire file in Supabase → SQL Editor → New Query.
-- 2. Add your Supabase credentials to .env:
--      REACT_APP_SUPABASE_URL=https://<ref>.supabase.co
--      REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
-- 3. Before running, edit the first-run block above and replace:
--      admin@yourcompany.com  →  your real admin email
--      changeme               →  a strong password
-- 4. Log in and change your password via Settings immediately.
--
-- Tables created:
--   organizations, teams, users, tickets, ticket_comments, articles,
--   org_settings, team_settings, team_roles, post_incident_reviews,
--   closing_templates, pir_field_configs, service_catalog_items,
--   approvals, activity_log, org_invitations, ticket_sequences, custom_reports
-- ════════════════════════════════════════════════════════════════════════════
