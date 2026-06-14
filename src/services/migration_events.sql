
-- Migration: Add Rich Event Module
-- Run this in the Supabase SQL Editor to enable event management.

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    venue TEXT,
    event_type TEXT DEFAULT 'General', -- General, Meeting, Seminar, Cultural, Religious, Exam, Holiday, Other
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    organizer TEXT,
    guest_name TEXT,
    status TEXT DEFAULT 'planned', -- planned, ongoing, completed, cancelled
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Settings
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view events of their institution" ON public.events
    FOR SELECT USING (auth.uid() = institution_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND institution_id = events.institution_id
    ));

CREATE POLICY "Admins can manage events of their institution" ON public.events
    FOR ALL USING (auth.uid() = institution_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
