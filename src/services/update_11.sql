-- Explicitly drop the function in case of existing signature mismatches
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

NOTIFY pgrst, 'reload schema';
