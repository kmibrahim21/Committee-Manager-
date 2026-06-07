-- Fix: DROP FUNCTION check_teacher_login because we can't change the return type directly
DROP FUNCTION IF EXISTS public.check_teacher_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.check_teacher_login(p_phone TEXT, p_pin TEXT)
RETURNS SETOF public.executives AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM public.executives 
    WHERE phone = p_phone AND pin = p_pin AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
