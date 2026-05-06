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
  -- Unix milliseconds — matches Date.now() in the application layer
  created_at  bigint not null,
  tags        jsonb  not null default '[]'::jsonb,
  parent_id   text
);

-- Migration guards (safe no-ops if columns already exist)
alter table tickets add column if not exists urgency   text  not null default 'Medium';
alter table tickets add column if not exists parent_id text;

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
  updated_at bigint not null default 0
);

-- Migration guard
alter table org_settings add column if not exists
  categories jsonb not null default '["Network","Software","Hardware","Security","Access Management","Onboarding","Facilities","Healthcare","Engineering","Finance","Legal","Other"]'::jsonb;

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
alter table activity_log          enable row level security;

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
    'activity_log'
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


-- ── SEED DATA ────────────────────────────────────────────────────────────────
-- Initial data so the app is usable immediately after schema import.
-- All inserts use ON CONFLICT DO NOTHING so re-running is safe.

do $$
declare
  now_ms bigint := extract(epoch from now())::bigint * 1000;
begin

  -- ── Organizations ──────────────────────────────────────────────────────
  insert into organizations (id, name, domain, industry, plan)
  values ('o_root', 'EurekaNow', 'example.com', 'Technology', 'Starter')
  on conflict (id) do nothing;

  -- ── Teams ──────────────────────────────────────────────────────────────
  insert into teams (id, org_id, name, lead, icon) values
    ('t_it',  'o_root', 'IT Support',  'u_admin', '🖥️'),
    ('t_ops', 'o_root', 'Operations',  'u_admin', '⚙️')
  on conflict (id) do nothing;

  -- ── Users ──────────────────────────────────────────────────────────────
  -- Change passwords before going to production.
  insert into users (id, name, email, role, roles, org_id, team_id, title, password) values
    ('u_admin',  'Admin User',    'admin@example.com', 'Admin',    '["Admin"]'::jsonb,     'o_root', 't_it',  'IT Administrator',   'admin123'),
    ('u_agent1', 'Sarah Chen',    'sarah@example.com', 'Agent',    '["Agent"]'::jsonb,     'o_root', 't_it',  'Support Engineer',   'agent123'),
    ('u_agent2', 'James Wright',  'james@example.com', 'Agent',    '["Agent"]'::jsonb,     'o_root', 't_ops', 'Ops Engineer',       'agent123'),
    ('u_user1',  'Alice Johnson', 'alice@example.com', 'End User', '["End User"]'::jsonb,  'o_root', 't_it',  'Software Developer', 'user123')
  on conflict (id) do nothing;

  -- ── Org settings ───────────────────────────────────────────────────────
  insert into org_settings (org_id, priorities, urgencies, categories, updated_at)
  values (
    'o_root',
    '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
    '["Critical","High","Medium","Low"]'::jsonb,
    '["Network","Software","Hardware","Security","Access Management","Onboarding","Facilities","Healthcare","Engineering","Finance","Legal","Other"]'::jsonb,
    now_ms
  )
  on conflict (org_id) do update
    set categories = excluded.categories,
        updated_at = excluded.updated_at;

  -- ── Team settings ──────────────────────────────────────────────────────
  insert into team_settings (team_id, priorities, urgencies, updated_at) values
    ('t_it',
     '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
     '["Critical","High","Medium","Low"]'::jsonb, now_ms),
    ('t_ops',
     '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
     '["Critical","High","Medium","Low"]'::jsonb, now_ms)
  on conflict (team_id) do nothing;

  -- ── Team roles ─────────────────────────────────────────────────────────
  insert into team_roles (id, team_id, name, description, created_at) values
    ('role_it_admin',    't_it',  'Admin',    'Full access',     now_ms),
    ('role_it_agent',    't_it',  'Agent',    'Handle tickets',  now_ms),
    ('role_it_end_user', 't_it',  'End User', 'Submit only',     now_ms),
    ('role_ops_admin',   't_ops', 'Admin',    'Full access',     now_ms),
    ('role_ops_agent',   't_ops', 'Agent',    'Handle tickets',  now_ms),
    ('role_ops_end_user','t_ops', 'End User', 'Submit only',     now_ms)
  on conflict (id) do nothing;

  -- ── Sample tickets ─────────────────────────────────────────────────────
  insert into tickets
    (id, title, description, type, category, org_id, team_id, assignee,
     reporter, priority, urgency, status, created_at, tags)
  values
    ('INC-0001',
     'Authentication service degradation',
     'Widespread auth failures affecting multiple services across the organisation.',
     'Incident', 'Security', 'o_root', 't_it', 'u_agent1', 'u_admin',
     'Critical', 'Critical', 'In Progress',
     now_ms - 18000000,
     '["major-incident","auth"]'::jsonb),

    ('INC-0002',
     'VPN login failures from remote networks',
     'Users reporting VPN authentication failures when connecting from home.',
     'Incident', 'Network', 'o_root', 't_it', 'u_agent1', 'u_user1',
     'High', 'High', 'In Progress',
     now_ms - 14400000,
     '["vpn","auth"]'::jsonb),

    ('INC-0003',
     'SSO portal returning 503 for external users',
     'Single sign-on portal unreachable from outside the corporate network.',
     'Incident', 'Security', 'o_root', 't_it', null, 'u_user1',
     'High', 'High', 'Open',
     now_ms - 10800000,
     '["sso","auth"]'::jsonb),

    ('REQ-0001',
     'New Figma access for design contractors',
     'Request Figma Pro licenses for 5 contractors joining the design team.',
     'Service Request', 'Access Management', 'o_root', 't_it', 'u_agent1', 'u_user1',
     'Medium', 'Medium', 'Open',
     now_ms - 36000000,
     '["access","design"]'::jsonb),

    ('CHG-0001',
     'Scheduled server patch window — this weekend',
     'Maintenance window to apply OS and security patches to all app servers.',
     'Change Request', 'Software', 'o_root', 't_ops', 'u_agent2', 'u_admin',
     'Low', 'Low', 'Open',
     now_ms - 86400000,
     '["maintenance","patching"]'::jsonb),

    ('PRB-0001',
     'Recurring auth certificate expiry — root cause',
     'Investigating recurring outages caused by expired identity provider certificates.',
     'Problem', 'Security', 'o_root', 't_it', 'u_admin', 'u_admin',
     'High', 'High', 'Open',
     now_ms - 172800000,
     '["root-cause","certs"]'::jsonb),

    ('TSK-0001',
     'Update on-call runbook for auth incidents',
     'Runbook needs updating following last weeks cert expiry incident.',
     'Task', 'Security', 'o_root', 't_it', 'u_agent1', 'u_admin',
     'Medium', 'Medium', 'Open',
     now_ms - 43200000,
     '["runbook","docs"]'::jsonb),

    ('INC-0004',
     'Database connection pool exhausted',
     'Production database hitting max connection limit causing request timeouts.',
     'Incident', 'Software', 'o_root', 't_ops', 'u_agent2', 'u_admin',
     'Critical', 'Critical', 'Resolved',
     now_ms - 259200000,
     '["database","performance"]'::jsonb)
  on conflict (id) do nothing;

  -- Parent-child link: INC-0002 and INC-0003 are children of INC-0001
  update tickets set parent_id = 'INC-0001'
  where  id in ('INC-0002', 'INC-0003') and parent_id is null;

  -- ── Sample comments ────────────────────────────────────────────────────
  insert into ticket_comments (id, ticket_id, user_id, text, created_at) values
    ('cmt-0001', 'INC-0001', 'u_agent1',
     'Initial triage complete. Escalating to security team and engaging identity provider vendor.',
     now_ms - 16200000),
    ('cmt-0002', 'INC-0001', 'u_admin',
     'Vendor confirmed cert expiry. Rolling out new certificate now.',
     now_ms - 14400000),
    ('cmt-0003', 'INC-0002', 'u_agent1',
     'Confirmed as downstream impact of INC-0001. Will resolve when auth service is restored.',
     now_ms - 12600000)
  on conflict (id) do nothing;

  -- ── Sample KB articles ─────────────────────────────────────────────────
  insert into articles (id, title, org_id, category, folder, author, editors, content, views, tags, created_at)
  values
    ('kb-0001',
     'How to reset VPN credentials',
     'o_root', 'Network', 'Access', 'u_agent1', '[]'::jsonb,
     E'## Resetting VPN Credentials\n\n1. Navigate to the VPN portal at `vpn.example.com`\n2. Click **Forgot Password** on the login page\n3. Enter your company email address\n4. Complete the MFA verification step\n5. Set a new password meeting the complexity requirements\n\n> If you do not receive the reset email within 5 minutes, check your spam folder or contact IT Support.',
     23, '["vpn","password","access"]'::jsonb, now_ms - 604800000),

    ('kb-0002',
     'Onboarding checklist for new starters',
     'o_root', 'Onboarding', 'General', 'u_admin', '["u_agent1"]'::jsonb,
     E'## New Starter Checklist\n\n- [ ] Set up corporate email\n- [ ] Configure MFA on all accounts\n- [ ] Install required software (see Software Catalogue)\n- [ ] Join relevant Slack channels\n- [ ] Complete mandatory security awareness training\n- [ ] Request access to required systems via the Service Portal',
     41, '["onboarding","new-starter"]'::jsonb, now_ms - 1209600000),

    ('kb-0003',
     'Incident severity classification guide',
     'o_root', 'IT Support', 'Process', 'u_admin', '[]'::jsonb,
     E'## Incident Severity Levels\n\n| Priority | SLA     | Definition |\n|----------|---------|------------|\n| Critical | 4 hours | Complete service outage or data breach |\n| High     | 8 hours | Major functionality impaired for many users |\n| Medium   | 24 hours| Minor functionality impaired, workaround available |\n| Low      | 72 hours| Cosmetic issue or question |\n\nAlways err on the side of higher priority — it is easier to downgrade than to recover from a missed SLA.',
     18, '["incidents","sla","process"]'::jsonb, now_ms - 2592000000)
  on conflict (id) do nothing;

  -- ── PIR field configuration ────────────────────────────────────────────
  insert into pir_field_configs (id, org_id, team_id, fields, created_at, updated_at)
  values (
    'pirc-0001', 'o_root', 't_it',
    '[
      {"name":"summary",     "label":"Summary",      "type":"text", "required":true},
      {"name":"rootCause",   "label":"Root Cause",   "type":"text", "required":true},
      {"name":"timeline",    "label":"Timeline",     "type":"text", "required":false},
      {"name":"actionItems", "label":"Action Items", "type":"list", "required":false},
      {"name":"owner",       "label":"Owner",        "type":"user", "required":true}
    ]'::jsonb,
    now_ms, now_ms
  )
  on conflict (id) do nothing;

  -- ── Closing template ───────────────────────────────────────────────────
  insert into closing_templates
    (id, org_id, team_id, name, description, content, apply_to_types, created_at, updated_at)
  values
    ('tmpl-0001', 'o_root', 't_it',
     'Standard Incident Closure',
     'Use when closing a fully resolved incident.',
     'Incident resolved and verified. Root cause: [ROOT_CAUSE]. All affected systems are operational. Impacted users have been notified.',
     '["Incident"]'::jsonb,
     now_ms, now_ms),
    ('tmpl-0002', 'o_root', 't_it',
     'Standard Service Request Closure',
     'Use when a service request has been fulfilled.',
     'Your request has been completed. Please verify access and let us know if you encounter any issues.',
     '["Service Request"]'::jsonb,
     now_ms, now_ms)
  on conflict (id) do nothing;

end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- QUICK REFERENCE
-- ════════════════════════════════════════════════════════════════════════════
--
-- Seeded login credentials (change before going to production):
--
--   admin@example.com   / admin123   (Admin  — IT Support)
--   sarah@example.com   / agent123   (Agent  — IT Support)
--   james@example.com   / agent123   (Agent  — Operations)
--   alice@example.com   / user123    (End User — IT Support)
--
-- Tables created:
--   organizations, teams, users, tickets, ticket_comments, articles,
--   org_settings, team_settings, team_roles, post_incident_reviews,
--   closing_templates, pir_field_configs, activity_log
-- ════════════════════════════════════════════════════════════════════════════
