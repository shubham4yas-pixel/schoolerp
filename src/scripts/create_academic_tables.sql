-- ============================================================
-- Migration: Create classes, subjects, exams tables
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/igvbzmokviuctnzfjdbq/sql/new
-- ============================================================

-- classes
create table if not exists public.classes (
  id         text primary key,
  school_id  text not null,
  name       text not null,
  "order"    integer default 0,
  sections   text[] default '{}',
  created_at timestamptz default now()
);
alter table public.classes enable row level security;
create policy "Allow anon all classes" on public.classes for all using (true) with check (true);

-- subjects
create table if not exists public.subjects (
  id         text primary key,
  school_id  text not null,
  name       text not null,
  class_ids  text[] default '{}',
  created_at timestamptz default now()
);
alter table public.subjects enable row level security;
create policy "Allow anon all subjects" on public.subjects for all using (true) with check (true);

-- exams
create table if not exists public.exams (
  id          text primary key,
  school_id   text not null,
  name        text not null,
  "order"     integer default 0,
  exam_date   text,
  result_date text,
  is_published boolean default false,
  created_at  timestamptz default now()
);
alter table public.exams enable row level security;
create policy "Allow anon all exams" on public.exams for all using (true) with check (true);
