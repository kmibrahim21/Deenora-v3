import { createClient } from '@supabase/supabase-js';

// Self-contained Supabase Admin helper (avoids Vercel ESM relative module import resolution issues)
function createSupabaseAdminClient() {
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    'https://wafcgdcgqkmsngwqhded.supabase.co';

  const supabaseServiceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    const supabase = createSupabaseAdminClient();

  const urlPath = (req.originalUrl || req.url || '').toLowerCase();
  const query = req.query || {};
  const method = req.method;

  // Extract Serial Number (SN) from URL query regex, query object, body, or headers
  const urlSnMatch = (req.originalUrl || req.url || '').match(/[?&]sn=([^&]+)/i);
  const snFromUrl = urlSnMatch ? decodeURIComponent(urlSnMatch[1]) : '';

  const rawSN = (
    query.SN || query.sn || query.device_sn || query.sn_number || snFromUrl ||
    (typeof req.body === 'object' && req.body !== null && (req.body?.SN || req.body?.sn)) ||
    req.headers['x-device-sn'] || ''
  ).toString().trim();
  const SN = rawSN.toUpperCase();

  console.log(`[ZKteco ADMS API] ${method} ${urlPath} | SN: "${SN}"`);

  // 1. Browser / Diagnostic GET check
  const isDiagnosticTest = method === 'GET' && (!urlPath.includes('/cdata') && !urlPath.includes('/getrequest'));
  if (isDiagnosticTest) {
    try {
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('is_active', true);

      const registeredDevices: any[] = [];
      let searchedDeviceDiagnostic: any = null;

      if (institutions) {
        for (const inst of institutions) {
          const devices = (inst.config_json as any)?.biometric_devices || [];
          const devicesList = Array.isArray(devices) ? devices : [devices];
          for (const dev of devicesList) {
            const snVal = typeof dev === 'string' ? dev : (dev.sn || dev.id);
            if (snVal) {
              const matched = SN && String(snVal).trim().toUpperCase() === SN;
              const devInfo = {
                sn: snVal,
                name: dev.name || `ZKteco Device ${snVal}`,
                institution_id: inst.id,
                institution_name: inst.name
              };
              registeredDevices.push(devInfo);

              if (matched) {
                searchedDeviceDiagnostic = devInfo;
              }
            }
          }
        }
      }

      // If user queried a specific SN in browser (e.g. /api/iclock?sn=UEED262800196)
      if (SN && searchedDeviceDiagnostic) {
        const instId = searchedDeviceDiagnostic.institution_id;
        const [{ data: students }, { data: teachers }, { data: recentLogs }] = await Promise.all([
          supabase.from('students').select('id, student_name, biometric_id, roll').eq('institution_id', instId),
          supabase.from('teachers').select('id, teacher_name, permissions').eq('institution_id', instId),
          supabase.from('attendance').select('id, student_id, created_at, date').eq('institution_id', instId).order('created_at', { ascending: false }).limit(5)
        ]);

        const bioStudents = (students || []).filter(s => Boolean(s.biometric_id || s.roll));
        const bioTeachers = (teachers || []).filter((t: any) => Boolean(t.permissions?.biometric_id || t.biometric_id));

        return res.status(200).json({
          success: true,
          status: 'REGISTERED_AND_ACTIVE',
          device_sn: SN,
          institution: searchedDeviceDiagnostic.institution_name,
          institution_id: instId,
          biometric_students_count: bioStudents.length,
          biometric_teachers_count: bioTeachers.length,
          recent_punches_logged: recentLogs || [],
          recommendation: bioStudents.length === 0 
            ? 'WARNING: No students have Biometric IDs configured in this institution. Please edit student profiles and enter Biometric IDs.'
            : 'READY: Device is linked and students are ready for punch attendance.'
        });
      }

      // If machine sends GET /iclock/cdata?SN=... handshake request
      if (SN && (urlPath.includes('/cdata') || urlPath.includes('/getrequest'))) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send('OK');
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
          server_address: 'Server Address: deenora.app',
          server_port: 'Server Port: 443 (or 80)'
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. ADMS Handshake / Heartbeat GET requests
  if (method === 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('OK');
  }

  // 3. ADMS Attendance Push Data POST requests
  if (method === 'POST') {
    res.setHeader('Content-Type', 'text/plain');

    let rawData = req.body;

    // Handle JSON payload or form-urlencoded text lines
    if (typeof rawData === 'object' && rawData !== null) {
      if (Buffer.isBuffer(rawData)) {
        rawData = rawData.toString('utf-8');
      } else if (Array.isArray(rawData)) {
        rawData = rawData.map((item: any) => {
          const uId = item.userId || item.user_id || item.pin || item.id || '';
          const cTime = item.checkTime || item.check_time || item.time || item.timestamp || '';
          return `${uId}\t${cTime}`;
        }).join('\n');
      } else if (rawData.logs && Array.isArray(rawData.logs)) {
        rawData = rawData.logs.map((item: any) => {
          const uId = item.userId || item.user_id || item.pin || item.id || '';
          const cTime = item.checkTime || item.check_time || item.time || item.timestamp || '';
          return `${uId}\t${cTime}`;
        }).join('\n');
      } else if (rawData.userId || rawData.user_id || rawData.pin) {
        const uId = rawData.userId || rawData.user_id || rawData.pin || '';
        const cTime = rawData.checkTime || rawData.check_time || rawData.time || rawData.timestamp || '';
        rawData = `${uId}\t${cTime}`;
      } else if (rawData.table === 'ATTLOG' && rawData.data) {
        rawData = rawData.data;
      } else {
        // Express / Vercel form parser turns text lines into object keys
        const keys = Object.keys(rawData);
        rawData = keys.join('\n');
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
      const lines = rawData.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
      const firstUserId = lines[0] ? (lines[0].split(/[\t,\s]+/)[0] || '').trim() : '';

      // Direct institution hints from query or payload
      const reqInstId = (
        query.institution_id || query.institutionId ||
        (typeof req.body === 'object' && req.body !== null && (req.body.institution_id || req.body.institutionId))
      )?.toString().trim();

      const reqInstName = (
        query.institution_name || query.institutionName || query.institution ||
        (typeof req.body === 'object' && req.body !== null && (req.body.institution_name || req.body.institutionName))
      )?.toString().trim();

      // Find matching institution by Device Serial Number (SN)
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('is_active', true);

      let matchedInstitution: any = null;

      if (institutions && institutions.length > 0) {
        if (reqInstId) {
          matchedInstitution = institutions.find((i: any) => i.id === reqInstId);
        } else if (reqInstName) {
          matchedInstitution = institutions.find((i: any) => i.name?.toLowerCase().trim() === reqInstName.toLowerCase().trim()) ||
                               institutions.find((i: any) => i.name?.toLowerCase().includes(reqInstName.toLowerCase()));
        }

        if (!matchedInstitution && SN) {
          const cleanSn = SN.trim().toUpperCase();
          const candidateInstitutions = institutions.filter((inst: any) => {
            const devices = (inst.config_json as any)?.biometric_devices || [];
            const devicesList = Array.isArray(devices) ? devices : [devices];
            return devicesList.some((d: any) => {
              const snVal = typeof d === 'string' ? d : (d.sn || d.id || d.device_sn || '');
              return String(snVal).trim().toUpperCase() === cleanSn;
            });
          });

          if (candidateInstitutions.length === 1) {
            matchedInstitution = candidateInstitutions[0];
          } else if (candidateInstitutions.length > 1) {
            // Disambiguate when multiple institutions share the same SN
            // Find which candidate institution actually has a student with this userId
            if (firstUserId) {
              const candidateIds = candidateInstitutions.map((c: any) => c.id);
              const numUserId = Number(firstUserId);
              const { data: matchedStudents } = await supabase
                .from('students')
                .select('institution_id')
                .in('institution_id', candidateIds)
                .or(`biometric_id.eq.${firstUserId},roll.eq.${firstUserId},registration_number.eq.${firstUserId}`);

              if (matchedStudents && matchedStudents.length > 0) {
                const foundInstId = matchedStudents[0].institution_id;
                matchedInstitution = candidateInstitutions.find((c: any) => c.id === foundInstId);
              }

              // Also check teachers if student was not found
              if (!matchedInstitution) {
                const { data: allTeachers } = await supabase
                  .from('teachers')
                  .select('institution_id, permissions, mobile')
                  .in('institution_id', candidateIds);

                if (allTeachers && allTeachers.length > 0) {
                  for (const t of allTeachers) {
                    const bioId = (t.permissions?.biometric_id || t.permissions?.teacher_id_number || t.mobile || '').toString().trim();
                    if (bioId === firstUserId || (!isNaN(numUserId) && Number(bioId) === numUserId)) {
                      matchedInstitution = candidateInstitutions.find((c: any) => c.id === t.institution_id);
                      if (matchedInstitution) break;
                    }
                  }
                }
              }
            }

            if (!matchedInstitution) {
              matchedInstitution = candidateInstitutions[0];
            }
          }
        }
      }

      // STRICT MULTI-TENANT ISOLATION:
      // If the device SN or institution_id does not belong to any active institution,
      // REJECT logging. Never guess or assign attendance to a random institution.
      if (!matchedInstitution) {
        console.warn(`[ZKteco ADMS Security] Unauthorized or unregistered device SN: "${SN}" | Institution Hint: "${reqInstId || reqInstName || 'none'}"`);
        if (req.headers['content-type']?.includes('application/json') || req.headers?.['accept']?.includes('json')) {
          return res.status(200).json({
            success: false,
            processed: 0,
            message: `মেশিনের সিরিয়াল নম্বর "${SN}" কোনো প্রতিষ্ঠানের সাথে রেজিস্টার করা নেই। অনুগ্রহ করে প্রোফাইল সেটিংস থেকে সিরিয়াল নম্বরটি সেভ করুন।`
          });
        }
        return res.status(200).send('OK');
      }

      const matchedInstitutionId = matchedInstitution.id;
      const instConfig = (matchedInstitution.config_json as any) || {};

      console.log(`[ZKteco ADMS] Processing attendance payload for Institution "${matchedInstitution.name}" (${matchedInstitutionId})`);

      // Pre-fetch students and teachers for fast matching
      const [{ data: studentsList }, { data: teachersList }] = await Promise.all([
        supabase
          .from('students')
          .select('id, class_id, notes, registration_number, roll, biometric_id, guardian_phone, student_name')
          .eq('institution_id', matchedInstitutionId),
        supabase
          .from('teachers')
          .select('id, permissions, teacher_name, mobile')
          .eq('institution_id', matchedInstitutionId)
      ]);

      let processedCount = 0;

      for (const line of lines) {
        let userId = '';
        let checkTime = '';

        if (line.includes('\t')) {
          const parts = line.split('\t');
          userId = (parts[0] || '').trim();
          checkTime = (parts[1] || '').trim();
        } else if (line.includes(',')) {
          const parts = line.split(',');
          userId = (parts[0] || '').trim();
          checkTime = (parts[1] || '').trim();
        } else {
          const parts = line.split(/\s+/);
          userId = (parts[0] || '').trim();
          if (parts.length >= 3 && parts[1]?.length === 10 && parts[2]?.includes(':')) {
            checkTime = `${parts[1]} ${parts[2]}`;
          } else {
            checkTime = (parts[1] || '').trim();
          }
        }

        if (!userId || !checkTime || userId.toUpperCase() === 'USERID' || userId.toUpperCase() === 'PIN') continue;

        const date = checkTime.substring(0, 10);
        const time = checkTime.length >= 16 ? checkTime.substring(11, 16) : (checkTime.length > 10 ? checkTime.substring(11) : null);

        if (!date || date.length !== 10) continue;

        const numUserId = Number(userId);

        // 1. Look up student by biometric_id, registration_number, roll, or ID (string or numeric)
        const student = (studentsList || []).find((s: any) => {
          const bId = (s.biometric_id || '').toString().trim();
          const regNo = (s.registration_number || '').toString().trim();
          const rollNo = (s.roll !== null && s.roll !== undefined) ? s.roll.toString().trim() : '';
          const sId = (s.id || '').toString().trim();

          if (bId && bId.toLowerCase() === userId.toLowerCase()) return true;
          if (!isNaN(numUserId) && bId && !isNaN(Number(bId)) && Number(bId) === numUserId) return true;
          if (regNo && regNo.toLowerCase() === userId.toLowerCase()) return true;
          if (!isNaN(numUserId) && regNo && !isNaN(Number(regNo)) && Number(regNo) === numUserId) return true;
          if (rollNo && rollNo === userId) return true;
          if (!isNaN(numUserId) && rollNo && !isNaN(Number(rollNo)) && Number(rollNo) === numUserId) return true;
          if (s.notes && (s.notes.includes(`"biometric_id":"${userId}"`) || s.notes.includes(`biometric_id:${userId}`))) return true;
          if (sId.toLowerCase().startsWith(userId.toLowerCase())) return true;
          return false;
        });

        if (student) {
          const settings = instConfig.attendance_settings || {};
          const classSessions = student.class_id ? settings.class_sessions?.[student.class_id] : null;
          const sessionsList = (classSessions && classSessions.length > 0) ? classSessions : (settings.sessions || []);
          const activeSessionId = sessionsList.length > 0 ? sessionsList[0].id : 'morning';
          const academicYearId = (student as any).academic_year_id || instConfig.active_academic_year_id || null;

          // Determine class start time and late grace minutes
          const classTimes = student.class_id ? settings.class_times?.[student.class_id] : null;
          const classStartTimeStr = classTimes?.start_time || settings.start_time || '08:00';
          const graceMinutes = Number(settings.late_grace_minutes ?? 10); // default 10 minutes grace

          let punchStatus: 'present' | 'late' = 'present';
          let lateMinutes: number | null = null;

          if (time && classStartTimeStr) {
            const timeParts = time.split(':');
            const startParts = classStartTimeStr.split(':');
            if (timeParts.length >= 2 && startParts.length >= 2) {
              const punchTotal = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
              const startTotal = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
              const diff = punchTotal - startTotal;
              if (diff > graceMinutes) {
                punchStatus = 'late';
                lateMinutes = diff;
              }
            }
          }

          const { data: existingList } = await supabase
            .from('attendance')
            .select('id, status, session, late_minutes, arrival_time')
            .eq('institution_id', matchedInstitutionId)
            .eq('student_id', student.id)
            .eq('date', date);

          if (!existingList || existingList.length === 0) {
            const { error: insErr } = await supabase.from('attendance').insert({
              institution_id: matchedInstitutionId,
              student_id: student.id,
              class_id: student.class_id,
              date: date,
              status: punchStatus,
              late_minutes: lateMinutes,
              session: activeSessionId,
              arrival_time: time || '08:30',
              academic_year_id: academicYearId
            });

            if (!insErr) {
              processedCount++;
              console.log(`[ZKteco ADMS] Student Attendance Logged: ${student.student_name || student.id} -> ${punchStatus} on ${date} (Time: ${time})`);

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
          } else {
            const existingRec = existingList[0];
            // If already marked as leave by administration in the app, preserve leave status
            const targetStatus = existingRec.status === 'leave' ? 'leave' : punchStatus;
            const { error: updErr } = await supabase
              .from('attendance')
              .update({
                status: targetStatus,
                late_minutes: targetStatus === 'late' ? lateMinutes : existingRec.late_minutes,
                arrival_time: time || existingRec.arrival_time || '08:30',
                session: existingRec.session || activeSessionId,
                academic_year_id: academicYearId
              })
              .eq('id', existingRec.id);

            if (!updErr) {
              processedCount++;
              console.log(`[ZKteco ADMS] Student Attendance Updated: ${student.student_name || student.id} -> ${targetStatus} on ${date}`);
            } else {
              console.error('[ZKteco ADMS] Student attendance update error:', updErr);
            }
          }
        } else {
            // 2. Look up teacher if not found in students
            const teacher = (teachersList || []).find((t: any) => {
              const perms = t.permissions || {};
              const bioId = (perms.biometric_id || t.biometric_id || '').toString().trim();
              const teachId = (perms.teacher_id_number || '').toString().trim();
              const mobile = (t.mobile || '').toString().trim();

              if (bioId && bioId.toLowerCase() === userId.toLowerCase()) return true;
              if (!isNaN(numUserId) && bioId && !isNaN(Number(bioId)) && Number(bioId) === numUserId) return true;
              if (teachId && teachId.toLowerCase() === userId.toLowerCase()) return true;
              if (!isNaN(numUserId) && teachId && !isNaN(Number(teachId)) && Number(teachId) === numUserId) return true;
              if (mobile && mobile === userId) return true;
              return false;
            });

            if (teacher) {
              const { data: existingTList } = await supabase
                .from('teacher_attendance')
                .select('id, status')
                .eq('institution_id', matchedInstitutionId)
                .eq('teacher_id', teacher.id)
                .eq('date', date);

              if (!existingTList || existingTList.length === 0) {
                const { error: insTErr } = await supabase.from('teacher_attendance').insert({
                  institution_id: matchedInstitutionId,
                  teacher_id: teacher.id,
                  date: date,
                  status: 'present',
                  arrival_time: time || '08:30'
                });

                if (!insTErr) {
                  processedCount++;
                  console.log(`[ZKteco ADMS] Teacher Attendance Logged: ${teacher.teacher_name} -> Present on ${date}`);
                } else {
                  console.error('[ZKteco ADMS] Teacher attendance insert error:', insTErr);
                }
              } else {
                const existingT = existingTList[0];
                const { error: updTErr } = await supabase
                  .from('teacher_attendance')
                  .update({
                    status: 'present',
                    arrival_time: time || '08:30'
                  })
                  .eq('id', existingT.id);

                if (!updTErr) {
                  processedCount++;
                  console.log(`[ZKteco ADMS] Teacher Attendance Updated to Present: ${teacher.teacher_name} on ${date}`);
                }
              }
            } else {
              console.warn(`[ZKteco ADMS] Unrecognized biometric User ID "${userId}" on date ${date}`);
            }
          }
        }

        console.log(`[ZKteco ADMS/SDK] Finished processing payload. Logged ${processedCount} present records.`);
        if (req.headers['content-type']?.includes('application/json') || req.headers?.['accept']?.includes('json')) {
          const firstUserId = lines[0] ? (lines[0].split(/[\t,\s]+/)[0] || '').trim() : '';
          return res.status(200).json({ 
            success: true, 
            processed: processedCount,
            matched_institution: matchedInstitution?.name,
            device_sn: SN,
            message: processedCount > 0
              ? `সফলভাবে ${processedCount}টি হাজিরার রেকর্ড ডাটাবেজে উপস্থিত (Present) হিসেবে যুক্ত হয়েছে!`
              : `পাঞ্চ রিকোয়েস্ট সার্ভারে পৌঁছেছে, কিন্তু ইউজার আইডি "${firstUserId}" এর সাথে কোনো শিক্ষার্থী বা শিক্ষকের 'বায়োমেট্রিক আইডি' বা 'রোল' মেলেনি। অনুগ্রহ করে শিক্ষার্থী তালিকায় ছাত্রের প্রোফাইলে এই আইডিটি বসিয়ে নিন।`
          });
        }
    } catch (err: any) {
      console.error('[ZKteco ADMS/SDK] Exception in POST handler:', err);
    }

    return res.status(200).send('OK');
  }
  } catch (globalErr: any) {
    console.error('[ZKteco ADMS API] Global Handler Catch:', globalErr);
    if (req.headers?.['accept']?.includes('json') || req.headers?.['content-type']?.includes('json')) {
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
    const studentName = student.student_name || 'শিক্ষার্থী';
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
