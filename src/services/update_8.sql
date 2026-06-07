-- Fix RLS Infinite Recursion by using a SECURITY DEFINER function

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for super admins" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Enable all access for super admins" ON public.%I FOR ALL USING (public.get_current_role() = ''super_admin'')', row.tablename);
    END LOOP;
END $$;
