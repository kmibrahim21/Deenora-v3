import { supabase } from 'lib/supabase';
import { Student, SystemSettings, SmsProviderConfig } from 'types';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from './ShortcodeService';

const normalizePhone = (phone?: string | null | number): string | null => {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, ''); 
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
      
      const defaults: SystemSettings = {
        id: '00000000-0000-0000-0000-000000000001',
        reve_api_key: '1762419e515c6f28', 
        reve_secret_key: '326edcba', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        nagad_number: '০১৭৬৬-XXXXXX',
        support_number: '01766326edba',
        reve_caller_id: 'DEENORA',
        reve_client_id: '',
        reve_non_masking_id: '',
        automas_api_key: '',
        automas_masking_sender_id: '',
        automas_non_masking_sender_id: '',
        sms_provider_config: {
          reve: { masking_enabled: true, non_masking_enabled: true },
          automas: { masking_enabled: false, non_masking_enabled: false },
          primary: { masking: 'reve', non_masking: 'reve' },
          masking_rate: 0.55,
          non_masking_rate: 0.35
        },
        sms_rate: 0.55,
        voice_rate: 0.45,
        manager_permissions: {} as any
      };

      if (!data) return defaults;
      return {
        id: data.id || defaults.id,
        reve_api_key: (data.reve_api_key || defaults.reve_api_key).trim(),
        reve_secret_key: (data.reve_secret_key || defaults.reve_secret_key).trim(),
        reve_caller_id: (data.reve_caller_id || defaults.reve_caller_id).trim(),
        reve_client_id: (data.reve_client_id || defaults.reve_client_id).trim(),
        reve_non_masking_id: (data.reve_non_masking_id || defaults.reve_non_masking_id).trim(),
        automas_api_key: (data.automas_api_key || defaults.automas_api_key).trim(),
        automas_masking_sender_id: (data.automas_masking_sender_id || defaults.automas_masking_sender_id).trim(),
        automas_non_masking_sender_id: (data.automas_non_masking_sender_id || defaults.automas_non_masking_sender_id).trim(),
        sms_provider_config: (data.sms_provider_config || defaults.sms_provider_config) as SmsProviderConfig,
        bkash_number: data.bkash_number || defaults.bkash_number,
        nagad_number: data.nagad_number || defaults.nagad_number,
        support_number: data.support_number || defaults.support_number,
        sms_rate: data.sms_rate || defaults.sms_rate,
        voice_rate: data.voice_rate || defaults.voice_rate,
        manager_permissions: data.manager_permissions || {},
        global_update_active: data.global_update_active || false,
        global_update_message: data.global_update_message || '',
        global_update_version: data.global_update_version || 0
      } as SystemSettings;
    } catch (e) {
      return { 
        id: '00000000-0000-0000-0000-000000000001',
        reve_api_key: '1762419e515c6f28', 
        reve_secret_key: '326edcba', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        nagad_number: '০১৭৬৬-XXXXXX',
        support_number: '01766326edba',
        reve_caller_id: 'DEENORA', 
        reve_client_id: '',
        reve_non_masking_id: '',
        automas_api_key: '',
        automas_masking_sender_id: '',
        automas_non_masking_sender_id: '',
        sms_provider_config: {
          reve: { masking_enabled: true, non_masking_enabled: true },
          automas: { masking_enabled: false, non_masking_enabled: false },
          primary: { masking: 'reve', non_masking: 'reve' } as const,
          masking_rate: 0.55,
          non_masking_rate: 0.35
        },
        sms_rate: 0.55,
        voice_rate: 0.45,
        manager_permissions: {},
        global_update_active: false,
        global_update_message: '',
        global_update_version: 0
      } as SystemSettings;
    }
  },

  sendBulk: async (
    institutionId: string,
    students: Student[],
    message: string,
    smsType: 'masking' | 'non_masking' | 'unknown' = 'unknown'
  ) => {
    const [mRes, global] = await Promise.all([
      supabase.from('institutions').select('sms_balance, reve_api_key, reve_secret_key, reve_client_id, voice_sender_id, automas_api_key, automas_masking_sender_id, automas_non_masking_sender_id').eq('id', institutionId).single(),
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
        const fetchedData = shortcodeData.find(d => d.id === s.id) || { student_name: s.student_name, guardian_phone: s.guardian_phone };
        const data = { ...fetchedData, ...s };
        const text = ShortcodeService.replaceShortcodes(message, data).trim();
        const { parts } = getSmsLengthInfo(text);
        return { studentId: s.id, phone: s.guardian_phone, text, parts };
      });

      totalSmsNeeded = personalizedMessages.reduce((sum, m) => sum + m.parts, 0);
    } else {
      const cleanMessage = (message || '').trim();
      const { parts } = getSmsLengthInfo(cleanMessage);
      if (parts > 7) throw new Error("SMS length exceeds the maximum limit of 7 parts.");
      totalSmsNeeded = students.length * parts;
    }

    const balance = mData.sms_balance || 0;
    
    if (balance < totalSmsNeeded) {
      throw new Error(`এসএমএস ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${totalSmsNeeded} টি, আছে: ${balance} টি`);
    }

    const studentIdsForRpc: string[] = [];
    if (hasShortcodes) {
      personalizedMessages.forEach(m => {
        for (let i = 0; i < m.parts; i++) studentIdsForRpc.push(m.studentId);
      });
    } else {
      const cleanMessage = (message || '').trim();
      const { parts } = getSmsLengthInfo(cleanMessage);
      for (let i = 0; i < parts; i++) {
        studentIdsForRpc.push(...students.map(s => s.id));
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_institution_id: institutionId,
      p_student_ids: studentIdsForRpc,
      p_message: (message || '').trim()
    });

    if (rpcError) {
      console.error("RPC Error in sendBulk:", rpcError);
      throw new Error(`ট্রানজ্যাকশন সফল হয়নি। (RLS Refused): ${rpcError.message}`);
    }
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    const allLogs: any[] = [];
    const chunkSize = 50;

    const processPersonalizedBatch = async (chunk: typeof personalizedMessages) => {
      const validMsgs: typeof chunk = [];
      const logs: any[] = [];
      let batchErrorStr = '';
      
      chunk.forEach(m => {
        const normPhone = normalizePhone(m.phone);
        if (!normPhone) {
          logs.push({
            institution_id: institutionId,
            recipient: m.phone || 'Unknown',
            message: m.text,
            parts: m.parts,
            status: 'failed',
            sms_type: smsType === 'unknown' ? 'non_masking' : smsType,
            provider: 'none',
            provider_error: 'Invalid phone number'
          });
        } else {
          validMsgs.push(m);
          logs.push({
            institution_id: institutionId,
            recipient: m.phone,
            message: m.text,
            parts: m.parts,
            status: 'sent',
            sms_type: smsType === 'unknown' ? 'non_masking' : smsType,
            provider: 'pending'
          });
        }
      });

      if (validMsgs.length > 0) {
        const messageItems = validMsgs.map(m => ({
          recipient: m.phone,
          text: m.text
        }));

        try { 
          const res = await fetch('/api/sms', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_routed_sms',
              smsType,
              institutionId,
              messages: messageItems
            }),
            signal: AbortSignal.timeout(60000)
          }); 

          const parsed = await res.json();

          if (!res.ok || parsed.success === false) {
            logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
            batchErrorStr = parsed.error || 'এসএমএস পাঠাতে ব্যর্থ হয়েছে।';
          } else if (parsed.results) {
            const activeProvider = parsed.provider || 'reve';
            let failCount = 0;
            parsed.results.forEach((r: any, idx: number) => {
              const log = logs.find(l => l.recipient === validMsgs[idx].phone && l.status === 'sent');
              if (log) {
                log.provider = r.provider || activeProvider;
                log.sms_type = parsed.smsType || (smsType === 'unknown' ? 'non_masking' : smsType);
                log.provider_message_id = r.providerMessageId || null;
                log.provider_error = r.errorMessage || r.errorCode || null;

                if (!r.success) {
                  log.status = 'failed';
                  failCount++;
                }
              }
              if (!r.success && r.errorMessage && !batchErrorStr) {
                batchErrorStr = r.errorMessage;
              }
            });
            if (failCount < parsed.results.length) {
              batchErrorStr = '';
            }
          }
        } catch (err: any) { 
          console.warn("Personalized SMS batch failed:", err); 
          logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
          batchErrorStr = err.name === 'TimeoutError' ? 'এসএমএস সার্ভার সাড়া দিচ্ছে না (Request Timeout)' : (err.message || 'নেটওয়ার্ক সংযোগে সমস্যা (Failed to fetch)');
        }
      }
      
      if (logs.length > 0) {
        await supabase.from('sms_logs').insert(logs);
        allLogs.push(...logs);
      }

      if (batchErrorStr) {
        throw new Error(batchErrorStr);
      }
    };

    const processStandardBatch = async (chunkStudents: Student[]) => {
      const { parts } = getSmsLengthInfo(message);
      const validMsgs: Student[] = [];
      const logs: any[] = [];
      let batchErrorStr = '';
      
      chunkStudents.forEach(s => {
        const normPhone = normalizePhone(s.guardian_phone);
        if (!normPhone) {
          logs.push({
            institution_id: institutionId,
            recipient: s.guardian_phone || 'Unknown',
            message: message,
            parts: parts,
            status: 'failed',
            sms_type: smsType === 'unknown' ? 'non_masking' : smsType,
            provider: 'none',
            provider_error: 'Invalid phone number'
          });
        } else {
          validMsgs.push(s);
          logs.push({
            institution_id: institutionId,
            recipient: s.guardian_phone,
            message: message,
            parts: parts,
            status: 'sent',
            sms_type: smsType === 'unknown' ? 'non_masking' : smsType,
            provider: 'pending'
          });
        }
      });

      if (validMsgs.length > 0) {
        const messageItems = validMsgs.map(s => ({
          recipient: s.guardian_phone,
          text: message
        }));

        try { 
          const res = await fetch('/api/sms', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_routed_sms',
              smsType,
              institutionId,
              messages: messageItems
            }),
            signal: AbortSignal.timeout(60000)
          }); 

          const parsed = await res.json();

          if (!res.ok || parsed.success === false) {
            logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
            batchErrorStr = parsed.error || 'এসএমএস পাঠাতে ব্যর্থ হয়েছে।';
          } else if (parsed.results) {
            const activeProvider = parsed.provider || 'reve';
            let failCount = 0;
            parsed.results.forEach((r: any, idx: number) => {
              const log = logs.find(l => l.recipient === validMsgs[idx].guardian_phone && l.status === 'sent');
              if (log) {
                log.provider = r.provider || activeProvider;
                log.sms_type = parsed.smsType || (smsType === 'unknown' ? 'non_masking' : smsType);
                log.provider_message_id = r.providerMessageId || null;
                log.provider_error = r.errorMessage || r.errorCode || null;

                if (!r.success) {
                  log.status = 'failed';
                  failCount++;
                }
              }
              if (!r.success && r.errorMessage && !batchErrorStr) {
                batchErrorStr = r.errorMessage;
              }
            });
            if (failCount < parsed.results.length) {
              batchErrorStr = '';
            }
          }
        } catch (err: any) { 
          console.warn("SMS batch failed:", err); 
          logs.forEach(l => { if (l.status === 'sent') l.status = 'failed'; });
          batchErrorStr = err.name === 'TimeoutError' ? 'এসএমএস সার্ভার সাড়া দিচ্ছে না (Request Timeout)' : (err.message || 'নেটওয়ার্ক সংযোগে সমস্যা (Failed to fetch)');
        }
      }
      
      if (logs.length > 0) {
        await supabase.from('sms_logs').insert(logs);
        allLogs.push(...logs);
      }

      if (batchErrorStr) {
        throw new Error(batchErrorStr);
      }
    };

    let throwError: Error | null = null;
    const concurrencyLimit = 3;

    try {
      if (hasShortcodes) {
        for (let i = 0; i < personalizedMessages.length; i += chunkSize * concurrencyLimit) {
          const currentBatchChunks = [];
          for (let j = 0; j < concurrencyLimit; j++) {
            const start = i + (j * chunkSize);
            if (start < personalizedMessages.length) {
              currentBatchChunks.push(personalizedMessages.slice(start, start + chunkSize));
            }
          }
          await Promise.all(currentBatchChunks.map(processPersonalizedBatch));
        }
      } else {
        for (let i = 0; i < students.length; i += chunkSize * concurrencyLimit) {
          const currentBatchChunks = [];
          for (let j = 0; j < concurrencyLimit; j++) {
            const start = i + (j * chunkSize);
            if (start < students.length) {
              currentBatchChunks.push(students.slice(start, start + chunkSize));
            }
          }
          await Promise.all(currentBatchChunks.map(processStandardBatch));
        }
      }
    } catch (err: any) {
      throwError = err;
    } finally {
      // Calculate total failed SMS parts to refund
      const totalFailedSms = allLogs
        .filter(l => l.status === 'failed')
        .reduce((sum, l) => sum + (Number(l.parts) || 1), 0);

      if (totalFailedSms > 0) {
        console.log(`Refunding ${totalFailedSms} failed SMS to institution ${institutionId}`);
        try {
          const { data: instData } = await supabase
            .from('institutions')
            .select('sms_balance')
            .eq('id', institutionId)
            .single();
          
          if (instData) {
            const currentBal = instData.sms_balance || 0;
            await supabase
              .from('institutions')
              .update({ sms_balance: currentBal + totalFailedSms })
              .eq('id', institutionId);
          }
        } catch (refundErr) {
          console.error("Failed to refund SMS balance:", refundErr);
        }
      }

      if (throwError) {
        throw throwError;
      }
    }

    return { success: true };
  },

  sendDirect: async (
    phone: string,
    message: string,
    institutionId?: string,
    smsType: 'masking' | 'non_masking' | 'unknown' = 'unknown'
  ) => {
    const target = normalizePhone(phone);
    let finalStatus = 'sent';
    let throwErrorMsg = '';
    let usedProvider = 'reve';
    let providerMsgId = '';
    let providerErr = '';
    let parsed: any = null;
    
    if (!target) {
      finalStatus = 'failed';
      providerErr = 'Invalid phone number';
    } else {
      try { 
        const res = await fetch('/api/sms', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_routed_sms',
            smsType,
            institutionId,
            messages: [{ recipient: phone, text: message }]
          }),
          signal: AbortSignal.timeout(15000)
        });

        parsed = await res.json();
        if (!res.ok || parsed.success === false) {
          finalStatus = 'failed';
          throwErrorMsg = parsed.error || 'এসএমএস পাঠাতে ব্যর্থ হয়েছে।';
        } else if (parsed.results && parsed.results.length > 0) {
          const r = parsed.results[0];
          usedProvider = r.provider || parsed.provider || 'reve';
          providerMsgId = r.providerMessageId || '';
          providerErr = r.errorMessage || r.errorCode || '';

          if (!r.success) {
            finalStatus = 'failed';
            throwErrorMsg = providerErr || 'এসএমএস পাঠাতে ব্যর্থ হয়েছে।';
          }
        }
      } catch (e: any) { 
        console.warn("Direct SMS failed:", e);
        finalStatus = 'failed';
        throwErrorMsg = e.name === 'TimeoutError' ? 'এসএমএস সার্ভার সাড়া দিচ্ছে না (Request Timeout)' : (e.message || 'নেটওয়ার্ক সংযোগে সমস্যা (Failed to fetch)');
      }
    }
    
    if (institutionId) {
      const { parts } = getSmsLengthInfo(message);
      await supabase.from('sms_logs').insert({
        institution_id: institutionId,
        recipient: phone || 'Unknown',
        message: message,
        parts: parts,
        status: finalStatus,
        sms_type: parsed?.smsType || (smsType === 'unknown' ? 'non_masking' : smsType),
        provider: usedProvider,
        provider_message_id: providerMsgId || null,
        provider_error: providerErr || null
      });
    }

    if (throwErrorMsg) {
      throw new Error(throwErrorMsg);
    }
  },

  getHistory: async (institutionId: string) => {
    try {
      const normalizePhoneKey = (p: any): string => {
        if (!p) return '';
        const digits = String(p).replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('01')) return digits;
        if (digits.length === 13 && digits.startsWith('8801')) return digits.slice(2);
        if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
        return digits;
      };

      const [{ data, error }, { data: students }, { data: classes }, { data: teachers }] = await Promise.all([
        supabase
          .from('sms_logs')
          .select('*')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('students')
          .select('student_name, roll, guardian_phone, guardian_phone_2, class_id')
          .eq('institution_id', institutionId),
        supabase
          .from('classes')
          .select('id, class_name')
          .eq('institution_id', institutionId),
        supabase
          .from('teachers')
          .select('name, phone')
          .eq('institution_id', institutionId)
      ]);
        
      if (error && error.code !== '42P01') throw error;

      const classMap: Record<string, string> = {};
      if (classes) {
        classes.forEach(c => {
          if (c.id && c.class_name) classMap[c.id] = c.class_name;
        });
      }

      const phoneMap: Record<string, { name: string; class_name?: string; roll?: any; type: 'student' | 'teacher' }> = {};

      if (students) {
        students.forEach(s => {
          const cName = s.class_id ? classMap[s.class_id] : undefined;
          const info = { name: s.student_name, class_name: cName, roll: s.roll, type: 'student' as const };
          if (s.guardian_phone) {
            const k = normalizePhoneKey(s.guardian_phone);
            if (k) phoneMap[k] = info;
          }
          if (s.guardian_phone_2) {
            const k = normalizePhoneKey(s.guardian_phone_2);
            if (k) phoneMap[k] = info;
          }
        });
      }

      if (teachers) {
        teachers.forEach(t => {
          if (t.phone) {
            const k = normalizePhoneKey(t.phone);
            if (k) phoneMap[k] = { name: t.name, class_name: 'শিক্ষক', type: 'teacher' };
          }
        });
      }
      
      const safeData = data || [];
      return safeData.map(log => {
        const k = normalizePhoneKey(log.recipient);
        const recipientInfo = phoneMap[k] || null;

        return {
          date: log.created_at,
          recipient: log.recipient,
          message: log.message,
          status: log.status,
          provider: log.provider || 'reve',
          sms_type: log.sms_type || 'masking',
          provider_message_id: log.provider_message_id || null,
          reason: log.provider_error || null,
          student_name: recipientInfo?.name || null,
          class_name: recipientInfo?.class_name || null,
          roll: recipientInfo?.roll || null,
          recipient_type: recipientInfo?.type || null
        };
      });
    } catch (error) {
      console.error("Error in getHistory:", error);
      return [];
    }
  }
};
