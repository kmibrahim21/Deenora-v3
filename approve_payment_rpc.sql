-- 1. Create admin_sms_stock table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_sms_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    remaining_sms INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert initial row if empty
INSERT INTO public.admin_sms_stock (remaining_sms)
SELECT 100000
WHERE NOT EXISTS (SELECT 1 FROM public.admin_sms_stock);

-- 3. Function to approve payment and credit SMS to institution
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
    UPDATE public.admin_sms_stock 
    SET remaining_sms = remaining_sms - sms_to_give
    WHERE id = (SELECT id FROM public.admin_sms_stock LIMIT 1);

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
