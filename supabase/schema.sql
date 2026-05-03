-- EurekaNow Supabase schema
-- Run this in the Supabase SQL editor.

create table if not exists organizations (
  id text primary key,
  name text not null,
  domain text,
  industry text,
  plan text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id text primary key,
  org_id text not null,
  name text not null,
  lead text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null,
  roles jsonb not null default '[]'::jsonb,
  org_id text not null,
  team_id text,
  title text,
  password text not null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists roles jsonb not null default '[]'::jsonb;

update users
set roles = jsonb_build_array(role)
where role is not null
  and (
    roles = '[]'::jsonb
    or jsonb_typeof(roles) <> 'array'
  );

create table if not exists tickets (
  id text primary key,
  title text not null,
  description text,
  type text not null,
  category text not null,
  org_id text not null,
  team_id text,
  assignee text,
  reporter text not null,
  priority text not null,
  urgency text not null default 'Medium',
  status text not null,
  created_at bigint not null,
  tags jsonb not null default '[]'::jsonb
);

alter table tickets add column if not exists urgency text not null default 'Medium';
alter table tickets add column if not exists parent_id text;

create table if not exists ticket_comments (
  id text primary key,
  ticket_id text not null,
  user_id text not null,
  text text not null,
  created_at bigint not null
);

create table if not exists articles (
  id text primary key,
  title text not null,
  org_id text not null,
  category text not null,
  author text not null,
  content text not null,
  views integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  created_at bigint not null
);

create table if not exists org_settings (
  org_id text primary key,
  priorities jsonb not null default '[]'::jsonb,
  urgencies jsonb not null default '["Critical","High","Medium","Low"]'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists team_settings (
  team_id text primary key,
  priorities jsonb not null default '[]'::jsonb,
  urgencies jsonb not null default '["Critical","High","Medium","Low"]'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists team_roles (
  id text primary key,
  team_id text not null,
  name text not null,
  description text,
  created_at bigint not null
);

create table if not exists post_incident_reviews (
  id text primary key,
  ticket_id text not null,
  org_id text not null,
  team_id text,
  summary text,
  root_cause text,
  timeline text,
  action_items jsonb not null default '[]'::jsonb,
  owner text,
  data jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'post_incident_reviews_ticket_id_key'
  ) then
    alter table post_incident_reviews add constraint post_incident_reviews_ticket_id_key unique (ticket_id);
  end if;
end $$;

create table if not exists closing_templates (
  id text primary key,
  org_id text not null,
  team_id text,
  name text not null,
  description text,
  content text not null,
  apply_to_types jsonb not null default '["Incident"]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists pir_field_configs (
  id text primary key,
  org_id text not null,
  team_id text,
  fields jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists activity_log (
  id text primary key,
  ticket_id text not null,
  org_id text not null,
  team_id text,
  user_id text not null,
  action text not null,
  field text,
  old_value text,
  new_value text,
  created_at bigint not null
);

create index if not exists idx_teams_org_id on teams(org_id);
create index if not exists idx_users_org_id on users(org_id);
create index if not exists idx_users_team_id on users(team_id);
create index if not exists idx_tickets_org_id on tickets(org_id);
create index if not exists idx_tickets_team_id on tickets(team_id);
create index if not exists idx_ticket_comments_ticket_id on ticket_comments(ticket_id);
create index if not exists idx_articles_org_id on articles(org_id);
create index if not exists idx_team_roles_team_id on team_roles(team_id);
create index if not exists idx_pir_ticket_id on post_incident_reviews(ticket_id);
create index if not exists idx_closing_templates_org_id on closing_templates(org_id);
create index if not exists idx_closing_templates_team_id on closing_templates(team_id);
create index if not exists idx_pir_field_configs_org_id on pir_field_configs(org_id);
create index if not exists idx_pir_field_configs_team_id on pir_field_configs(team_id);
create index if not exists idx_activity_log_ticket_id on activity_log(ticket_id);
create index if not exists idx_activity_log_org_id on activity_log(org_id);
create index if not exists idx_tickets_parent_id on tickets(parent_id);

alter table organizations enable row level security;
alter table teams enable row level security;
alter table users enable row level security;
alter table tickets enable row level security;
alter table ticket_comments enable row level security;
alter table articles enable row level security;
alter table org_settings enable row level security;
alter table team_settings enable row level security;
alter table team_roles enable row level security;
alter table post_incident_reviews enable row level security;
alter table closing_templates enable row level security;
alter table pir_field_configs enable row level security;
alter table activity_log enable row level security;

drop policy if exists "public read organizations" on organizations;
create policy "public read organizations" on organizations for select using (true);
drop policy if exists "public write organizations" on organizations;
create policy "public write organizations" on organizations for all using (true) with check (true);

drop policy if exists "public read teams" on teams;
create policy "public read teams" on teams for select using (true);
drop policy if exists "public write teams" on teams;
create policy "public write teams" on teams for all using (true) with check (true);

drop policy if exists "public read users" on users;
create policy "public read users" on users for select using (true);
drop policy if exists "public write users" on users;
create policy "public write users" on users for all using (true) with check (true);

drop policy if exists "public read tickets" on tickets;
create policy "public read tickets" on tickets for select using (true);
drop policy if exists "public write tickets" on tickets;
create policy "public write tickets" on tickets for all using (true) with check (true);

drop policy if exists "public read comments" on ticket_comments;
create policy "public read comments" on ticket_comments for select using (true);
drop policy if exists "public write comments" on ticket_comments;
create policy "public write comments" on ticket_comments for all using (true) with check (true);

drop policy if exists "public read articles" on articles;
create policy "public read articles" on articles for select using (true);
drop policy if exists "public write articles" on articles;
create policy "public write articles" on articles for all using (true) with check (true);

drop policy if exists "public read org settings" on org_settings;
create policy "public read org settings" on org_settings for select using (true);
drop policy if exists "public write org settings" on org_settings;
create policy "public write org settings" on org_settings for all using (true) with check (true);

drop policy if exists "public read team settings" on team_settings;
create policy "public read team settings" on team_settings for select using (true);
drop policy if exists "public write team settings" on team_settings;
create policy "public write team settings" on team_settings for all using (true) with check (true);

drop policy if exists "public read team roles" on team_roles;
create policy "public read team roles" on team_roles for select using (true);
drop policy if exists "public write team roles" on team_roles;
create policy "public write team roles" on team_roles for all using (true) with check (true);

drop policy if exists "public read post incident reviews" on post_incident_reviews;
create policy "public read post incident reviews" on post_incident_reviews for select using (true);
drop policy if exists "public write post incident reviews" on post_incident_reviews;
create policy "public write post incident reviews" on post_incident_reviews for all using (true) with check (true);

drop policy if exists "public read closing templates" on closing_templates;
create policy "public read closing templates" on closing_templates for select using (true);
drop policy if exists "public write closing templates" on closing_templates;
create policy "public write closing templates" on closing_templates for all using (true) with check (true);

drop policy if exists "public read pir field configs" on pir_field_configs;
create policy "public read pir field configs" on pir_field_configs for select using (true);
drop policy if exists "public write pir field configs" on pir_field_configs;
create policy "public write pir field configs" on pir_field_configs for all using (true) with check (true);

drop policy if exists "public read activity log" on activity_log;
create policy "public read activity log" on activity_log for select using (true);
drop policy if exists "public write activity log" on activity_log;
create policy "public write activity log" on activity_log for all using (true) with check (true);

-- Create at least one user so login can work immediately.
insert into organizations (id, name, domain, industry, plan)
values ('o_root', 'EurekaNow Demo Org', 'example.com', 'Technology', 'Starter')
on conflict (id) do nothing;

insert into teams (id, org_id, name, lead, icon)
values ('t_support', 'o_root', 'Support', null, '🖥️')
on conflict (id) do nothing;

insert into org_settings (org_id, priorities, urgencies, updated_at)
values (
  'o_root',
  '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
  '["Critical","High","Medium","Low"]'::jsonb,
  extract(epoch from now())::bigint * 1000
)
on conflict (org_id) do nothing;

insert into team_settings (team_id, priorities, urgencies, updated_at)
values (
  't_support',
  '[{"name":"Critical","color":"#e53e3e","sla":4},{"name":"High","color":"#dd6b20","sla":8},{"name":"Medium","color":"#d69e2e","sla":24},{"name":"Low","color":"#3182ce","sla":72}]'::jsonb,
  '["Critical","High","Medium","Low"]'::jsonb,
  extract(epoch from now())::bigint * 1000
)
on conflict (team_id) do nothing;

insert into team_roles (id, team_id, name, description, created_at)
values
  ('role_admin_seed', 't_support', 'Admin', 'Full access', extract(epoch from now())::bigint * 1000),
  ('role_agent_seed', 't_support', 'Agent', 'Handle tickets', extract(epoch from now())::bigint * 1000),
  ('role_end_user_seed', 't_support', 'End User', 'Submit only', extract(epoch from now())::bigint * 1000)
on conflict (id) do nothing;

insert into users (id, name, email, role, roles, org_id, team_id, title, password)
values ('u_admin', 'Admin User', 'admin@example.com', 'Admin', '["Admin"]'::jsonb, 'o_root', 't_support', 'Administrator', 'admin123')
on conflict (id) do nothing;
