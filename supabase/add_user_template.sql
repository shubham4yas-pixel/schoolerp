-- ================================================================
-- SCHOOLPULSE — ADD NEW USER TEMPLATE
-- ================================================================
-- Use this every time you want to add a new user to a school.
--
-- STEP 1: Fill in the values below
-- STEP 2: Run in Supabase → SQL Editor
-- STEP 3: Go to Supabase → Authentication → Users → Invite User
--         Enter the same email address
-- STEP 4: User receives email, sets password, logs in ✅
-- ================================================================

INSERT INTO public.user_profiles (
  id,           -- Auto-generated placeholder (trigger replaces it with real auth UID)
  email,        -- Must match the email you use in the Supabase invite
  name,         -- Full name — will auto-appear in the Auth dashboard Display Name
  role,         -- See role options below
  school_id,    -- The school this user belongs to (must exist in the schools table)
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),          -- ← DO NOT CHANGE THIS
  'EMAIL@EXAMPLE.COM',        -- ← User email (lowercase)
  'Full Name Here',           -- ← User full name
  'ROLE_HERE',                -- ← See role options below
  'SCHOOL_ID_HERE',           -- ← Must match a school id in the schools table
  'pending',                  -- ← DO NOT CHANGE THIS
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING; -- Safe to re-run without duplicating

-- ================================================================
-- ROLE OPTIONS (copy one of these exactly):
--
--   'admin'       → Full school management access
--   'accountant'  → Fee management and billing only
--   'teacher'     → Marks, attendance, and feedback
--   'student'     → View own results and performance
--   'parent'      → View child's progress
--
-- ================================================================
-- SCHOOL ID (check your schools table for the exact ID):
--
--   Run this to see all schools:
--   SELECT id, "School's Name" FROM public.schools;
--
-- ================================================================
-- EXAMPLE — Adding a teacher named Ravi Sharma to School_001:
--
-- VALUES (
--   gen_random_uuid(),
--   'ravi.sharma@school.edu',
--   'Ravi Sharma',
--   'teacher',
--   'School_001',
--   'pending', NOW(), NOW()
-- )
-- ================================================================
