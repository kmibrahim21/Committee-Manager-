-- Add missing columns to institutions if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'is_super_admin') THEN
        ALTER TABLE public.institutions ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'institution_type') THEN
        ALTER TABLE public.institutions ADD COLUMN institution_type TEXT DEFAULT 'madrasah';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'login_code') THEN
        ALTER TABLE public.institutions ADD COLUMN login_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'balance') THEN
        ALTER TABLE public.institutions ADD COLUMN balance DECIMAL(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'sms_balance') THEN
        ALTER TABLE public.institutions ADD COLUMN sms_balance INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update the handle_new_auth_user function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- Create institution first if it doesn't exist
  INSERT INTO public.institutions (id, name, email, is_super_admin)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'madrasah_name', new.raw_user_meta_data->>'name', 'New Institution'), 
    new.email, 
    false
  )
  ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email;

  -- Create profile
  INSERT INTO public.profiles (id, institution_id, full_name, role)
  VALUES (
    new.id, 
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'User'), 
    'org_admin'
  )
  ON CONFLICT (id) DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    full_name = EXCLUDED.full_name;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
