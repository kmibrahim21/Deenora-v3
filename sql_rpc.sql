CREATE OR REPLACE FUNCTION claim_voice_refund(
  p_institution_id UUID,
  p_amount NUMERIC,
  p_tx_id TEXT,
  p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- We use the hashtext(p_tx_id) to acquire a transaction-level lock
  -- This blocks concurrent executions for the same tx_id
  PERFORM pg_advisory_xact_lock(hashtext(p_tx_id));
  
  -- Check if transaction already exists
  SELECT EXISTS(SELECT 1 FROM transactions WHERE transaction_id = p_tx_id) INTO v_exists;
  
  IF v_exists THEN
    RETURN FALSE;
  END IF;

  -- Insert transaction
  INSERT INTO transactions (
    institution_id, amount, transaction_id, sender_phone, description, type, status, module, sms_count
  ) VALUES (
    p_institution_id, p_amount, p_tx_id, 'SYSTEM', p_description, 'credit', 'approved', 'voice', 0
  );

  -- Update balance
  UPDATE institutions 
  SET balance = balance + p_amount 
  WHERE id = p_institution_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
