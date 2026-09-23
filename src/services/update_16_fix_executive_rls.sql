-- ================================================================
-- Supabase Update 16: Fix Executive & Member Access & RLS Policies
-- Run this in Supabase SQL Editor to allow executive committee members
-- and portal members to view and interact with data properly.
-- ================================================================

DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'departments', 
        'members', 
        'executives', 
        'attendance', 
        'ledger', 
        'subscriptions', 
        'subscription_structures', 
        'fees', 
        'fee_structures', 
        'meetings', 
        'meeting_attendance', 
        'meeting_minutes', 
        'transactions', 
        'sms_templates', 
        'voice_templates', 
        'voice_broadcasts',
        'events',
        'calendar_events',
        'member_types',
        'notices',
        'polls'
    ];
BEGIN
    -- 1. Ensure public and anon read/write access on institution-scoped tables
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Institution members all access" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Public full access" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Public full access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
            EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
        END IF;
    END LOOP;

    -- 2. Institutions table policies (allow read and update)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'institutions') THEN
        ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public view institutions" ON public.institutions;
        DROP POLICY IF EXISTS "Users can view their own institution" ON public.institutions;
        DROP POLICY IF EXISTS "Users can update their own institution" ON public.institutions;
        DROP POLICY IF EXISTS "Public full access institutions" ON public.institutions;
        CREATE POLICY "Public full access institutions" ON public.institutions FOR ALL USING (true) WITH CHECK (true);
        GRANT ALL ON public.institutions TO anon, authenticated, service_role;
    END IF;

    -- 3. Profiles table policies
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
        CREATE POLICY "Public full access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
        GRANT ALL ON public.profiles TO anon, authenticated, service_role;
    END IF;
END $$;

-- 4. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
