
-- Add member_types table
CREATE TABLE IF NOT EXISTS public.member_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, name)
);

-- Enable RLS
ALTER TABLE public.member_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their institution's member types"
    ON public.member_types FOR SELECT
    USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Users can manage their institution's member types"
    ON public.member_types FOR ALL
    USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    WITH CHECK (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
