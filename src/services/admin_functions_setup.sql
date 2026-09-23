-- ================================================================
-- Supabase Super Admin Functions (Run in Supabase -> SQL Editor)
-- ================================================================

-- 1. Enable pgcrypto and uuid-ossp extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. RPC: CREATE USER BY ADMIN
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    p_email TEXT, 
    p_password TEXT, 
    p_user_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    ident_id UUID;
BEGIN
    new_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
        instance_id, 
        id, 
        aud, 
        role, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        recovery_sent_at, 
        last_sign_in_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        created_at, 
        updated_at, 
        confirmation_token, 
        email_change, 
        email_change_token_new, 
        recovery_token
    )
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
        '{"provider":"email","providers":["email"]}'::jsonb,
        p_user_data,
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    ident_id := gen_random_uuid();
    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id, 
        provider_id, 
        user_id, 
        identity_data, 
        provider, 
        last_sign_in_at, 
        created_at, 
        updated_at
    )
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

-- 3. RPC: UPDATE USER BY ADMIN (Password change)
CREATE OR REPLACE FUNCTION public.update_user_by_admin(
    p_user_id UUID, 
    p_password TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auth.users 
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: DELETE USER BY ADMIN
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant Permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.create_user_by_admin(TEXT, TEXT, JSONB) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.update_user_by_admin(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated, service_role;

-- 6. Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
