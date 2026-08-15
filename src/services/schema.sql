
-- ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. INSTITUTIONS TABLE
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    logo_url TEXT,
    institution_type TEXT DEFAULT 'madrasah',
    config_json JSONB DEFAULT '{}'::jsonb,
    theme TEXT DEFAULT 'default',
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    is_super_admin BOOLEAN DEFAULT false,
    balance DECIMAL(12,2) DEFAULT 0,
    sms_balance INTEGER DEFAULT 0,
    login_code TEXT,
    subscription_end DATE,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT,
    voice_sender_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PROFILES TABLE (Links Auth Users to Institutions)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    full_name TEXT,
    role TEXT DEFAULT 'org_admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DEPARTMENTS (Formerly Classes)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. MEMBERS (Students/Users of the institution)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    roll INTEGER,
    guardian_name TEXT,
    phone TEXT,
    guardian_phone_2 TEXT,
    address TEXT,
    email TEXT,
    photo_url TEXT,
    member_type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. EXECUTIVES (Teachers/Staff)
CREATE TABLE IF NOT EXISTS public.executives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    pin TEXT NOT NULL,
    designation TEXT,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL, -- 'present', 'absent', 'late'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. LEDGER (Finance)
CREATE TABLE IF NOT EXISTS public.ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    description TEXT,
    type TEXT DEFAULT 'credit',
    amount DECIMAL(12,2) NOT NULL,
    transaction_id TEXT,
    transaction_type TEXT NOT NULL, -- 'income', 'expense'
    category TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SMS TEMPLATES
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TRANSACTIONS (Wallet & SMS Purchases)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    transaction_id TEXT,
    sms_count INTEGER DEFAULT 0,
    payment_method TEXT,
    sender_phone TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    description TEXT,
    type TEXT DEFAULT 'credit',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    bkash_number TEXT,
    voice_rate DECIMAL(10,4) DEFAULT 0.50,
    sms_rate DECIMAL(10,4) DEFAULT 0.25,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
INSERT INTO public.system_settings (id, bkash_number) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '01700000000') ON CONFLICT DO NOTHING;

-- 11. ADMIN SMS STOCK
CREATE TABLE IF NOT EXISTS public.admin_sms_stock (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000002'::uuid,
    remaining_sms INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
INSERT INTO public.admin_sms_stock (id, remaining_sms) VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 0) ON CONFLICT DO NOTHING;

-- 12. VOICE TEMPLATES
CREATE TABLE IF NOT EXISTS public.voice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    audio_url TEXT,
    provider_voice_id TEXT,
    provider_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. VOICE BROADCASTS
CREATE TABLE IF NOT EXISTS public.voice_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.voice_templates(id) ON DELETE SET NULL,
    total_recipients INTEGER DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS POLICIES (Simplified for common usage)
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sms_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_broadcasts ENABLE ROW LEVEL SECURITY;

-- Helper function to bypass RLS for role checks without querying tables
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email') IN ('kmibrahim@gmail.com', 'thedevomix@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dynamic Policy Drops and Creates
DO $$ 
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for super admins" ON public.%I', row.tablename);
        EXECUTE format('CREATE POLICY "Enable all access for super admins" ON public.%I FOR ALL USING (public.is_super_admin())', row.tablename);
        
        IF row.tablename IN ('departments', 'members', 'executives', 'attendance', 'ledger', 'sms_templates', 'transactions', 'voice_templates', 'voice_broadcasts') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Institution members all access" ON public.%I', row.tablename);
            EXECUTE format('CREATE POLICY "Institution members all access" ON public.%I FOR ALL USING (institution_id = auth.uid() OR institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))', row.tablename);
        END IF;
    END LOOP;
END $$;

-- Specific policies for institutions
DROP POLICY IF EXISTS "Users can view their own institution" ON public.institutions;
CREATE POLICY "Users can view their own institution" ON public.institutions FOR SELECT USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()) OR id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own institution" ON public.institutions;
CREATE POLICY "Users can update their own institution" ON public.institutions FOR UPDATE USING (id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()) OR id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR institution_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid() OR institution_id = auth.uid());

-- TRIGGER FOR NEW USERS
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- RPC: BOOTSTRAP SUPER ADMIN
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(p_uid UUID, p_email TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO public.institutions (id, name, email, is_super_admin, institution_type)
  VALUES (p_uid, 'Super Admin', p_email, true, 'system')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, institution_id, full_name, role)
  VALUES (p_uid, p_uid, 'Super Admin', 'super_admin')
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: APPROVE PAYMENT WITH SMS
CREATE OR REPLACE FUNCTION public.approve_payment_with_sms(t_id UUID, m_id UUID, sms_to_give INTEGER)
RETURNS JSON AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- 1. Check stock
    SELECT remaining_sms INTO current_stock FROM public.admin_sms_stock WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
    
    IF current_stock < sms_to_give THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient system SMS stock');
    END IF;

    -- 2. Update Transaction
    UPDATE public.transactions SET status = 'approved', sms_count = sms_to_give WHERE id = t_id;
    
    -- 3. Update Institution Balance
    UPDATE public.institutions SET sms_balance = sms_balance + sms_to_give WHERE id = m_id;
    
    -- 4. Deduct from Admin Stock
    UPDATE public.admin_sms_stock SET remaining_sms = remaining_sms - sms_to_give WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: CREATE USER BY ADMIN
CREATE OR REPLACE FUNCTION public.create_user_by_admin(p_email TEXT, p_password TEXT, p_user_data JSONB)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    ident_id UUID;
BEGIN
    new_user_id := uuid_generate_v4();

    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        p_user_data,
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    ident_id := uuid_generate_v4();
    -- Insert into auth.identities to ensure the user can actually login
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
        ident_id,
        new_user_id::text,
        new_user_id,
        format('{"sub":"%s","email":"%s"}', new_user_id::text, p_email)::jsonb,
        'email',
        now(),
        now(),
        now()
    );

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: UPDATE USER BY ADMIN
CREATE OR REPLACE FUNCTION public.update_user_by_admin(p_user_id UUID, p_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auth.users 
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: DELETE USER BY ADMIN
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: CHECK TEACHER LOGIN
DROP FUNCTION IF EXISTS public.check_teacher_login(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.check_teacher_login(p_phone TEXT, p_pin TEXT)
RETURNS SETOF public.executives AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM public.executives 
    WHERE phone = p_phone AND pin = p_pin AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: GET MONTHLY DUES REPORT
DROP FUNCTION IF EXISTS public.get_monthly_dues_report(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.get_monthly_dues_report(
    p_institution_id UUID,
    p_class_id UUID DEFAULT NULL,
    p_month TEXT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_roll INTEGER,
    department_id UUID,
    department_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id::UUID as student_id,
        m.name::TEXT as student_name,
        m.roll::INTEGER as student_roll,
        m.department_id::UUID as department_id,
        d.name::TEXT as department_name
    FROM public.members m
    LEFT JOIN public.departments d ON m.department_id = d.id
    WHERE m.institution_id = p_institution_id
    AND (p_class_id IS NULL OR m.department_id = p_class_id)
    ORDER BY d.sort_order ASC, m.roll ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.send_bulk_sms_rpc(
  p_institution_id UUID,
  p_student_ids UUID[],
  p_message TEXT
)
RETURNS JSON AS $$
DECLARE
  v_sms_count INTEGER;
  v_current_balance INTEGER;
BEGIN
  -- 1. Check if caller has permission
  IF NOT (
    public.is_super_admin() OR 
    auth.uid() = p_institution_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND institution_id = p_institution_id)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  v_sms_count := array_length(p_student_ids, 1);
  
  -- 2. Check balance
  SELECT sms_balance INTO v_current_balance FROM public.institutions WHERE id = p_institution_id;
  
  IF v_current_balance < v_sms_count THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient SMS balance');
  END IF;
  
  -- 3. Deduct balance
  UPDATE public.institutions 
  SET sms_balance = sms_balance - v_sms_count
  WHERE id = p_institution_id;
  
  -- 4. Record transaction (optional but good)
  INSERT INTO public.transactions (
    institution_id, 
    amount, 
    transaction_id, 
    sender_phone, 
    description, 
    type, 
    status, 
    sms_count
  ) VALUES (
    p_institution_id,
    0,
    'BULK_SMS_' || floor(extract(epoch from now())),
    'SYSTEM',
    'Sent ' || v_sms_count || ' SMS messages',
    'debit',
    'approved',
    v_sms_count
  );

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
