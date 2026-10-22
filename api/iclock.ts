import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    // Safely get Supabase Admin client or fallback
    let supabase: any = null;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.warn('[ZKteco ADMS API] getSupabaseAdmin failed, using fallback createClient:', e);
    }

    if (!supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
      supabase = createClient(url, key);
    }

  const urlPath = (req.originalUrl || req.url || '').toLowerCase();
  const query = req.query || {};
  const method = req.method;

  // Extract Serial Number (SN) from query, body, or headers
  const rawSN = (
    query.SN || query.sn || query.device_sn ||
    (typeof req.body === 'object' && (req.body?.SN || req.body?.sn)) ||
    req.headers['x-device-sn'] || ''
  ).toString().trim();
  const SN = rawSN.toUpperCase();

  console.log(`[ZKteco ADMS API] ${method} ${urlPath} | SN: "${SN}"`);

  // 1. Browser / Diagnostic GET check (if user tests URL in browser/Postman without ZKteco SN query)
  const isDiagnosticTest = method === 'GET' && !SN && !urlPath.includes('/cdata') && !urlPath.includes('/getrequest');
  if (isDiagnosticTest) {
    try {
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('is_active', true);

      const registeredDevices: any[] = [];
      if (institutions) {
        for (const inst of institutions) {
          const devices = (inst.config_json as any)?.biometric_devices || [];
          for (const dev of devices) {
            registeredDevices.push({
              sn: dev.sn || dev.id,
              name: dev.name || 'ZKteco Biometric Device',
              institution_id: inst.id,
              institution_name: inst.name
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Deenora ZKteco ADMS / Biometric Machine API is Active and Ready',
        server_time: new Date().toISOString(),
        adms_server_url: 'https://deenora.app/iclock/cdata',
        registered_devices_count: registeredDevices.length,
        registered_devices: registeredDevices,
        instructions: {
          zkteco_menu: 'Go to Menu -> Communication -> ADMS / Cloud Server Settings on your ZKteco machine',
          enable_domain: 'Enable Domain Name: ON',
          server_address: 'Server Address: deenora.app (or your app URL)',
          server_port: 'Server Port: 443 (or 80)',
          enable_proxy: 'HTTPS / ADMS Enabled: ON'
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. ADMS Handshake / Heartbeat GET requests
  // ZKteco devices send GET /iclock/cdata?SN=... or GET /iclock/getrequest?SN=...
  if (method === 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('OK');
  }

  // 3. ADMS Attendance Push Data POST requests
  if (method === 'POST') {
    res.setHeader('Content-Type', 'text/plain');

    let rawData = req.body;

    // Handle JSON payload from SDK Desktop Sync Agents / zklib / C# scripts
    if (typeof rawData === 'object' && rawData !== null) {
      if (Array.isArray(rawData)) {
        // Body is array of log objects: [{ userId: "1001", checkTime: "2026-10-21 08:30:00" }, ...]
        rawData = rawData.map((item: any) => {
          const uId = item.userId || item.user_id || item.pin || item.id || '';
          const cTime = item.checkTime || item.check_time || item.time || item.timestamp || '';
          return `${uId}\t${cTime}`;
        }).join('\n');
      } else if (rawData.logs && Array.isArray(rawData.logs)) {
        // Body is object with logs array: { sn: "...", logs: [{ userId: "1001", checkTime: "..." }] }
        rawData = rawData.logs.map((item: any) => {
          const uId = item.userId || item.user_id || item.pin || item.id || '';
          const cTime = item.checkTime || item.check_time || item.time || item.timestamp || '';
          return `${uId}\t${cTime}`;
        }).join('\n');
      } else if (rawData.userId || rawData.user_id || rawData.pin) {
        // Body is single log object: { userId: "1001", checkTime: "2026-10-21 08:30:00" }
        const uId = rawData.userId || rawData.user_id || rawData.pin || '';
        const cTime = rawData.checkTime || rawData.check_time || rawData.time || rawData.timestamp || '';
        rawData = `${uId}\t${cTime}`;
      } else if (rawData.table === 'ATTLOG' && rawData.data) {
        rawData = rawData.data;
      } else {
        rawData = Object.keys(rawData)[0] || JSON.stringify(rawData);
      }
    } else if (Buffer.isBuffer(rawData)) {
      rawData = rawData.toString('utf-8');
    }

    if (!rawData || typeof rawData !== 'string') {
      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ success: true, processed: 0 });
      }
      return res.status(200).send('OK');
    }

    try {
      // Find matching institution by Device Serial Number (SN)
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('is_active', true);

      let matchedInstitution: any = null;

      if (institutions && institutions.length > 0) {
        // Match by device SN
        if (SN) {
          for (const inst of institutions) {
            const devices = (inst.config_json as any)?.biometric_devices || [];
            if (devices.some((d: any) => String(d.sn || d.id || '').trim().toUpperCase() === SN)) {
              matchedInstitution = inst;
              break;
            }
          }
        }

        // Fallback 1: Match institution with biometric_device_sync module enabled
        if (!matchedInstitution) {
          matchedInstitution = institutions.find(inst => (inst.config_json as any)?.modules?.biometric_device_sync === true);
        }

        // Fallback 2: If only 1 institution exists in database, use it for testing
        if (!matchedInstitution && institutions.length === 1) {
          matchedInstitution = institutions[0];
        }
      }

      if (!matchedInstitution) {
        console.warn(`[ZKteco ADMS] No matching institution found for SN: "${SN}"`);
        return res.status(200).send('OK');
      }

      const matchedInstitutionId = matchedInstitution.id;
      const instConfig = (matchedInstitution.config_json as any) || {};

      console.log(`[ZKteco ADMS] Processing attendance payload for Institution "${matchedInstitution.name}" (${matchedInstitutionId})`);

      const lines = rawData.split(/\r?\n/).filter(line => line.trim().length > 0);

      // Pre-fetch students and teachers for fast matching
      const [{ data: studentsList }, { data: teachersList }] = await Promise.all([
        supabase
          .from('students')
          .select('id, class_id, notes, registration_number, roll, biometric_id, guardian_phone, full_name, name')
          .eq('institution_id', matchedInstitutionId),
        supabase
          .from('teachers')
          .select('id, permissions, teacher_name, mobile')
          .eq('institution_id', matchedInstitutionId)
      ]);

      let processedCount = 0;

      for (const line of lines) {
        // ZKTeco Format: USERID\tCheckTime\tCheckType\tVerifyCode
        // Example: 1001\t2026-10-21 08:30:00\t0\t1
        let parts = line.split('\t');
        if (parts.length < 2) parts = line.split(',');
        if (parts.length < 2) parts = line.split(/\s+/);

        if (parts.length >= 2) {
          const userId = parts[0].trim();
          const checkTime = parts[1].trim();

          if (!userId || !checkTime || userId === 'USERID' || userId === 'PIN') continue;
          
          const date = checkTime.substring(0, 10);
          const time = checkTime.length >= 16 ? checkTime.substring(11, 16) : null;

          if (!date || date.length !== 10) continue;

          // 1. Look up student by biometric_id, registration_number, roll, or ID
          const student = (studentsList || []).find((s: any) => {
            const bId = (s.biometric_id || '').toString().trim();
            const regNo = (s.registration_number || '').toString().trim();
            const rollNo = (s.roll !== null && s.roll !== undefined) ? s.roll.toString().trim() : '';
            const sId = (s.id || '').toString().trim();

            if (bId && bId.toLowerCase() === userId.toLowerCase()) return true;
            if (s.notes && (s.notes.includes(`"biometric_id":"${userId}"`) || s.notes.includes(`biometric_id:${userId}`))) return true;
            if (regNo && regNo.toLowerCase() === userId.toLowerCase()) return true;
            if (rollNo && rollNo === userId) return true;
            if (sId.toLowerCase().startsWith(userId.toLowerCase())) return true;
            return false;
          });

          if (student) {
            const { data: existing } = await supabase
              .from('attendance')
              .select('id')
              .eq('institution_id', matchedInstitutionId)
              .eq('student_id', student.id)
              .eq('event_date', date)
              .maybeSingle();

            if (!existing) {
              const { error: insErr } = await supabase.from('attendance').insert({
                institution_id: matchedInstitutionId,
                student_id: student.id,
                class_id: student.class_id,
                event_date: date,
                status: 'present',
                event_type: 'daily',
                notes: `ZKteco Biometric Punch at ${time || checkTime} (SN: ${SN || 'AUTO'})`
              });

              if (!insErr) {
                processedCount++;
                console.log(`[ZKteco ADMS] Student Attendance Logged: ${student.full_name || student.name || student.id} -> Present on ${date}`);

                // Optional SMS alert to guardian if enabled
                const shouldSendSms = instConfig.student_attendance_sms === true || instConfig.modules?.student_attendance_sms === true;
                if (shouldSendSms && student.guardian_phone) {
                  try {
                    await sendAttendanceSmsNotification(supabase, matchedInstitutionId, student, date, time || '08:30');
                  } catch (smsErr) {
                    console.warn('[ZKteco ADMS] Attendance SMS failed:', smsErr);
                  }
                }
              } else {
                console.error('[ZKteco ADMS] Student attendance insert error:', insErr);
              }
            }
          } else {
            // 2. Look up teacher if not found in students
            const teacher = (teachersList || []).find((t: any) => {
              const perms = t.permissions || {};
              const bioId = (perms.biometric_id || t.biometric_id || '').toString().trim();
              const teachId = (perms.teacher_id_number || '').toString().trim();
              const mobile = (t.mobile || '').toString().trim();

              return (bioId && bioId.toLowerCase() === userId.toLowerCase()) ||
                     (teachId && teachId.toLowerCase() === userId.toLowerCase()) ||
                     (mobile && mobile === userId);
            });

            if (teacher) {
              const { data: existingT } = await supabase
                .from('teacher_attendance')
                .select('id')
                .eq('institution_id', matchedInstitutionId)
                .eq('teacher_id', teacher.id)
                .eq('date', date)
                .maybeSingle();

              if (!existingT) {
                const { error: insTErr } = await supabase.from('teacher_attendance').insert({
                  institution_id: matchedInstitutionId,
                  teacher_id: teacher.id,
                  date: date,
                  status: 'present',
                  notes: `ZKteco Biometric Punch at ${time || checkTime} (SN: ${SN || 'AUTO'})`
                });

                if (!insTErr) {
                  processedCount++;
                  console.log(`[ZKteco ADMS] Teacher Attendance Logged: ${teacher.teacher_name} -> Present on ${date}`);
                } else {
                  console.error('[ZKteco ADMS] Teacher attendance insert error:', insTErr);
                }
              }
            } else {
              console.warn(`[ZKteco ADMS] Unrecognized biometric User ID "${userId}" on date ${date}`);
            }
          }
        }
      }

      console.log(`[ZKteco ADMS/SDK] Finished processing payload. Logged ${processedCount} present records.`);
      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ success: true, processed: processedCount });
      }
    } catch (err: any) {
      console.error('[ZKteco ADMS/SDK] Exception in handler:', err);
    }

    // Standard ADMS protocol response
    return res.status(200).send('OK');
  }

    return res.status(200).send('OK');
  } catch (globalErr: any) {
    console.error('[ZKteco ADMS API] Global Handler Catch:', globalErr);
    if (req.headers['accept']?.includes('json') || req.headers['content-type']?.includes('json')) {
      return res.status(200).json({
        success: true,
        message: 'Deenora ZKteco ADMS / Biometric Machine API Active',
        server_time: new Date().toISOString()
      });
    }
    return res.status(200).send('OK');
  }
}

// Helper to trigger SMS on attendance punch if configured
async function sendAttendanceSmsNotification(supabaseClient: any, institutionId: string, student: any, date: string, time: string) {
  try {
    if (!supabaseClient) return;
    const studentName = student.full_name || student.name || 'শিক্ষার্থী';
    const guardianPhone = student.guardian_phone;
    if (!guardianPhone) return;

    const message = `শ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${studentName} আজ ${date} তারিখ সময় ${time}-এ মাদরাসায় প্রবেশ করেছে। ধন্যবাদ।`;

    await supabaseClient.from('sms_logs').insert({
      institution_id: institutionId,
      recipient: guardianPhone,
      message: message,
      status: 'queued',
      sms_count: 1
    });
  } catch (err) {
    console.warn('sendAttendanceSmsNotification error:', err);
  }
}
