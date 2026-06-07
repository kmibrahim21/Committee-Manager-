-- Add missing sort_order column to departments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'sort_order') THEN
        ALTER TABLE public.departments ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
