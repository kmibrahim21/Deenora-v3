import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import * as crypto from 'crypto';
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

export const convertBnToEnDigits = (str: string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str || '').replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
};

export const normalizePhone = (phone: string): string => {
  let clean = convertBnToEnDigits(phone).replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('880')) {
    clean = clean.substring(2);
  }
  if (clean.length === 10 && clean.startsWith('1')) {
    clean = '0' + clean;
  }
  return clean;
};

async function sendSMS(phone: string, text: string, institutionId?: string): Promise<{ success: boolean; response?: any; provider?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    let sysSettings: any = {
      reve_api_key: 'aa407e1c6629da8e',
      reve_secret_key: '91051e7e',
      reve_caller_id: '1234',
      reve_client_id: '',
      automas_api_key: '10f3d0e31061dd30138ef383b2bd49f1',
      automas_non_masking_sender_id: '8809617640326'
    };

    const { data: sysData } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();
    if (sysData) sysSettings = { ...sysSettings, ...sysData };

    const clean = normalizePhone(phone);
    const normPhone = clean.startsWith('88') ? clean : `88${clean}`;

    // 1. Primary: Automas Non-Masking (as requested by user)
    const automasApiKey = (sysSettings.automas_api_key || '10f3d0e31061dd30138ef383b2bd49f1').trim();
    let automasSender = (sysSettings.automas_non_masking_sender_id || '8809617640326').trim();
    if (automasSender.startsWith('0961')) automasSender = `88${automasSender}`;

    if (automasApiKey && automasSender) {
      try {
        const automasUrl = `https://api.automas.com.bd/smsapiv3?apikey=${encodeURIComponent(automasApiKey)}&sender=${encodeURIComponent(automasSender)}&msisdn=${encodeURIComponent(normPhone)}&smstext=${encodeURIComponent(text)}&type=unicode&smsformat=8`;
        console.log(`[Password Reset SMS] Sending via Automas Non-Masking to ${normPhone} with sender ${automasSender}`);
        
        const autoRes = await fetch(automasUrl, { signal: AbortSignal.timeout(8000) });
        const autoText = await autoRes.text();
        console.log('[Password Reset SMS] Automas response:', autoText);

        let parsed: any = null;
        try { parsed = JSON.parse(autoText); } catch (e) {}

        const firstResp = Array.isArray(parsed?.response) ? parsed.response[0] : null;
        const statusVal = firstResp ? Number(firstResp.status) : (parsed?.status !== undefined ? Number(parsed.status) : NaN);

        if (statusVal === 0 || autoText.includes('"status":0') || autoText.toLowerCase().includes('success')) {
          return { success: true, provider: 'automas', response: autoText };
        }
        console.warn('[Password Reset SMS] Automas returned non-zero status, attempting fallback to Reve...');
      } catch (autoErr: any) {
        console.warn('[Password Reset SMS] Automas error, falling back to Reve:', autoErr?.message);
      }
    }

    // 2. Fallback: REVE SMS Gateway
    return new Promise((resolve) => {
      const reveApiKey = (sysSettings.reve_api_key || 'aa407e1c6629da8e').trim();
      const reveSecretKey = (sysSettings.reve_secret_key || '91051e7e').trim();
      const reveSenderId = (sysSettings.reve_caller_id || sysSettings.reve_client_id || '1234').trim() || '1234';

      const url = `https://smpp.revesms.com:7790/sendtext?apikey=${encodeURIComponent(reveApiKey)}&secretkey=${encodeURIComponent(reveSecretKey)}&callerID=${encodeURIComponent(reveSenderId)}&toUser=${encodeURIComponent(normPhone)}&messageContent=${encodeURIComponent(text)}&type=3`;

      console.log(`[Password Reset SMS] Fallback dispatch via Reve to ${normPhone} with callerID: ${reveSenderId}`);

      const req = https.get(url, { agent }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('[Password Reset SMS] Reve Response:', data);
          resolve({ success: true, provider: 'reve', response: data });
        });
      });

      req.on('error', (err) => {
        console.error('[Password Reset SMS] Reve Network Error:', err);
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'SMS Gateway Timeout' });
      });
    });
  } catch (err: any) {
    console.error('Error in sendSMS wrapper:', err);
    return { success: false, error: err.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.body || {};
  const supabase = getSupabaseAdmin();

  if (action === 'request-otp') {
    const { phone, type } = req.body;
    if (!phone) return res.status(400).json({ error: 'ফোন নম্বর দেওয়া আবশ্যক।' });

    const searchPhone = normalizePhone(phone);
    const last10Digits = searchPhone.slice(-10);
    const last8Digits = searchPhone.slice(-8);

    if (searchPhone.length < 10) {
      return res.status(400).json({ error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017...)' });
    }

    let adminMatch = null;

    // 1. Search in institutions table
    const { data: insts } = await supabase
      .from('institutions')
      .select('id, phone, name')
      .or(`phone.eq.${searchPhone},phone.ilike.%${last10Digits}%,phone.ilike.%${last8Digits}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (insts && insts.length > 0) {
      const instIds = insts.map(i => i.id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, role, institution_id')
        .in('institution_id', instIds)
        .in('role', ['madrasah_admin', 'super_admin'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        const inst = insts.find(i => i.id === profile.institution_id) || insts[0];
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        adminMatch = {
          userId: profile.id,
          institutionId: inst.id,
          userEmail: authUser?.user?.email || null
        };
      }
    }

    // 2. Direct fallback: Search in profiles table if phone column exists in profiles
    if (!adminMatch) {
      try {
        const { data: directProfiles } = await supabase
          .from('profiles')
          .select('id, role, institution_id')
          .or(`phone.eq.${searchPhone},phone.ilike.%${last10Digits}%,phone.ilike.%${last8Digits}%`)
          .in('role', ['madrasah_admin', 'super_admin'])
          .limit(1);

        if (directProfiles && directProfiles.length > 0) {
          const profile = directProfiles[0];
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          adminMatch = {
            userId: profile.id,
            institutionId: profile.institution_id,
            userEmail: authUser?.user?.email || null
          };
        }
      } catch (e) {
        // Safe catch if phone column does not exist on profiles table
      }
    }

    if (!adminMatch) {
      return res.status(404).json({ error: 'এই ফোন নম্বরের সাথে কোনো নিবন্ধিত অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins validity

    const { error: otpError } = await supabase
      .from('otp_verifications')
      .insert({ identifier: searchPhone, otp, expires_at: expiresAt });

    if (otpError) {
      console.error('OTP DB Insert Error:', otpError);
      return res.status(500).json({ error: 'ডাটাবেস ত্রুটি! অনুগ্রহ করে পুনরায় চেষ্টা করুন।' });
    }

    // Bengali OTP SMS strictly under 70 characters (Single SMS Unicode)
    const smsText = `দ্বীনোরা পাসওয়ার্ড রিসেট ওটিপি: ${otp}। মেয়াদ ১৫ মিনিট।`;
    const smsRes = await sendSMS(searchPhone, smsText, adminMatch.institutionId || undefined);

    if (!smsRes.success) {
      console.error('SMS Gateway Failure:', smsRes.error);
      return res.status(500).json({ error: `এসএমএস গেটওয়ে ত্রুটি: ${smsRes.error || 'Unknown'}` });
    }

    return res.status(200).json({
      success: true,
      message: 'আপনার ফোনে ওটিপি কোড পাঠানো হয়েছে।',
      userType: 'admin'
    });
  }

  if (action === 'verify-otp') {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'ফোন নম্বর এবং ওটিপি কোড আবশ্যক।' });

    const searchPhone = normalizePhone(phone);
    const cleanOtp = convertBnToEnDigits(String(otp)).trim();

    const { data: otpData } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('identifier', searchPhone)
      .eq('otp', cleanOtp)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpData) {
      return res.status(400).json({ error: 'ভুল ওটিপি কোড অথবা কোডটির মেয়াদ শেষ হয়ে গেছে। আপনার মোবাইলে আসা সর্বশেষ ৬ ডিজিটের কোডটি দিন।' });
    }

    return res.status(200).json({ success: true, message: 'ওটিপি কোড সফলভাবে যাচাই হয়েছে।' });
  }

  if (action === 'verify-otp-reset') {
    const { phone, otp, newPassword, type } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'সবগুলো তথ্য পূরণ করা আবশ্যক।' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
    }

    const searchPhone = normalizePhone(phone);
    const cleanOtp = convertBnToEnDigits(String(otp)).trim();

    const { data: otpData } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('identifier', searchPhone)
      .eq('otp', cleanOtp)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpData) {
      return res.status(400).json({ error: 'ভুল ওটিপি কোড অথবা কোডটির মেয়াদ শেষ হয়ে গেছে।' });
    }

    // Mark all pending OTPs for this phone as verified upon successful reset
    await supabase.from('otp_verifications').update({ verified_at: new Date().toISOString() }).eq('identifier', searchPhone).is('verified_at', null);

    const last10Digits = searchPhone.slice(-10);
    const last8Digits = searchPhone.slice(-8);
    let resetDone = false;
    let adminEmail = '';

    // Reset Admin Account
    let targetProfileId: string | null = null;

    const { data: insts } = await supabase
      .from('institutions')
      .select('id')
      .or(`phone.eq.${searchPhone},phone.ilike.%${last10Digits}%,phone.ilike.%${last8Digits}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (insts && insts.length > 0) {
      const instIds = insts.map(i => i.id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('institution_id', instIds)
        .in('role', ['madrasah_admin', 'super_admin'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (profiles && profiles.length > 0) {
        targetProfileId = profiles[0].id;
      }
    }

    if (!targetProfileId) {
      try {
        const { data: directProfiles } = await supabase
          .from('profiles')
          .select('id')
          .or(`phone.eq.${searchPhone},phone.ilike.%${last10Digits}%,phone.ilike.%${last8Digits}%`)
          .in('role', ['madrasah_admin', 'super_admin'])
          .limit(1);
        if (directProfiles && directProfiles.length > 0) {
          targetProfileId = directProfiles[0].id;
        }
      } catch (e) {}
    }

    if (targetProfileId) {
      const updateRes = await supabase.auth.admin.updateUserById(targetProfileId, { password: newPassword });
      if (!updateRes.error) {
        resetDone = true;
        adminEmail = updateRes.data.user.email || '';
      } else {
        console.error('Failed to update Supabase admin auth:', updateRes.error);
      }
    }

    if (!resetDone) {
      return res.status(500).json({ error: 'অ্যাডমিন পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }

    return res.status(200).json({
      success: true,
      message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!',
      adminEmail: adminEmail || undefined
    });
  }

  if (action === 'admin-login' || action === 'login') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড দেওয়া আবশ্যক।' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: String(password)
      });

      if (authError || !authData?.user) {
        console.error('Server-side auth login error:', authError);
        const errMsg = authError?.message || '';
        if (errMsg.includes('Invalid login credentials')) {
          return res.status(400).json({ error: 'ভুল পাসওয়ার্ড অথবা ইমেইল দিয়েছেন।' });
        }
        if (errMsg.includes('Email not confirmed')) {
          return res.status(400).json({ error: 'ইমেইল এখনও ভেরিফাই করা হয়নি।' });
        }
        return res.status(400).json({ error: authError?.message || 'লগইন ফেইল্ড হয়েছে।' });
      }

      return res.status(200).json({
        success: true,
        user: authData.user,
        session: authData.session
      });
    } catch (err: any) {
      console.error('Auth handler login exception:', err);
      return res.status(500).json({ error: err.message || 'সার্ভারে সমস্যা হচ্ছে, অনুগ্রহ করে পরে চেষ্টা করুন।' });
    }
  }

  return res.status(404).json({ error: 'Action not found' });
}
