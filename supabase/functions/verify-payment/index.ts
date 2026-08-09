import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Supabase Edge Function: verify-payment
 * 
 * Automatically verifies a payment by matching a pending transaction in the database
 * with the payment details received from a payment gateway.
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase Client with Service Role Key for elevated permissions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse Request Body (supporting flexible case and variable naming)
    const body = await req.json()
    
    // Extract parameters
    const amount = body.amount
    const transaction_id = body.transaction_id || body.transactionId
    const sender_phone = body.sender_phone || body.sender_number || body.senderPhone || body.senderNumber
    const payment_method = body.payment_method || body.paymentMethod || body.method
    const received_at = body.received_at || body.sms_time || body.smsTime || body.receivedAt

    // 3. LOG THE RECEIVED PAYLOAD SAFELY (no secrets, safe fields only)
    console.log(`verify-payment request: amount=${amount}, sender_phone=${sender_phone}, payment_method=${payment_method}, transaction_id=${transaction_id}, received_at=${received_at}`);

    // 4. VERIFY EXACT REQUEST SCHEMA & 2. DETAILED JSON ERRORS FOR MISSING FIELDS
    if (amount === undefined || amount === null || amount === "") {
      console.error(`[Payment Verification] Missing required field: amount`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required field: amount',
        code: 'MISSING_FIELD_AMOUNT'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!transaction_id) {
      console.error(`[Payment Verification] Missing required field: transaction_id`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required field: transaction_id',
        code: 'MISSING_FIELD_TRANSACTION_ID'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!sender_phone) {
      console.error(`[Payment Verification] Missing required field: sender_phone`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required field: sender_phone',
        code: 'MISSING_FIELD_SENDER_PHONE'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Helper: Normalize Phone Number (e.g., +88017... -> 017...)
    const normalizePhone = (phone: string) => {
      let clean = phone.replace(/[^\d]/g, '');
      if (clean.startsWith('880')) {
        clean = clean.substring(2);
      }
      if (!clean.startsWith('0') && clean.length === 10) {
        clean = '0' + clean;
      }
      return clean;
    };

    // Helper: Robust Amount Parser (Tk 20.00 -> 20)
    const normalizeAmount = (amt: any): number => {
      if (typeof amt === 'number') return amt;
      if (typeof amt === 'string') {
        let clean = amt.replace(/[^\d.]/g, '');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const parsedAmount = Math.round(normalizeAmount(amount));
    const normalizedSender = normalizePhone(sender_phone);
    const normalizedMethod = (payment_method || '').toLowerCase();

    // 10. VERIFY TRANSACTION ID (Duplicate Check)
    // Check if this Provider TrxID has already been approved for ANY transaction
    const { data: existingTrx, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_id', transaction_id)
      .eq('status', 'approved')
      .maybeSingle()

    if (existingTrx) {
      console.warn(`[Payment Verification] Duplicate Transaction ID detected: ${transaction_id}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Transaction already processed',
        code: 'DUPLICATE_TRANSACTION',
        duplicate: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // 6. VERIFY PENDING TRANSACTION MATCHING
    // We look for a pending transaction that matches:
    // - status: pending
    // - amount: parsedAmount
    // - sender_phone: normalized sender phone
    // - created within the last 3 days (to prevent stale matches and ensure timing safety)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const dateLimitISO = threeDaysAgo.toISOString();

    console.log(`Pending transaction lookup started`);
    console.log(`[Payment Verification] Query parameters: Amount=${parsedAmount}, Phone=${normalizedSender}, Method=${normalizedMethod}, DateLimit=${dateLimitISO}`);

    let pendingTrx = null;
    let findError = null;

    // Try finding with payment method inside metadata first (for extra safety)
    if (normalizedMethod && normalizedMethod !== 'test') {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('amount', parsedAmount)
        .eq('sender_phone', normalizedSender)
        .eq('metadata->>payment_method', normalizedMethod)
        .gte('created_at', dateLimitISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      pendingTrx = data;
      findError = error;
    }

    // Fallback 1: Search without metadata payment method filter, but with strict sender phone, amount, and pending status
    if (!pendingTrx && !findError) {
      console.log(`[Payment Verification] Strict method matching failed or not applicable. Falling back to phone & amount only...`);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('amount', parsedAmount)
        .eq('sender_phone', normalizedSender)
        .gte('created_at', dateLimitISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      pendingTrx = data;
      findError = error;
    }

    // Fallback 2: If payment method is TEST or transaction starts with TEST_, match any pending test/payment transaction
    if (!pendingTrx && !findError && (normalizedMethod === 'test' || transaction_id.startsWith('TEST_'))) {
      console.log(`[Payment Verification] Test mode. Matching any pending transaction for test sender...`);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('amount', parsedAmount)
        .eq('sender_phone', normalizedSender)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      pendingTrx = data;
      findError = error;
    }

    if (findError) {
      console.error(`[Payment Verification] Database error while finding transaction:`, findError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database error occurred while verifying payment.',
        details: findError.message,
        code: 'DATABASE_ERROR'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (pendingTrx) {
      console.log(`Pending transaction lookup match found. Transaction ID: ${pendingTrx.id}`);
    } else {
      console.warn(`Pending transaction lookup match not found for amount: ${parsedAmount} and sender: ${normalizedSender}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No matching pending transaction found',
        code: 'PENDING_NOT_FOUND',
        debug: {
          success: false,
          status: 'pending_not_found',
          error: 'No matching pending transaction found',
          verification_stage: 'lookup',
          inputs: {
            amount: parsedAmount,
            sender_phone: normalizedSender,
            payment_method: normalizedMethod
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { id: trId, institution_id: instId, module: trxModule } = pendingTrx;

    // 3. Fetch Institution and System Settings
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', instId)
      .single()

    if (instError || !institution) {
      console.error(`[Payment Verification] Institution not found: ${instId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Institution not found: The institution associated with this transaction does not exist.',
        code: 'INSTITUTION_NOT_FOUND'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    // 4. Determine Updates Based on Module
    let resultMessage = 'Payment verified successfully.'
    let updateFields: any = { 
      status: 'approved', 
      transaction_id, 
      sender_phone,
      approved_at: new Date().toISOString(),
      description: (pendingTrx.description || 'Auto-verified payment') + ` (Approved via ${payment_method} at ${new Date().toISOString()})`
    }
    
    let institutionUpdate: any = {}

    if (trxModule === 'sms') {
      // SMS Balance Update
      const smsRate = Number(settings?.sms_rate || 0.5)
      const smsToCredit = pendingTrx.sms_count || Math.ceil(parsedAmount / smsRate)
      
      updateFields.sms_count = smsToCredit
      institutionUpdate.sms_balance = Number(institution.sms_balance || 0) + smsToCredit
      
      resultMessage = `SMS recharge approved: ${smsToCredit} SMS credited.`
    } else if (trxModule === 'voice') {
      // Voice Credits Update (Balance)
      institutionUpdate.balance = Number(institution.balance || 0) + Number(parsedAmount)
      resultMessage = `Voice balance recharge approved: ৳${parsedAmount} credits added.`
    } else if (trxModule === 'subscription') {
      // Subscription Update
      const metadata = pendingTrx.metadata || {}
      const months = metadata.months || []
      
      if (months.length > 0) {
        const config = institution.config_json || {}
        const currentPaidMonths = config.paid_months || []
        const updatedPaidMonths = Array.from(new Set([...currentPaidMonths, ...months])).sort()
        
        // Calculate new subscription end date (last day of the furthest month)
        const lastMonthStr = updatedPaidMonths[updatedPaidMonths.length - 1]
        const [year, month] = lastMonthStr.split('-').map(Number)
        const lastDay = new Date(year, month, 0)
        
        institutionUpdate.config_json = {
          ...config,
          paid_months: updatedPaidMonths,
          package_name: metadata.package_name || config.package_name,
          package_rate: metadata.package_rate || config.package_rate,
          subscription_type: metadata.subscription_type || config.subscription_type
        }
        institutionUpdate.subscription_end = lastDay.toISOString()
        institutionUpdate.status = 'active'
        resultMessage = `Subscription approved until ${lastMonthStr}.`
      } else {
        // Fallback for subscription if metadata is missing
        institutionUpdate.status = 'active'
        resultMessage = `Subscription status activated.`
      }
    }

    // 5. Execute Updates (Atomic Sequential)
    console.log(`[Payment Verification] Approving Transaction ${trId} for Institution ${instId}`);

    const { error: updateTrError } = await supabase
      .from('transactions')
      .update(updateFields)
      .eq('id', trId)

    if (updateTrError) {
      console.error(`[Payment Verification] Failed to update transaction:`, updateTrError);
      throw updateTrError;
    }

    if (Object.keys(institutionUpdate).length > 0) {
      const { error: updateInstError } = await supabase
        .from('institutions')
        .update(institutionUpdate)
        .eq('id', instId)
      
      if (updateInstError) {
        console.error(`[Payment Verification] Failed to update institution:`, updateInstError);
        // Rollback transaction update
        await supabase.from('transactions').update({ status: 'pending', approved_at: null }).eq('id', trId)
        throw updateInstError;
      }
    }

    // 5.5. Clean up other pending duplicate transactions of the same module for this institution
    if (instId && trxModule) {
      console.log(`[Payment Verification] Cancelling other pending transactions for institution ${instId} and module ${trxModule}`);
      const { error: cancelError } = await supabase
        .from('transactions')
        .update({ 
          status: 'cancelled', 
          description: 'Cancelled automatically because another transaction was approved.' 
        })
        .eq('institution_id', instId)
        .eq('module', trxModule)
        .eq('status', 'pending')
        .neq('id', trId)

      if (cancelError) {
        console.warn(`[Payment Verification] Non-fatal error cancelling other pending transactions:`, cancelError);
      }
    }

    console.log(`[Payment Verification] Success: ${resultMessage}`);

    return new Response(JSON.stringify({
      success: true,
      status: "approved",
      transaction_id: transaction_id,
      matched_transaction_id: trId,
      verification_stage: "completed",
      module: trxModule || 'unknown',
      institution_id: instId,
      message: resultMessage,
      approved_at: updateFields.approved_at
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error(`[Payment Verification] Fatal Error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal Server Error',
      details: error.message,
      code: 'INTERNAL_ERROR'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
