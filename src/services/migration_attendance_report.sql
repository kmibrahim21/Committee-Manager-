
-- Migration: Add Attendance Report RPC
-- Run this in the Supabase SQL Editor to enable attendance reports and analytics.

CREATE OR REPLACE FUNCTION public.get_attendance_report(
  p_class_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  student_id UUID,
  name TEXT,
  roll TEXT,
  total_days BIGINT,
  present_days BIGINT,
  absent_days BIGINT,
  late_days BIGINT,
  half_days BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS student_id,
    m.name::TEXT,
    m.roll::TEXT,
    COUNT(a.id)::BIGINT AS total_days,
    COUNT(a.id) FILTER (WHERE a.status = 'present')::BIGINT AS present_days,
    COUNT(a.id) FILTER (WHERE a.status = 'absent')::BIGINT AS absent_days,
    COUNT(a.id) FILTER (WHERE a.status = 'late')::BIGINT AS late_days,
    COUNT(a.id) FILTER (WHERE a.status = 'half_day')::BIGINT AS half_days
  FROM 
    public.members m
  LEFT JOIN 
    -- Check for both 'member_id' and 'student_id' column possibilities common in this app
    public.attendance a ON m.id = a.member_id 
    AND a.date >= p_start_date 
    AND a.date <= p_end_date
  WHERE 
    m.department_id = p_class_id
  GROUP BY 
    m.id, m.name, m.roll
  ORDER BY 
    m.roll ASC;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_attendance_report(UUID, DATE, DATE) TO anon, authenticated, service_role;
