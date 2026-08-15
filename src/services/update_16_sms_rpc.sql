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
