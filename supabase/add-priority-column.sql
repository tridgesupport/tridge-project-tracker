-- Run this in your Supabase SQL Editor to add the priority column
alter table public.projects   add column if not exists priority integer check (priority >= 1 and priority <= 10);
alter table public.milestones add column if not exists priority integer check (priority >= 1 and priority <= 10);
alter table public.tasks      add column if not exists priority integer check (priority >= 1 and priority <= 10);
