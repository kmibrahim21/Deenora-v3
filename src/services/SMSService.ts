
import { supabase } from 'lib/supabase';
import { Student } from 'types';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from './ShortcodeService';

const normalizePhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  let p = phone.replace(/\D/g, ''); 
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  if (p.length === 11) return `88${p}`;
  return null;
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
        voice_rate: 1.00,
        global_update_active: false,
        global_update_message: '',
        global_update_version: 0
      };

      if (!data) return defaults;
      return {
        reve_api_key: (data.reve_api_key || defaults.reve_api_key).trim(),
        reve_secret_key: (data.reve_secret_key || defaults.reve_secret_key).trim(),
        reve_caller_id: (data.reve_caller_id || defaults.reve_caller_id).trim(),
        bkash_number: data.bkash_number || defaults.bkash_number,
        reve_client_id: (data.reve_client_id || defaults.reve_client_id).trim(),
        sms_rate: data.sms_rate || defaults.sms_rate,
        voice_rate: data.voice_rate || defaults.voice_rate,
        global_update_active: data.global_update_active || false,
        global_update_message: data.global_update_message || '',
        global_update_version: data.global_update_version || 0
      };
    } catch (e) {
      return { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234', 
        reve_client_id: '',
        sms_rate: 0.50,
        voice_rate: 1.00,
        global_update_active: false,
        global_update_message: '',
        global_update_version: 0
      };
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
      const chunkSize = 50;
      const batches = [];
      for (let i = 0; i < personalizedMessages.length; i += chunkSize) {
        batches.push(personalizedMessages.slice(i, i + chunkSize));
      }

      const sendPromises = batches.map(async (chunk) => {
        const validMsgs: typeof chunk = [];
        const logs: any[] = [];
        
        chunk.forEach(m => {
          const normPhone = normalizePhone(m.phone);
          if (!normPhone) {
            logs.push({
              institution_id: institutionId,
              recipient: m.phone || 'Unknown',
              message: m.text,
              parts: m.parts,
              status: 'failed'
            });
          } else {
            validMsgs.push(m);
            logs.push({
              institution_id: institutionId,
              recipient: m.phone,
              message: m.text,
              parts: m.parts,
              status: 'sent'
            });
          }
        });

        if (validMsgs.length > 0) {
          const apiUrls = validMsgs.map(m => {
            let url = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${normalizePhone(m.phone)}&messageContent=${encodeURIComponent(m.text)}&type=3`;
            if (clientId) url += `&clientid=${clientId}`;
            return url;
          });

          try { 
            const res = await fetch('/api/sms', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiUrls })
            }); 
            if (!res.ok) {
              logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
            } else {
              const parsed = await res.json();
              if (parsed.results) {
                parsed.results.forEach((r: any, idx: number) => {
                  const log = logs.find(l => l.recipient === validMsgs[idx].phone);
                  if (log && (!r.success || (typeof r.response === 'string' && r.response.toLowerCase().includes('error')))) {
                    log.status = 'failed';
                  }
                });
              }
            }
          } catch (err) { 
            console.warn("Personalized SMS batch failed:", err); 
            logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
          }
        }
        
        // Insert logs
        if (logs.length > 0) {
          await supabase.from('sms_logs').insert(logs);
        }
      });

      await Promise.all(sendPromises);
    } else {
      // Original bulk logic (same message for all)
      const chunkSize = 50; 
      const batches: Student[][] = [];
      for (let i = 0; i < students.length; i += chunkSize) {
        batches.push(students.slice(i, i + chunkSize));
      }

      const sendPromises = batches.map(async (chunkStudents) => {
        const { parts } = getSmsLengthInfo(message);
        const validMsgs: Student[] = [];
        const logs: any[] = [];
        
        chunkStudents.forEach(s => {
          const normPhone = normalizePhone(s.guardian_phone);
          if (!normPhone) {
            logs.push({
              institution_id: institutionId,
              recipient: s.guardian_phone || 'Unknown',
              message: message,
              parts: parts,
              status: 'failed'
            });
          } else {
            validMsgs.push(s);
            logs.push({
              institution_id: institutionId,
              recipient: s.guardian_phone,
              message: message,
              parts: parts,
              status: 'sent'
            });
          }
        });

        if (validMsgs.length > 0) {
          const apiUrls = validMsgs.map(s => {
            let url = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${normalizePhone(s.guardian_phone)}&messageContent=${encodeURIComponent(message)}&type=3`;
            if (clientId) url += `&clientid=${clientId}`;
            return url;
          });
          
          try { 
            const res = await fetch('/api/sms', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiUrls })
            }); 
            if (!res.ok) {
              logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
            } else {
              const parsed = await res.json();
              if (parsed.results) {
                parsed.results.forEach((r: any, idx: number) => {
                  const log = logs.find(l => l.recipient === validMsgs[idx].guardian_phone);
                  if (log && (!r.success || (typeof r.response === 'string' && r.response.toLowerCase().includes('error')))) {
                    log.status = 'failed';
                  }
                });
              }
            }
          } catch (err) { 
            console.warn("SMS batch failed:", err); 
            logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
          }
        }
        
        // Insert logs
        if (logs.length > 0) {
          await supabase.from('sms_logs').insert(logs);
        }
      });

      await Promise.all(sendPromises);
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
    let finalStatus = 'sent';
    
    if (!target) {
      finalStatus = 'failed';
    } else {
      let apiUrl = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${target}&messageContent=${encodeURIComponent(message)}&type=3`;
      if (clientId) apiUrl += `&clientid=${clientId}`;
      try { 
        const res = await fetch('/api/sms', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiUrl })
        }); 
        if (!res.ok) finalStatus = 'failed';
      } catch (e) { 
        console.warn("Direct SMS failed:", e);
        finalStatus = 'failed';
      }
    }
    
    if (institutionId) {
      const { parts } = getSmsLengthInfo(message);
      await supabase.from('sms_logs').insert({
        institution_id: institutionId,
        recipient: phone || 'Unknown',
        message: message,
        parts: parts,
        status: finalStatus
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
