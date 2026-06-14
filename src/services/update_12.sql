-- Add detailed member fields to public.members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_id_number TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nid TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS present_address TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS reference TEXT;

-- Update existing address column handling if necessary
-- Current table has 'address', we'll keep it but recommend using present_address for new data
-- or we can link them:
-- UPDATE public.members SET present_address = address WHERE present_address IS NULL AND address IS NOT NULL;
