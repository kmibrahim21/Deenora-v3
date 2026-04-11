-- Update send_bulk_sms_rpc to use sms_balance
CREATE OR REPLACE FUNCTION public.send_bulk_sms_rpc(
  p_institution_id UUID,
  p_student_ids UUID[],
  p_message TEXT
) RETURNS JSONB AS $$
DECLARE
  v_total_sms INTEGER;
  v_current_sms_balance INTEGER;
BEGIN
  v_total_sms := array_length(p_student_ids, 1);
  
  -- Get current sms_balance
  SELECT sms_balance INTO v_current_sms_balance 
  FROM institutions WHERE id = p_institution_id;
  
  IF v_current_sms_balance < v_total_sms THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient SMS balance');
  END IF;
  
  -- Deduct sms_balance
  UPDATE institutions SET sms_balance = sms_balance - v_total_sms WHERE id = p_institution_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
