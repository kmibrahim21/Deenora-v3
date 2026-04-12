
import { supabase } from 'lib/supabase';
import { Student } from 'types';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from './ShortcodeService';

const normalizePhone = (phone: string): string => {
  let p = phone.replace(/\D/g, ''); 
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  return p;
};

export const SMSService = {
  getGlobalSettings: async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      const defaults = { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234',
        reve_client_id: '',
        sms_rate: 0.50,
        voice_rate: 1.00
      };

      if (!data) return defaults;
      return {
        reve_api_key: (data.reve_api_key || defaults.reve_api_key).trim(),
        reve_secret_key: (data.reve_secret_key || defaults.reve_secret_key).trim(),
        reve_caller_id: (data.reve_caller_id || defaults.reve_caller_id).trim(),
        bkash_number: data.bkash_number || defaults.bkash_number,
        reve_client_id: (data.reve_client_id || defaults.reve_client_id).trim(),
        sms_rate: data.sms_rate || defaults.sms_rate,
        voice_rate: data.voice_rate || defaults.voice_rate
      };
    } catch (e) {
      return { reve_api_key: 'aa407e1c6629da8e', reve_secret_key: '91051e7e', bkash_number: '০১৭৬৬-XXXXXX', reve_caller_id: '1234', reve_client_id: '' };
    }
  },

  sendBulk: async (institutionId: string, students: Student[], message: string) => {
    const [mRes, global] = await Promise.all([
      supabase.from('institutions').select('sms_balance').eq('id', institutionId).single(),
      SMSService.getGlobalSettings()
    ]);

    const mData = mRes.data;
    if (!mData) throw new Error("Security Violation: Unauthorized Institution context.");
    
    // Check for shortcodes
    const hasShortcodes = /\{[a-z_]+\}/gi.test(message);
    let personalizedMessages: { studentId: string, phone: string, text: string, parts: number }[] = [];
    let totalSmsNeeded = 0;

    if (hasShortcodes) {
      const shortcodeData = await ShortcodeService.fetchShortcodeData(institutionId, students.map(s => s.id));
      
      personalizedMessages = students.map(s => {
        const data = shortcodeData.find(d => d.id === s.id) || { student_name: s.student_name, guardian_phone: s.guardian_phone };
        const text = ShortcodeService.replaceShortcodes(message, data);
        const { parts } = getSmsLengthInfo(text);
        return { studentId: s.id, phone: s.guardian_phone, text, parts };
      });

      totalSmsNeeded = personalizedMessages.reduce((sum, m) => sum + m.parts, 0);
    } else {
      const { parts } = getSmsLengthInfo(message);
      if (parts > 7) throw new Error("SMS length exceeds the maximum limit of 7 parts.");
      totalSmsNeeded = students.length * parts;
    }

    const balance = mData.sms_balance || 0;
    
    if (balance < totalSmsNeeded) {
      throw new Error(`এসএমএস ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${totalSmsNeeded} টি, আছে: ${balance} টি`);
    }

    // Log and deduct balance via RPC
    // If personalized, we might need to call RPC multiple times or a more flexible RPC.
    // For now, we'll use the existing RPC with the original message to deduct balance.
    // We'll pass studentIds multiple times if parts > 1 to match totalSmsNeeded.
    const studentIdsForRpc: string[] = [];
    if (hasShortcodes) {
      personalizedMessages.forEach(m => {
        for (let i = 0; i < m.parts; i++) studentIdsForRpc.push(m.studentId);
      });
    } else {
      const { parts } = getSmsLengthInfo(message);
      for (let i = 0; i < parts; i++) {
        studentIdsForRpc.push(...students.map(s => s.id));
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_institution_id: institutionId,
      p_student_ids: studentIdsForRpc,
      p_message: message // Template message
    });

    if (rpcError) {
      console.error("RPC Error in sendBulk:", rpcError);
      throw new Error(`ট্রানজ্যাকশন সফল হয়নি। (RLS Refused): ${rpcError.message}`);
    }
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    const apiKey = global.reve_api_key;
    const secretKey = global.reve_secret_key;
    const callerId = global.reve_caller_id;
    const clientId = global.reve_client_id;

    if (hasShortcodes) {
      // Send personalized messages in batches
      const sendPromises = personalizedMessages.map(async (m) => {
        try {
          await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              secretKey,
              callerId,
              toUser: normalizePhone(m.phone),
              message: m.text,
              clientId
            })
          });
        } catch (err) {
          console.warn("Personalized SMS failed:", err);
        }
      });
      
      // Execute in chunks to avoid overwhelming the browser
      const chunkSize = 10;
      for (let i = 0; i < sendPromises.length; i += chunkSize) {
        await Promise.all(sendPromises.slice(i, i + chunkSize));
      }

      // Insert logs
      const logChunks = [];
      for (let i = 0; i < personalizedMessages.length; i += 50) {
        logChunks.push(personalizedMessages.slice(i, i + 50));
      }
      for (const chunk of logChunks) {
        await supabase.from('sms_logs').insert(chunk.map(m => ({
          institution_id: institutionId,
          recipient: m.phone,
          message: m.text,
          parts: m.parts,
          status: 'sent'
        })));
      }
    } else {
      // Send individually to ensure compatibility with sendtext
      const sendPromises = students.map(async (s) => {
        try {
          await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey,
              secretKey,
              callerId,
              toUser: normalizePhone(s.guardian_phone),
              message: message,
              clientId
            })
          });
        } catch (err) {
          console.warn("SMS failed:", err);
        }
      });

      // Execute in chunks
      const chunkSize = 10;
      for (let i = 0; i < sendPromises.length; i += chunkSize) {
        await Promise.all(sendPromises.slice(i, i + chunkSize));
      }

      // Insert logs
      const { parts } = getSmsLengthInfo(message);
      const logChunks = [];
      for (let i = 0; i < students.length; i += 50) {
        logChunks.push(students.slice(i, i + 50));
      }
      for (const chunk of logChunks) {
        await supabase.from('sms_logs').insert(chunk.map(s => ({
          institution_id: institutionId,
          recipient: s.guardian_phone,
          message: message,
          parts: parts,
          status: 'sent'
        })));
      }
    }

    return { success: true };
  },

  sendDirect: async (phone: string, message: string, institutionId?: string) => {
    const global = await SMSService.getGlobalSettings();
    let apiKey = global.reve_api_key;
    let secretKey = global.reve_secret_key;
    let callerId = global.reve_caller_id;
    let clientId = global.reve_client_id;

    if (institutionId) {
      // Removed institution-specific REVE keys as columns are missing
    }

    const target = normalizePhone(phone);
    try {
      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          secretKey,
          callerId,
          toUser: target,
          message: message,
          clientId
        })
      });
    } catch (e) {
      console.warn("Direct SMS failed:", e);
    }
    
    if (institutionId) {
      const { parts } = getSmsLengthInfo(message);
      await supabase.from('sms_logs').insert({
        institution_id: institutionId,
        recipient: phone,
        message: message,
        parts: parts,
        status: 'sent'
      });
    }
  },

  getHistory: async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      
      return data.map(log => ({
        date: log.created_at,
        recipient: log.recipient,
        message: log.message,
        status: log.status,
        reason: null
      }));
    } catch (error) {
      console.error("Error in getHistory:", error);
      return [];
    }
  }
};
