-- Fix trigger unreliability by creating institution and profile directly in the RPC

CREATE OR REPLACE FUNCTION public.create_user_by_admin(p_email TEXT, p_password TEXT, p_user_data JSONB)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    ident_id UUID;
BEGIN
    new_user_id := uuid_generate_v4();

    -- Insert into auth.users
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

    -- Ensure institution exists (in case trigger fails or is delayed)
    INSERT INTO public.institutions (id, name, email, is_super_admin)
    VALUES (
        new_user_id, 
        COALESCE(p_user_data->>'madrasah_name', p_user_data->>'name', 'New Institution'), 
        p_email, 
        false
    )
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, institution_id, full_name, role)
    VALUES (
        new_user_id, 
        new_user_id, 
        COALESCE(p_user_data->>'name', 'User'), 
        'org_admin'
    )
    ON CONFLICT (id) DO UPDATE SET
        institution_id = EXCLUDED.institution_id,
        full_name = EXCLUDED.full_name;

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
