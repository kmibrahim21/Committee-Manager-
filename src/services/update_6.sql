-- Add missing update policies for institutions and profiles
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update their own institution" ON public.institutions;
    CREATE POLICY "Users can update their own institution" ON public.institutions FOR UPDATE USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1) OR id = auth.uid());

    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid() OR institution_id = auth.uid());
    
    -- update the select profile too
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR institution_id = auth.uid());
END $$;
NOTIFY pgrst, 'reload schema';
