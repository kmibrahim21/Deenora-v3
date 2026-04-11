-- Update send_bulk_sms_rpc to use sms_rate
CREATE OR REPLACE FUNCTION public.send_bulk_sms_rpc(
  p_institution_id UUID,
  p_student_ids UUID[],
  p_message TEXT
) RETURNS JSONB AS $$
DECLARE
  v_total_sms INTEGER;
  v_current_balance NUMERIC;
  v_sms_rate NUMERIC;
  v_total_cost NUMERIC;
BEGIN
  v_total_sms := array_length(p_student_ids, 1);
  
  -- Get current balance and sms_rate
  SELECT balance, COALESCE(sms_rate, 0.50) INTO v_current_balance, v_sms_rate 
  FROM institutions WHERE id = p_institution_id;
  
  v_total_cost := v_total_sms * v_sms_rate;
  
  IF v_current_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct balance
  UPDATE institutions SET balance = balance - v_total_cost WHERE id = p_institution_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deduct_balance function
CREATE OR REPLACE FUNCTION public.deduct_balance(p_institution_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the balance only if there is sufficient balance
  UPDATE public.institutions
  SET balance = balance - p_amount
  WHERE id = p_institution_id AND balance >= p_amount;

  -- If no rows were updated, it means either the institution doesn't exist or balance is insufficient
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance or institution not found';
  END IF;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
