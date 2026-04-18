-- ============================================================
-- Migration: Fix marks table RLS + ensure correct schema
-- ⚠️  REQUIRED: Run this in the Supabase SQL Editor BEFORE using the marks feature:
-- https://supabase.com/dashboard/project/igvbzmokviuctnzfjdbq/sql/new
-- ============================================================

-- 1. Create marks table if it doesn't exist yet
create table if not exists public.marks (
  id            uuid default gen_random_uuid() primary key,
  school_id     text not null,
  student_id    text not null,
  subject       text not null,
  exam_type     text not null,
  marks_obtained numeric not null default 0,
  total_marks    numeric not null default 100,
  date          text,
  is_published  boolean default false,
  source        text default 'manual',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. Add any missing columns (safe to run on existing tables)
alter table public.marks
  add column if not exists school_id      text not null default 'school_001',
  add column if not exists student_id     text not null default '',
  add column if not exists subject        text not null default '',
  add column if not exists exam_type      text not null default '',
  add column if not exists marks_obtained numeric not null default 0,
  add column if not exists total_marks    numeric not null default 100,
  add column if not exists is_published   boolean default false,
  add column if not exists source         text default 'manual',
  add column if not exists updated_at     timestamptz default now();

-- 2b. Ensure the id column auto-generates a UUID (fixes "null value in id" error)
alter table public.marks
  alter column id set default gen_random_uuid();

-- 3. Add unique constraint for upsert support
--    (skip if constraint already exists; the DO $$ block handles that gracefully)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marks_school_student_exam_subject_key'
  ) then
    alter table public.marks
      add constraint marks_school_student_exam_subject_key
      unique (school_id, student_id, exam_type, subject);
  end if;
end $$;

-- 4. Enable RLS
alter table public.marks enable row level security;

-- 5. Drop ALL existing policies (any name) so we start clean
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'marks' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.marks', pol.policyname);
  end loop;
end $$;

-- 6. Add a single open policy (same pattern as classes/subjects/exams/students)
create policy "Allow anon all marks"
  on public.marks
  for all
  using (true)
  with check (true);

-- 7. Indexes for fast lookups
create index if not exists marks_school_student_idx on public.marks (school_id, student_id);
create index if not exists marks_school_exam_idx    on public.marks (school_id, exam_type);

-- ✅ Verify after running:
select
  count(*) as total_marks,
  count(case when is_published then 1 end) as published,
  count(case when not is_published then 1 end) as drafts
from public.marks;
