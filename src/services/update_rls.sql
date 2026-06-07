-- Complete Row Level Security (RLS) policies update specifically for Admin/Institution users.

DO $$ 
DECLARE
    row record;
BEGIN
    -- 1. Grant all necessary RLS select/insert/update/delete for tables based on institution_id
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('departments', 'members', 'executives', 'attendance', 'ledger', 'sms_templates', 'transactions', 'voice_templates', 'voice_broadcasts') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Institution members all access" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Institution members all access" ON public.%I FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))', row.tablename);
    END LOOP;

    -- 2. Institutions table policies
    DROP POLICY IF EXISTS "Users can view their own institution" ON public.institutions;
    CREATE POLICY "Users can view their own institution" ON public.institutions FOR SELECT USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1) OR id = auth.uid());

    DROP POLICY IF EXISTS "Users can update their own institution" ON public.institutions;
    CREATE POLICY "Users can update their own institution" ON public.institutions FOR UPDATE USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1) OR id = auth.uid());

    -- 3. Profiles table policies
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR institution_id = auth.uid());

    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid() OR institution_id = auth.uid());

    -- 4. Enable all access for super_admin on all public tables
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for super admins" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Enable all access for super admins" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''super_admin''))', row.tablename);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
