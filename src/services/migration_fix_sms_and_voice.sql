-- Function to approve payment and credit SMS to institution
CREATE OR REPLACE FUNCTION public.approve_payment_with_sms(
    m_id UUID,
    sms_to_give INTEGER,
    t_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_amount DECIMAL(12, 2);
    v_admin_stock INTEGER;
BEGIN
    -- 1. Get transaction amount and check if it's already approved
    SELECT amount INTO v_amount FROM public.transactions WHERE id = t_id AND status = 'pending';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or already processed');
    END IF;

    -- 2. Check admin SMS stock
    SELECT remaining_sms INTO v_admin_stock FROM public.admin_sms_stock LIMIT 1;
    IF v_admin_stock IS NULL OR v_admin_stock < sms_to_give THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient admin SMS stock');
    END IF;

    -- 3. Update transaction status
    UPDATE public.transactions SET status = 'approved', sms_count = sms_to_give WHERE id = t_id;

    -- 4. Update institution balance and SMS count
    UPDATE public.institutions 
    SET balance = balance + v_amount,
        sms_balance = sms_balance + sms_to_give
    WHERE id = m_id;

    -- 5. Deduct from admin SMS stock
    UPDATE public.admin_sms_stock SET remaining_sms = remaining_sms - sms_to_give;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to deduct balance for voice calls or other services
CREATE OR REPLACE FUNCTION public.deduct_balance(
    p_institution_id UUID,
    p_amount DECIMAL(12, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(12, 2);
BEGIN
    -- 1. Get current balance
    SELECT balance INTO v_current_balance FROM public.institutions WHERE id = p_institution_id;
    
    -- 2. Check if balance is sufficient
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- 3. Deduct balance
    UPDATE public.institutions 
    SET balance = balance - p_amount
    WHERE id = p_institution_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Ensure system_settings has a default record if it doesn't exist
INSERT INTO public.system_settings (id, sms_rate, voice_rate)
VALUES ('00000000-0000-0000-0000-000000000001', 0.50, 1.00)
ON CONFLICT (id) DO NOTHING;

-- Ensure admin_sms_stock has a default record if it doesn't exist
INSERT INTO public.admin_sms_stock (remaining_sms)
SELECT 100000 WHERE NOT EXISTS (SELECT 1 FROM public.admin_sms_stock);
