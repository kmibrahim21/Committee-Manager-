-- Clean up old functions and fix infinite recursion in RLS policies

-- 1. Drop the old function
DROP FUNCTION IF EXISTS public.get_current_role();

-- 2. Create the new, safe is_super_admin function that only reads from the JWT
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email') IN ('kmibrahim@gmail.com', 'thedevomix@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update all super_admin policies to use the safe function
DO $$ 
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for super admins" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Enable all access for super admins" ON public.%I FOR ALL USING (public.is_super_admin())', row.tablename);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
