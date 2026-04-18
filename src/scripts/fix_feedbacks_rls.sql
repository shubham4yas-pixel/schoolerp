-- ============================================================
-- Migration: Create/Fix feedbacks table + open RLS
-- ⚠️  Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/igvbzmokviuctnzfjdbq/sql/new
-- ============================================================

-- 1. Create feedbacks table if it doesn't exist
create table if not exists public.feedbacks (
  id            text primary key,
  school_id     text not null,
  student_id    text not null,
  class         text default '',
  class_id      text default '',
  section       text default '',
  teacher_id    text default '',
  teacher_name  text default 'Teacher',
  exam_type     text default '',
  feedback_text text default '',
  remark        text default '',
  status        text default 'draft',
  category      text default 'Academic',
  date          text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. Add any missing columns to an existing table
alter table public.feedbacks
  add column if not exists school_id     text not null default 'school_001',
  add column if not exists student_id    text not null default '',
  add column if not exists class         text default '',
  add column if not exists class_id      text default '',
  add column if not exists section       text default '',
  add column if not exists teacher_id    text default '',
  add column if not exists teacher_name  text default 'Teacher',
  add column if not exists exam_type     text default '',
  add column if not exists feedback_text text default '',
  add column if not exists remark        text default '',
  add column if not exists status        text default 'draft',
  add column if not exists category      text default 'Academic',
  add column if not exists date          text default '',
  add column if not exists created_at    timestamptz default now(),
  add column if not exists updated_at    timestamptz default now();

-- 3. If status column exists but has wrong values, fix them
update public.feedbacks
  set status = 'draft'
  where status is null or status not in ('draft', 'published');

-- 4. Enable RLS
alter table public.feedbacks enable row level security;

-- 5. Drop ALL existing policies dynamically
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'feedbacks' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.feedbacks', pol.policyname);
  end loop;
end $$;

-- 6. Open policy (same pattern as marks/classes/subjects)
create policy "Allow anon all feedbacks"
  on public.feedbacks
  for all
  using (true)
  with check (true);

-- 7. Indexes
create index if not exists feedbacks_school_student_idx on public.feedbacks (school_id, student_id);
create index if not exists feedbacks_status_idx         on public.feedbacks (school_id, status);

-- ✅ Verify:
select
  count(*) as total,
  count(case when status = 'draft'     then 1 end) as drafts,
  count(case when status = 'published' then 1 end) as published
from public.feedbacks;
