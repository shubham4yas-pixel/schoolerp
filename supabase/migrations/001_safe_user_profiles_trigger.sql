-- ============================================================
-- SchoolPulse — Safe user_profiles trigger
-- Run this ONCE in Supabase SQL Editor
-- ============================================================
-- 
-- WHAT THIS DOES:
--   When any user is created in auth.users (signup, invite, admin create),
--   this trigger either:
--     A) Links the new auth UID to a pre-existing user_profiles row
--        that the admin already created by email  ← THE KEY FLOW
--     B) Creates a new row with role=NULL (pending, no access)
--
-- ADMIN WORKFLOW TO ADD A USER TO A SCHOOL:
--   1. Go to Supabase → Table Editor → user_profiles → Insert Row
--      Set: email, role, school_id, name  (leave id blank or use any UUID)
--   2. Go to Supabase → Auth → Users → Invite User → enter the same email
--   3. This trigger fires, finds the pre-created row by email,
--      overwrites its id with the real auth UID
--   4. User accepts invite, sets password, logs in → their role+school is ready
-- ============================================================


-- ── Step 1: Clean up any previous unsafe trigger ─────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;


-- ── Step 2: Ensure role column allows NULL (no default) ──────
-- (Safe — only removes the constraint if it exists)
DO $$
BEGIN
  -- Drop NOT NULL on role if it exists
  ALTER TABLE public.user_profiles ALTER COLUMN role DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Already nullable, no problem
END;
$$;

DO $$
BEGIN
  -- Drop any default value on role
  ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN
  NULL; -- No default, no problem
END;
$$;


-- ── Step 3: Add status column (pending / active) ─────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'active'));


-- ── Step 4: Create the safe trigger function ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER                  -- runs as DB owner, bypasses RLS
SET search_path = public          -- explicit schema to prevent hijacking
AS $$
DECLARE
  _email       TEXT;
  _name        TEXT;
  _existing_id UUID;
BEGIN
  -- ── Safely extract values ──────────────────────────────────
  _email := LOWER(TRIM(COALESCE(NEW.email, '')));

  _name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(SPLIT_PART(_email, '@', 1), '')  -- prefix before @ as fallback
  );

  -- ── Check if admin pre-created a user_profiles row ────────
  -- (Admin inserts a row with email+role+school_id FIRST,
  --  then invites the user — this links them)
  IF _email <> '' THEN
    SELECT id INTO _existing_id
    FROM public.user_profiles
    WHERE LOWER(email) = _email
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    -- ✅ Admin pre-created this profile.
    -- Update the id to the real auth UID and activate.
    UPDATE public.user_profiles
    SET
      id         = NEW.id,
      status     = 'active',
      updated_at = NOW()
    WHERE LOWER(email) = _email;

    -- Sync the name back to auth.users so it appears in the Supabase Auth Dashboard
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', (SELECT name FROM public.user_profiles WHERE id = NEW.id LIMIT 1))
    WHERE id = NEW.id;

    RAISE LOG '[handle_new_auth_user] Linked auth UID % to pre-created profile for %', NEW.id, _email;

  ELSE
    -- ✅ No pre-existing profile — create a blank pending one.
    -- role = NULL  → user can log in but sees "contact admin" message,
    -- no dashboard access until admin assigns a role.
    INSERT INTO public.user_profiles (id, email, name, role, school_id, status, created_at, updated_at)
    VALUES (
      NEW.id,
      _email,
      _name,
      NULL,                   -- role intentionally NULL
      'school_001',           -- default school; admin can update later
      'pending',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;  -- idempotent

    RAISE LOG '[handle_new_auth_user] Created pending profile for %', _email;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: never break auth — log and move on
    RAISE WARNING '[handle_new_auth_user] Non-fatal error for %: %', _email, SQLERRM;
    RETURN NEW;
END;
$$;


-- ── Step 5: Attach trigger to auth.users ─────────────────────
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();


-- ── Step 6: Permissions ──────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;


-- ── Step 7: Verification queries (run after applying) ────────
-- Check trigger is registered:
--   SELECT trigger_name, event_manipulation, action_timing
--   FROM information_schema.triggers
--   WHERE trigger_schema = 'auth' AND event_object_table = 'users';
--
-- Check role allows NULL:
--   SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'user_profiles' AND column_name IN ('role', 'status');
