CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_students bigint;
  total_classes bigint;
  total_alloc_sms numeric;
  total_revenue numeric;
  total_wallet_sms numeric;
  total_voice_bal numeric;
  active_insts bigint;
  total_insts bigint;
  pending_approvals bigint;
  admin_stock bigint;
  madrasah_c bigint;
  school_c bigint;
  kindergarten_c bigint;
  choching_c bigint;
BEGIN
  -- Simple counts
  SELECT count(*) INTO total_students FROM students;
  SELECT count(*) INTO total_classes FROM classes;
  
  -- Institution stats
  SELECT 
    count(*),
    count(CASE WHEN is_active THEN 1 END),
    COALESCE(sum(sms_balance), 0),
    COALESCE(sum(balance), 0),
    count(CASE WHEN institution_type = 'madrasah' THEN 1 END),
    count(CASE WHEN institution_type = 'school' THEN 1 END),
    count(CASE WHEN institution_type = 'kindergarten' THEN 1 END),
    count(CASE WHEN institution_type = 'choching' THEN 1 END)
  INTO 
    total_insts, active_insts, total_wallet_sms, total_voice_bal,
    madrasah_c, school_c, kindergarten_c, choching_c
  FROM institutions WHERE is_super_admin = false;

  -- Transactions stats
  SELECT 
    COALESCE(sum(sms_count), 0),
    COALESCE(sum(amount), 0)
  INTO total_alloc_sms, total_revenue
  FROM transactions WHERE status = 'approved';

  SELECT count(*) INTO pending_approvals FROM transactions WHERE status = 'pending';
  
  -- Admin Stock
  SELECT remaining_sms INTO admin_stock FROM admin_sms_stock LIMIT 1;
  IF admin_stock IS NULL THEN admin_stock := 0; END IF;

  result := json_build_object(
    'totalStudents', coalesce(total_students, 0),
    'totalClasses', coalesce(total_classes, 0),
    'totalDistributedSMS', coalesce(total_alloc_sms, 0),
    'totalSentSMS', greatest(0, coalesce(total_alloc_sms, 0) - coalesce(total_wallet_sms, 0)),
    'currentInUserWallets', coalesce(total_wallet_sms, 0),
    'totalRevenue', coalesce(total_revenue, 0),
    'pendingApprovals', coalesce(pending_approvals, 0),
    'totalInstitutions', coalesce(total_insts, 0),
    'activeInstitutions', coalesce(active_insts, 0),
    'totalVoiceBalance', coalesce(total_voice_bal, 0),
    'adminSMSStock', coalesce(admin_stock, 0),
    'typeBreakdown', json_build_object(
      'madrasah', coalesce(madrasah_c, 0),
      'school', coalesce(school_c, 0),
      'kindergarten', coalesce(kindergarten_c, 0),
      'choching', coalesce(choching_c, 0)
    )
  );

  RETURN result;
END;
$$;
