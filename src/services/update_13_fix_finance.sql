
-- Ensure helper function exists
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email') IN ('kmibrahim@gmail.com', 'thedevomix@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Create fee_structures table
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    fee_name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create fees table
CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    month TEXT NOT NULL, -- Format: YYYY-MM
    status TEXT DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Fix ledger table (Add 'type' if it's missing or handle the 'transaction_type' vs 'type' inconsistency)
-- The code uses 'type' but schema has 'transaction_type'. 
-- Let's add 'type' as an alias or just add the column.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger' AND column_name='type') THEN
        ALTER TABLE public.ledger ADD COLUMN type TEXT;
        -- Move data from transaction_type if exists
        UPDATE public.ledger SET type = transaction_type WHERE type IS NULL;
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies
DROP POLICY IF EXISTS "Institution members all access fee_structures" ON public.fee_structures;
CREATE POLICY "Institution members all access fee_structures" ON public.fee_structures 
FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Institution members all access fees" ON public.fees;
CREATE POLICY "Institution members all access fees" ON public.fees 
FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Enable all access for super admins on fee_structures" ON public.fee_structures;
CREATE POLICY "Enable all access for super admins on fee_structures" ON public.fee_structures FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "Enable all access for super admins on fees" ON public.fees;
CREATE POLICY "Enable all access for super admins on fees" ON public.fees FOR ALL USING (public.is_super_admin());
