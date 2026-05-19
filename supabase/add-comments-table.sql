-- Run this in your Supabase SQL Editor to add the comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('milestone', 'task')),
  entity_id uuid not null,
  author_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments_select" on public.comments for select using (
  current_user_role() in ('admin', 'internal', 'client')
);
create policy "comments_insert" on public.comments for insert with check (
  current_user_role() in ('admin', 'internal')
);

create index if not exists idx_comments_entity on public.comments(entity_id, entity_type);
