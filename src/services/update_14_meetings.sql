
-- Add meetings table (Updated with venue and time)
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME,
    venue TEXT,
    description TEXT,
    agenda TEXT,
    status TEXT DEFAULT 'planned', -- planned, ongoing, completed, cancelled
    minutes_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add meeting_agendas table for granular topics
CREATE TABLE IF NOT EXISTS public.meeting_agendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add meeting_decisions table
CREATE TABLE IF NOT EXISTS public.meeting_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Institution members all access meetings" ON public.meetings;
CREATE POLICY "Institution members all access meetings" ON public.meetings 
FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Enable all access for super admins on meetings" ON public.meetings;
CREATE POLICY "Enable all access for super admins on meetings" ON public.meetings FOR ALL USING (public.is_super_admin());

NOTIFY pgrst, 'reload schema';

-- Add meeting_attendance table
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'present', -- present, absent, late, excused
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(meeting_id, member_id)
);

-- Enable RLS
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Institution members all access meeting_attendance" ON public.meeting_attendance;
CREATE POLICY "Institution members all access meeting_attendance" ON public.meeting_attendance 
FOR ALL USING (
    meeting_id IN (SELECT id FROM public.meetings WHERE institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
);

DROP POLICY IF EXISTS "Enable all access for super admins on meeting_attendance" ON public.meeting_attendance;
CREATE POLICY "Enable all access for super admins on meeting_attendance" ON public.meeting_attendance FOR ALL USING (public.is_super_admin());

