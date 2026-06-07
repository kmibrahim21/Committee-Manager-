-- Allow institution users full access to their institution data

DO $$ 
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('departments', 'members', 'executives', 'attendance', 'ledger', 'sms_templates', 'transactions', 'voice_templates', 'voice_broadcasts') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Institution members all access" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Institution members all access" ON public.%I FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))', row.tablename);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
