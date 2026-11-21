-- ============================================================================
-- COMMITTEE MANAGER — SUPABASE SECURITY & SCHEMA FIX MIGRATION
-- Target Database: aptrubrisxsprgrcovte (PostgreSQL / Supabase)
-- Fully idempotent: safe to run multiple times in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE MISSING TABLES (notices, polls, poll_votes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, member_id)
);

-- ============================================================================
-- 2. TENANT ISOLATION & ADMIN HELPER FUNCTIONS (WITH FIXED search_path = '')
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('super_admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.institutions
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.is_super_admin();
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_institution(p_institution_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_institution_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    (SELECT auth.uid()) = p_institution_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND institution_id = p_institution_id
    )
    OR public.is_super_admin()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.drop_policy_if_exists(policy_name text, table_name text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, table_name);
END;
$$;

-- ============================================================================
-- 3. DROP ALL "PUBLIC FULL ACCESS" / PERMISSIVE USING(true) POLICIES & ENABLE RLS
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
  tbl RECORD;
BEGIN
  -- Drop any existing policy on public tables that is permissive/public or duplicate
  -- so we can recreate clean, non-duplicate tenant-isolated policies.
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE '%Public full access%'
        OR policyname ILIKE '%Agendas access%'
        OR policyname ILIKE '%Decisions access%'
        OR policyname ILIKE '%Public access%'
        OR policyname ILIKE '%Allow all%'
        OR policyname ILIKE '%Tenant isolation%'
        OR qual = 'true'
        OR with_check = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;

  -- Enable RLS on every table in public schema
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- 4. APPLY CLEAN, NON-DUPLICATE TENANT-ISOLATED RLS POLICIES
--    Uses (SELECT auth.uid()) to prevent auth_rls_initplan performance warnings.
-- ============================================================================

-- 4A. Tables with direct `institution_id` column:
DO $$
DECLARE
  t text;
  pol RECORD;
  inst_tables text[] := ARRAY[
    'departments',
    'members',
    'students',
    'executives',
    'teachers',
    'meetings',
    'meeting_attendance',
    'attendance',
    'fee_structures',
    'member_dues',
    'student_fees',
    'ledger',
    'transactions',
    'loans',
    'loan_repayments',
    'FDR_deposits',
    'fdr_deposits',
    'shares',
    'share_dividends',
    'projects',
    'investments',
    'investment_profits',
    'voice_templates',
    'voice_broadcasts',
    'sms_templates',
    'sms_logs',
    'activity_logs',
    'audit_logs',
    'committee_roles',
    'committee_members',
    'exams',
    'exam_subjects',
    'exam_marks',
    'notices',
    'polls'
  ];
BEGIN
  FOREACH t IN ARRAY inst_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'institution_id'
    ) THEN
      -- Drop all existing policies on this table to avoid multiple_permissive_policies warnings
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY "Tenant isolation %1$s" ON public.%1$I
         FOR ALL TO authenticated
         USING (
           (SELECT auth.uid()) = institution_id
           OR EXISTS (
             SELECT 1 FROM public.profiles p
             WHERE p.id = (SELECT auth.uid()) AND p.institution_id = %1$I.institution_id
           )
           OR public.is_super_admin()
         )
         WITH CHECK (
           (SELECT auth.uid()) = institution_id
           OR EXISTS (
             SELECT 1 FROM public.profiles p
             WHERE p.id = (SELECT auth.uid()) AND p.institution_id = %1$I.institution_id
           )
           OR public.is_super_admin()
         );',
        t
      );
    END IF;
  END LOOP;
END $$;

-- 4B. `institutions` table RLS
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'institutions') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'institutions' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.institutions;', pol.policyname);
    END LOOP;

    CREATE POLICY "Tenant isolation institutions select" ON public.institutions
      FOR SELECT TO authenticated
      USING (
        id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid()) AND p.institution_id = institutions.id
        )
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation institutions insert" ON public.institutions
      FOR INSERT TO authenticated
      WITH CHECK (
        id = (SELECT auth.uid())
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation institutions update" ON public.institutions
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid()) AND p.institution_id = institutions.id AND p.role IN ('admin', 'super_admin', 'manager')
        )
        OR public.is_super_admin()
      )
      WITH CHECK (
        id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid()) AND p.institution_id = institutions.id AND p.role IN ('admin', 'super_admin', 'manager')
        )
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation institutions delete" ON public.institutions
      FOR DELETE TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- 4C. `profiles` table RLS
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname);
    END LOOP;

    CREATE POLICY "Tenant isolation profiles select" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        id = (SELECT auth.uid())
        OR institution_id = (SELECT auth.uid())
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation profiles insert" ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (
        id = (SELECT auth.uid())
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation profiles update" ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT auth.uid())
        OR public.is_super_admin()
      )
      WITH CHECK (
        id = (SELECT auth.uid())
        OR public.is_super_admin()
      );

    CREATE POLICY "Tenant isolation profiles delete" ON public.profiles
      FOR DELETE TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- 4D. Child tables linked via `meeting_id` (`meeting_agendas`, `meeting_decisions`, `meeting_attendance` if without institution_id)
DO $$
DECLARE
  t text;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['meeting_agendas', 'meeting_decisions', 'meeting_attendance'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t)
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t AND column_name = 'institution_id'
       )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t AND column_name = 'meeting_id'
       )
    THEN
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY "Tenant isolation %1$s" ON public.%1$I
         FOR ALL TO authenticated
         USING (
           EXISTS (
             SELECT 1 FROM public.meetings m
             WHERE m.id = %1$I.meeting_id
               AND (
                 m.institution_id = (SELECT auth.uid())
                 OR EXISTS (
                   SELECT 1 FROM public.profiles p
                   WHERE p.id = (SELECT auth.uid()) AND p.institution_id = m.institution_id
                 )
                 OR public.is_super_admin()
               )
           )
         )
         WITH CHECK (
           EXISTS (
             SELECT 1 FROM public.meetings m
             WHERE m.id = %1$I.meeting_id
               AND (
                 m.institution_id = (SELECT auth.uid())
                 OR EXISTS (
                   SELECT 1 FROM public.profiles p
                   WHERE p.id = (SELECT auth.uid()) AND p.institution_id = m.institution_id
                 )
                 OR public.is_super_admin()
               )
           )
         );',
        t
      );
    END IF;
  END LOOP;
END $$;

-- 4E. `poll_votes` table RLS (linked via `poll_id` -> `polls.institution_id`)
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poll_votes') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_votes' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.poll_votes;', pol.policyname);
    END LOOP;

    CREATE POLICY "Tenant isolation poll_votes" ON public.poll_votes
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.polls pl
          WHERE pl.id = poll_votes.poll_id
            AND (
              pl.institution_id = (SELECT auth.uid())
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.institution_id = pl.institution_id
              )
              OR public.is_super_admin()
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.polls pl
          WHERE pl.id = poll_votes.poll_id
            AND (
              pl.institution_id = (SELECT auth.uid())
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.institution_id = pl.institution_id
              )
              OR public.is_super_admin()
            )
        )
      );
  END IF;
END $$;

-- 4F. Global / Super-Admin tables (`system_settings`, `admin_sms_stock`, `tutorials`)
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_settings' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_settings;', pol.policyname);
    END LOOP;

    CREATE POLICY "Authenticated read system_settings" ON public.system_settings
      FOR SELECT TO authenticated
      USING (true);

    CREATE POLICY "Super admin write system_settings" ON public.system_settings
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_sms_stock') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_sms_stock' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_sms_stock;', pol.policyname);
    END LOOP;

    CREATE POLICY "Super admin access admin_sms_stock" ON public.admin_sms_stock
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutorials') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tutorials' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.tutorials;', pol.policyname);
    END LOOP;

    CREATE POLICY "Authenticated read tutorials" ON public.tutorials
      FOR SELECT TO authenticated
      USING (true);

    CREATE POLICY "Super admin manage tutorials" ON public.tutorials
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- ============================================================================
-- 5. LOCK DOWN SECURITY DEFINER RPCs & SET search_path = ''
-- ============================================================================

-- 5.1 handle_new_user & handle_new_auth_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'institution_name',
    NEW.raw_user_meta_data->>'madrasah_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'New Committee'
  );
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- Skip creating a standalone institution if this auth user is a manager
  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'manager' THEN
    INSERT INTO public.profiles (id, institution_id, full_name, role, is_active)
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'institution_id', '')::uuid,
      v_name,
      'manager',
      true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.institutions (id, name, phone, email, is_active, is_super_admin, balance, sms_balance)
  VALUES (
    NEW.id,
    v_name,
    v_phone,
    NEW.email,
    true,
    false,
    0,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE WHEN public.institutions.name = 'New Committee' THEN EXCLUDED.name ELSE public.institutions.name END;

  INSERT INTO public.profiles (id, institution_id, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.id,
    v_name,
    'admin',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.handle_new_user();
END;
$$;

-- 5.2 bootstrap_super_admin (Restricted strictly to existing super_admins)
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: Only an existing Super Admin can invoke bootstrap_super_admin.';
  END IF;

  INSERT INTO public.institutions (id, email, name, is_super_admin, is_active, subscription_status)
  VALUES (p_user_id, p_email, 'Super Admin', true, true, 'active')
  ON CONFLICT (id) DO UPDATE
  SET is_super_admin = true, is_active = true, email = EXCLUDED.email;

  INSERT INTO public.profiles (id, institution_id, full_name, role, is_active)
  VALUES (p_user_id, p_user_id, 'Super Admin', 'super_admin', true)
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', is_active = true;
END;
$$;

-- 5.3 delete_user_by_admin
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.profiles WHERE id = target_user_id OR institution_id = target_user_id;
  DELETE FROM public.institutions WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 5.4 update_user_by_admin
CREATE OR REPLACE FUNCTION public.update_user_by_admin(target_user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- 5.5 create_user_by_admin
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  email text,
  password text,
  user_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  new_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    email,
    extensions.crypt(password, extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    COALESCE(user_metadata, '{}'::jsonb),
    now(),
    now()
  );

  RETURN new_id;
END;
$$;

-- 5.6 approve_payment_with_sms
CREATE OR REPLACE FUNCTION public.approve_payment_with_sms(
  t_id uuid,
  m_id uuid,
  sms_to_give integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_stock INT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT remaining_sms INTO current_stock FROM public.admin_sms_stock LIMIT 1;

  IF current_stock IS NULL OR current_stock < sms_to_give THEN
    RETURN json_build_object('success', false, 'error', 'অ্যাডমিন স্টকে পর্যাপ্ত এসএমএস নেই!');
  END IF;

  UPDATE public.admin_sms_stock
  SET remaining_sms = remaining_sms - sms_to_give, updated_at = NOW();

  UPDATE public.institutions
  SET sms_balance = COALESCE(sms_balance, 0) + sms_to_give
  WHERE id = m_id;

  UPDATE public.transactions
  SET status = 'approved'
  WHERE id = t_id AND institution_id = m_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 5.7 send_bulk_sms_rpc (Safe empty array check + tenant authorization)
CREATE OR REPLACE FUNCTION public.send_bulk_sms_rpc(
  p_institution_id uuid,
  p_student_ids uuid[],
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_current_balance integer;
BEGIN
  IF NOT public.user_belongs_to_institution(p_institution_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Unauthorized institution access');
  END IF;

  v_count := COALESCE(array_length(p_student_ids, 1), 0);

  IF v_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No recipients specified');
  END IF;

  SELECT COALESCE(sms_balance, 0) INTO v_current_balance
  FROM public.institutions
  WHERE id = p_institution_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Institution not found');
  END IF;

  IF v_current_balance < v_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient SMS balance');
  END IF;

  UPDATE public.institutions
  SET sms_balance = sms_balance - v_count
  WHERE id = p_institution_id;

  RETURN jsonb_build_object(
    'success', true,
    'deducted', v_count,
    'remaining_balance', v_current_balance - v_count
  );
END;
$$;

-- 5.8 check_teacher_login (Verifies hashed PINs via crypt or SHA-256; never returns pin)
DROP FUNCTION IF EXISTS public.check_teacher_login(text, text);

CREATE OR REPLACE FUNCTION public.check_teacher_login(
  p_phone text,
  p_pin text
)
RETURNS TABLE (
  id uuid,
  institution_id uuid,
  name text,
  phone text,
  login_id text,
  is_active boolean,
  permissions jsonb,
  designation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sha256 text;
BEGIN
  IF p_phone IS NULL OR p_pin IS NULL OR length(trim(p_phone)) = 0 OR length(trim(p_pin)) = 0 THEN
    RETURN;
  END IF;

  v_sha256 := encode(extensions.digest(p_pin, 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    e.id,
    e.institution_id,
    e.name,
    e.phone,
    e.login_id,
    e.is_active,
    COALESCE(e.permissions, '{}'::jsonb) AS permissions,
    e.designation
  FROM public.executives e
  WHERE (e.phone = p_phone OR e.login_id = p_phone)
    AND e.is_active = true
    AND e.pin IS NOT NULL
    AND (
      -- 1. bcrypt / pgcrypto crypt hash
      (e.pin LIKE '$2%' AND e.pin = extensions.crypt(p_pin, e.pin))
      -- 2. SHA-256 hex hash (used by API / client)
      OR e.pin = v_sha256
      -- 3. Direct match if caller already passed SHA-256 hash or legacy plaintext PIN
      OR e.pin = p_pin
    )
  LIMIT 1;
END;
$$;

-- 5.9 get_attendance_report & get_monthly_dues_report
CREATE OR REPLACE FUNCTION public.get_attendance_report(
  p_institution_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  member_id uuid,
  member_name text,
  total_meetings bigint,
  present_count bigint,
  absent_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.user_belongs_to_institution(p_institution_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.member_name,
    COUNT(ma.id) AS total_meetings,
    COUNT(ma.id) FILTER (WHERE ma.status = 'present') AS present_count,
    COUNT(ma.id) FILTER (WHERE ma.status = 'absent') AS absent_count
  FROM public.members m
  LEFT JOIN public.meeting_attendance ma ON ma.member_id = m.id
  LEFT JOIN public.meetings mt ON mt.id = ma.meeting_id
    AND mt.meeting_date BETWEEN p_start_date AND p_end_date
  WHERE m.institution_id = p_institution_id
  GROUP BY m.id, m.member_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_dues_report(
  p_institution_id uuid,
  p_department_id uuid,
  p_month text
)
RETURNS TABLE (
  member_id uuid,
  member_name text,
  amount_due numeric,
  amount_paid numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.user_belongs_to_institution(p_institution_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.member_name,
    COALESCE(md.amount, 0) AS amount_due,
    COALESCE(md.paid_amount, 0) AS amount_paid,
    COALESCE(md.status, 'unpaid') AS status
  FROM public.members m
  LEFT JOIN public.member_dues md
    ON md.member_id = m.id AND md.month = p_month
  WHERE m.institution_id = p_institution_id
    AND (p_department_id IS NULL OR m.department_id = p_department_id);
END;
$$;

-- 5.10 Ensure ALL public functions have search_path = '' to eliminate function_search_path_mutable lint warnings
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = '''';', fn.func_sig);
  END LOOP;
END $$;

-- 5.11 REVOKE EXECUTE FROM PUBLIC & anon on sensitive RPCs, GRANT only to authenticated / service_role
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS func_sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'delete_user_by_admin',
        'update_user_by_admin',
        'create_user_by_admin',
        'bootstrap_super_admin',
        'approve_payment_with_sms',
        'send_bulk_sms_rpc',
        'get_attendance_report',
        'get_monthly_dues_report',
        'drop_policy_if_exists'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', fn.func_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', fn.func_sig);
  END LOOP;
END $$;

-- Allow check_teacher_login to be called by anon/authenticated/service_role for executive PIN login
GRANT EXECUTE ON FUNCTION public.check_teacher_login(text, text) TO anon, authenticated, service_role;

-- ============================================================================
-- 6. PERFORMANCE INDEXES ON FOREIGN KEYS & FREQUENTLY QUERIED COLUMNS
-- ============================================================================

DO $$
DECLARE
  idx_rec RECORD;
BEGIN
  -- Automatically index any foreign-key / tenant column across public tables if not already indexed
  FOR idx_rec IN
    SELECT
      c.table_name,
      c.column_name
    FROM information_schema.columns c
    JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name IN (
        'institution_id',
        'department_id',
        'member_id',
        'student_id',
        'meeting_id',
        'poll_id',
        'template_id',
        'user_id',
        'recorded_by',
        'loan_id',
        'project_id',
        'investment_id',
        'exam_id',
        'subject_id'
      )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I);',
      'idx_' || idx_rec.table_name || '_' || idx_rec.column_name,
      idx_rec.table_name,
      idx_rec.column_name
    );
  END LOOP;
END $$;

-- Additional composite & lookup indexes
CREATE INDEX IF NOT EXISTS idx_notices_institution_pinned_created
  ON public.notices (institution_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_polls_institution_created
  ON public.polls (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_member
  ON public.poll_votes (poll_id, member_id);

COMMIT;
