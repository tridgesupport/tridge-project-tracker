-- ============================================================
-- Tridge Project Tracker — Full Schema + RLS
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Users (extends auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  role text not null check (role in ('admin', 'internal', 'client')) default 'internal',
  team text not null check (team in ('internal', 'client')) default 'internal',
  created_at timestamptz not null default now()
);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, role, team)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'internal'),
    coalesce(new.raw_user_meta_data->>'team', 'internal')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  email text,
  created_at timestamptz not null default now()
);

-- 3. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  description text,
  expected_start_date date,
  expected_end_date date,
  status text not null check (status in ('Pending','In Progress','Sent for Review','Sent for Correction','Completed','Scoping')) default 'Pending',
  owner_id uuid references public.users(id) on delete set null,
  project_type text not null check (project_type in ('Internal R&D','Existing Client','Potential Client')) default 'Internal R&D',
  customer_id uuid references public.clients(id) on delete set null,
  next_action_by uuid references public.users(id) on delete set null,
  last_edited_by uuid references public.users(id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  priority integer check (priority >= 1 and priority <= 10)
);

-- 4. Milestones
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_name text not null,
  description text,
  start_date date,
  end_date date,
  status text not null check (status in ('Pending','In Progress','Sent for Review','Sent for Correction','Completed')) default 'Pending',
  assigned_to uuid references public.users(id) on delete set null,
  next_action_by uuid references public.users(id) on delete set null,
  last_edited_by uuid references public.users(id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  priority integer check (priority >= 1 and priority <= 10)
);

-- 5. Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_name text not null,
  description text,
  comments text,
  links text,
  documentation_link text,
  start_date date,
  end_date date,
  status text not null check (status in ('Pending','In Progress','Sent for Review','Sent for Correction','Completed')) default 'Pending',
  assigned_to uuid references public.users(id) on delete set null,
  next_action_by uuid references public.users(id) on delete set null,
  last_edited_by uuid references public.users(id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  priority integer check (priority >= 1 and priority <= 10)
);

-- 6. Edit Log (append-only)
create table if not exists public.edit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project','milestone','task')),
  entity_id uuid not null,
  edited_by_email text not null,
  edited_at timestamptz not null default now(),
  changes jsonb not null default '{}'
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.edit_log enable row level security;

-- Helper function: get current user's role
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.users where id = auth.uid()
$$;

-- Helper function: get current user's client id
create or replace function public.current_user_client_id()
returns uuid language sql security definer stable as $$
  select c.id from public.clients c
  join public.users u on u.email = c.email
  where u.id = auth.uid()
  limit 1
$$;

-- USERS policies
create policy "users_select_own" on public.users for select using (true);
create policy "users_update_admin" on public.users for update using (current_user_role() = 'admin');
create policy "users_insert_trigger" on public.users for insert with check (true);

-- CLIENTS policies
create policy "clients_select_all_internal" on public.clients for select using (
  current_user_role() in ('admin', 'internal')
);
create policy "clients_insert_admin" on public.clients for insert with check (current_user_role() = 'admin');
create policy "clients_update_admin" on public.clients for update using (current_user_role() = 'admin');

-- PROJECTS policies
create policy "projects_select_internal" on public.projects for select using (
  current_user_role() in ('admin', 'internal')
);
create policy "projects_select_client" on public.projects for select using (
  current_user_role() = 'client' and customer_id = current_user_client_id()
);
create policy "projects_insert_internal" on public.projects for insert with check (
  current_user_role() in ('admin', 'internal')
);
create policy "projects_update_internal" on public.projects for update using (
  current_user_role() in ('admin', 'internal')
);

-- MILESTONES policies
create policy "milestones_select" on public.milestones for select using (
  current_user_role() in ('admin', 'internal') or
  (current_user_role() = 'client' and project_id in (
    select id from public.projects where customer_id = current_user_client_id()
  ))
);
create policy "milestones_insert" on public.milestones for insert with check (
  current_user_role() in ('admin', 'internal')
);
create policy "milestones_update" on public.milestones for update using (
  current_user_role() in ('admin', 'internal')
);
create policy "milestones_delete" on public.milestones for delete using (
  current_user_role() in ('admin', 'internal')
);

-- TASKS policies
create policy "tasks_select" on public.tasks for select using (
  current_user_role() in ('admin', 'internal') or
  (current_user_role() = 'client' and project_id in (
    select id from public.projects where customer_id = current_user_client_id()
  ))
);
create policy "tasks_insert" on public.tasks for insert with check (
  current_user_role() in ('admin', 'internal')
);
create policy "tasks_update" on public.tasks for update using (
  current_user_role() in ('admin', 'internal')
);
create policy "tasks_delete" on public.tasks for delete using (
  current_user_role() in ('admin', 'internal')
);

-- EDIT LOG policies
create policy "edit_log_select" on public.edit_log for select using (
  current_user_role() in ('admin', 'internal')
);
create policy "edit_log_insert" on public.edit_log for insert with check (
  current_user_role() in ('admin', 'internal')
);
-- No update or delete on edit_log (append-only)

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_projects_customer on public.projects(customer_id);
create index if not exists idx_projects_owner on public.projects(owner_id);
create index if not exists idx_milestones_project on public.milestones(project_id);
create index if not exists idx_tasks_milestone on public.tasks(milestone_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_edit_log_entity on public.edit_log(entity_id, entity_type);

-- ============================================================
-- Priority column (run if tables already exist)
-- ============================================================
alter table public.projects add column if not exists priority integer check (priority >= 1 and priority <= 10);
alter table public.milestones add column if not exists priority integer check (priority >= 1 and priority <= 10);
alter table public.tasks add column if not exists priority integer check (priority >= 1 and priority <= 10);
