-- ============================================================
-- Migration: Fix user_profiles table for SchoolPulse ERP
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/igvbzmokviuctnzfjdbq/sql/new
-- ============================================================

-- 1. Create user_profiles table if it doesn't exist yet
create table if not exists public.user_profiles (
  id               uuid primary key,
  school_id        text not null default 'school_001',
  email            text not null default '',
  name             text not null default '',
  role             text not null default 'student',
  roll_number      text default '',
  class_id         text default '',
  section          text default '',
  linked_student_id     text default '',
  linked_children_ids   text[] default '{}',
  email_sent       boolean default false,
  photo_url        text default '',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 2. Add any missing columns to existing table
alter table public.user_profiles
  add column if not exists school_id text not null default 'school_001',
  add column if not exists email text not null default '',
  add column if not exists name text not null default '',
  add column if not exists role text not null default 'student',
  add column if not exists roll_number text default '',
  add column if not exists class_id text default '',
  add column if not exists section text default '',
  add column if not exists linked_student_id text default '',
  add column if not exists linked_children_ids text[] default '{}',
  add column if not exists email_sent boolean default false,
  add column if not exists photo_url text default '',
  add column if not exists updated_at timestamptz default now();

-- 3. Enable RLS
alter table public.user_profiles enable row level security;

-- 4. Drop ALL existing policies (common names) to start fresh
drop policy if exists "Users can view own profile."         on public.user_profiles;
drop policy if exists "Users can update own profile."       on public.user_profiles;
drop policy if exists "Users can insert own profile."       on public.user_profiles;
drop policy if exists "Users can view own profile"          on public.user_profiles;
drop policy if exists "Users can update own profile"        on public.user_profiles;
drop policy if exists "Users can insert own profile"        on public.user_profiles;
drop policy if exists "Allow authenticated all"             on public.user_profiles;
drop policy if exists "Allow anon all user_profiles"        on public.user_profiles;
drop policy if exists "Enable read access for all users"    on public.user_profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.user_profiles;

-- 5. Add a single open policy (same pattern used for classes, subjects, exams)
create policy "Allow anon all user_profiles"
  on public.user_profiles
  for all
  using (true)
  with check (true);

-- 6. Create index for fast school_id lookups
create index if not exists user_profiles_school_id_idx
  on public.user_profiles (school_id);

-- Done! Confirm with:
-- select count(*) from public.user_profiles;
