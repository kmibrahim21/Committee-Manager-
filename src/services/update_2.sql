-- Fix for user login from admin panel not working
-- We need to make sure auth.identities contains a row so email/password sign-in works.

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
