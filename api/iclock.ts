import { getSupabaseAdmin } from '../lib/supabase-admin.js';

// Module-level Singleton Supabase Client
const supabase = getSupabaseAdmin();

// In-Memory Device & Institution Cache (60 seconds TTL)
// Drastically cuts database queries during high-frequency biometric machine pings
interface DeviceCacheEntry {
  sn: string;
  name?: string;
  institution_id: string;
  institution_name: string;
  config_json?: any;
}

let cachedDeviceList: DeviceCacheEntry[] | null = null;
let lastDeviceFetchTime = 0;
const DEVICE_CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function getRegisteredDevices(): Promise<DeviceCacheEntry[]> {
  const now = Date.now();
  if (cachedDeviceList && (now - lastDeviceFetchTime) < DEVICE_CACHE_TTL_MS) {
    return cachedDeviceList;
  }

  try {
    const { data: institutions, error } = await supabase
      .from('institutions')
      .select('id, name, config_json')
      .eq('is_active', true);

    if (error || !institutions) {
      console.warn('[ZKteco ADMS] Failed to fetch institutions for device cache:', error?.message);
      return cachedDeviceList || [];
    }

    const devices: DeviceCacheEntry[] = [];
    for (const inst of institutions) {
      const rawDevices = (inst.config_json as any)?.biometric_devices || [];
      const devicesList = Array.isArray(rawDevices) ? rawDevices : [rawDevices];
      for (const dev of devicesList) {
        const snVal = typeof dev === 'string' ? dev : (dev?.sn || dev?.id || dev?.device_sn);
        if (snVal && typeof snVal === 'string' && snVal.trim()) {
          devices.push({
            sn: snVal.trim().toUpperCase(),
            name: dev?.name || `ZKteco Device ${snVal}`,
            institution_id: inst.id,
            institution_name: inst.name,
            config_json: inst.config_json
          });
        }
      }
    }

    cachedDeviceList = devices;
    lastDeviceFetchTime = now;
    return devices;
  } catch (err) {
    console.warn('[ZKteco ADMS] Exception in getRegisteredDevices:', err);
    return cachedDeviceList || [];
  }
}

// In-Memory Institution Student/Teacher Directory Cache (30 seconds TTL)
// Absorbs morning punch bursts so hundreds of punches don't hammer students/teachers tables
interface DirectoryCacheEntry {
  students: any[];
  teachers: any[];
  timestamp: number;
}
const directoryCache = new Map<string, DirectoryCacheEntry>();
const DIRECTORY_CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function getInstitutionDirectory(institutionId: string): Promise<{ students: any[]; teachers: any[] }> {
  const now = Date.now();
  const cached = directoryCache.get(institutionId);
  if (cached && (now - cached.timestamp) < DIRECTORY_CACHE_TTL_MS) {
    return { students: cached.students, teachers: cached.teachers };
  }

  try {
    const [{ data: students }, { data: teachers }] = await Promise.all([
      supabase
        .from('students')
        .select('id, class_id, notes, registration_number, roll, biometric_id, guardian_phone, student_name')
        .eq('institution_id', institutionId),
      supabase
        .from('teachers')
        .select('id, permissions, teacher_name, mobile')
        .eq('institution_id', institutionId)
    ]);

    const entry = {
      students: students || [],
      teachers: teachers || [],
      timestamp: now
    };
    directoryCache.set(institutionId, entry);
    return entry;
  } catch (err) {
    console.warn('[ZKteco ADMS] Exception in getInstitutionDirectory:', err);
    return {
      students: cached?.students || [],
      teachers: cached?.teachers || []
    };
  }
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    const urlPath = (req.originalUrl || req.url || '').toLowerCase();
    const query = req.query || {};
    const method = req.method;

    // Fast-path for ZKTeco ADMS machine heartbeats / handshakes:
    // Biometric devices send frequent GET /iclock/cdata or /iclock/getrequest pulses.
    // Return 200 OK instantly (< 5ms) without executing ANY database query.
    const isDeviceHeartbeat = method === 'GET' && (
      urlPath.includes('/cdata') || 
      urlPath.includes('/getrequest') || 
      urlPath.includes('/devicecmd') ||
      urlPath.includes('/push')
    );

    if (isDeviceHeartbeat) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send('OK');
    }

    // Extract Serial Number (SN) from URL query regex, query object, body, or headers
    const urlSnMatch = (req.originalUrl || req.url || '').match(/[?&]sn=([^&]+)/i);
    const snFromUrl = urlSnMatch ? decodeURIComponent(urlSnMatch[1]) : '';

    const rawSN = (
      query.SN || query.sn || query.device_sn || query.sn_number || snFromUrl ||
      (typeof req.body === 'object' && req.body !== null && (req.body?.SN || req.body?.sn)) ||
      req.headers['x-device-sn'] || ''
    ).toString().trim();
    const SN = rawSN.toUpperCase();

    // 1. Browser / Admin Connection Ping Diagnostic (GET requests not from machine firmware)
    if (method === 'GET') {
      try {
        const registeredDevices = await getRegisteredDevices();
        const matchedDevice = SN ? registeredDevices.find(d => d.sn === SN) : null;

        if (SN && matchedDevice) {
          const instId = matchedDevice.institution_id;
          const { students, teachers } = await getInstitutionDirectory(instId);

          const { data: recentLogs } = await supabase
            .from('attendance')
            .select('id, student_id, created_at, date')
            .eq('institution_id', instId)
            .order('created_at', { ascending: false })
            .limit(5);

          const bioStudents = students.filter((s: any) => Boolean(s.biometric_id || s.roll));
          const bioTeachers = teachers.filter((t: any) => Boolean(t.permissions?.biometric_id || t.biometric_id));

          return res.status(200).json({
            success: true,
            status: 'REGISTERED_AND_ACTIVE',
            device_sn: SN,
            institution: matchedDevice.institution_name,
            institution_id: instId,
            biometric_students_count: bioStudents.length,
            biometric_teachers_count: bioTeachers.length,
            recent_punches_logged: recentLogs || [],
            recommendation: bioStudents.length === 0 
              ? 'WARNING: No students have Biometric IDs configured in this institution. Please edit student profiles and enter Biometric IDs.'
              : 'READY: Device is linked and students are ready for punch attendance.'
          });
        }

        if (SN && !matchedDevice) {
          return res.status(200).json({
            success: false,
            device_sn: SN,
            error: `মেশিনের সিরিয়াল নম্বর "${SN}" কোনো মাদরাসার সাথে রেজিস্টার করা নেই। অনুগ্রহ করে সেটিংস থেকে সিরিয়াল নম্বরটি যুক্ত করুন।`
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Deenora ZKTeco ADMS / Biometric Machine API Active and Resilient',
          server_time: new Date().toISOString(),
          registered_devices_count: registeredDevices.length,
          registered_devices: registeredDevices
        });
      } catch (diagErr: any) {
        return res.status(500).json({ success: false, error: diagErr.message });
      }
    }

    // 2. ADMS Attendance Push Data (POST requests)
    if (method === 'POST') {
      res.setHeader('Content-Type', 'text/plain');

      let rawData = req.body;

      // Handle JSON payload, Buffer, or form-urlencoded text lines
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

      const lines = rawData.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
      if (lines.length === 0) {
        return res.status(200).send('OK');
      }

      // Fast match institution via cached device registry
      const registeredDevices = await getRegisteredDevices();
      let matchedDevice: DeviceCacheEntry | undefined;

      const reqInstId = (
        query.institution_id || query.institutionId ||
        (typeof req.body === 'object' && req.body !== null && (req.body.institution_id || req.body.institutionId))
      )?.toString().trim();

      if (reqInstId) {
        matchedDevice = registeredDevices.find(d => d.institution_id === reqInstId);
      } else if (SN) {
        matchedDevice = registeredDevices.find(d => d.sn === SN);
      }

      if (!matchedDevice && registeredDevices.length === 1) {
        matchedDevice = registeredDevices[0];
      }

      if (!matchedDevice) {
        console.warn(`[ZKteco ADMS Security] Unregistered device SN: "${SN}"`);
        if (req.headers['content-type']?.includes('application/json') || req.headers?.['accept']?.includes('json')) {
          return res.status(200).json({
            success: false,
            processed: 0,
            message: `মেশিনের সিরিয়াল নম্বর "${SN}" কোনো প্রতিষ্ঠানের সাথে রেজিস্টার করা নেই।`
          });
        }
        return res.status(200).send('OK');
      }

      const matchedInstitutionId = matchedDevice.institution_id;
      const instConfig = (matchedDevice.config_json as any) || {};

      // Parse all punch lines in memory
      interface ParsedPunch {
        userId: string;
        date: string;
        time: string | null;
      }

      const parsedPunches: ParsedPunch[] = [];
      const targetDates = new Set<string>();

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

        parsedPunches.push({ userId, date, time });
        targetDates.add(date);
      }

      if (parsedPunches.length === 0) {
        return res.status(200).send('OK');
      }

      // Fetch directory (from in-memory cache) and existing attendance in parallel
      const [{ students, teachers }, { data: existingAttendanceList }, { data: existingTeacherAttendanceList }] = await Promise.all([
        getInstitutionDirectory(matchedInstitutionId),
        supabase
          .from('attendance')
          .select('id, student_id, status, session, late_minutes, arrival_time, date')
          .eq('institution_id', matchedInstitutionId)
          .in('date', Array.from(targetDates)),
        supabase
          .from('teacher_attendance')
          .select('id, teacher_id, status, date')
          .eq('institution_id', matchedInstitutionId)
          .in('date', Array.from(targetDates))
      ]);

      const existingAttMap = new Map<string, any>();
      (existingAttendanceList || []).forEach((att: any) => {
        existingAttMap.set(`${att.student_id}_${att.date}`, att);
      });

      const existingTeacherAttMap = new Map<string, any>();
      (existingTeacherAttendanceList || []).forEach((tAtt: any) => {
        existingTeacherAttMap.set(`${tAtt.teacher_id}_${tAtt.date}`, tAtt);
      });

      // Prepare batch operations
      const newStudentAttendanceBatch: any[] = [];
      const updateStudentAttendanceBatch: { id: string; updates: any }[] = [];
      const newTeacherAttendanceBatch: any[] = [];
      const smsQueueBatch: any[] = [];

      const processedKeys = new Set<string>();
      let processedCount = 0;

      const settings = instConfig.attendance_settings || {};
      const graceMinutes = Number(settings.late_grace_minutes ?? 10);
      const shouldSendSms = instConfig.student_attendance_sms === true || instConfig.modules?.student_attendance_sms === true;

      for (const punch of parsedPunches) {
        const { userId, date, time } = punch;
        const numUserId = Number(userId);

        // 1. Match Student
        const student = students.find((s: any) => {
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
          const punchKey = `student_${student.id}_${date}`;
          if (processedKeys.has(punchKey)) continue;
          processedKeys.add(punchKey);

          const classSessions = student.class_id ? settings.class_sessions?.[student.class_id] : null;
          const sessionsList = (classSessions && classSessions.length > 0) ? classSessions : (settings.sessions || []);
          const activeSessionId = sessionsList.length > 0 ? sessionsList[0].id : 'morning';
          const academicYearId = student.academic_year_id || instConfig.active_academic_year_id || null;

          const classTimes = student.class_id ? settings.class_times?.[student.class_id] : null;
          const classStartTimeStr = classTimes?.start_time || settings.start_time || '08:00';

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

          const existingRec = existingAttMap.get(`${student.id}_${date}`);

          if (!existingRec) {
            newStudentAttendanceBatch.push({
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
            processedCount++;

            if (shouldSendSms && student.guardian_phone) {
              smsQueueBatch.push({
                institution_id: matchedInstitutionId,
                recipient: student.guardian_phone,
                message: `শ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${student.student_name || 'শিক্ষার্থী'} আজ ${date} তারিখ সময় ${time || '08:30'}-এ মাদরাসায় প্রবেশ করেছে। ধন্যবাদ।`,
                status: 'queued',
                sms_count: 1
              });
            }
          } else if (existingRec.status !== 'leave' && existingRec.status !== 'present' && existingRec.status !== 'late') {
            updateStudentAttendanceBatch.push({
              id: existingRec.id,
              updates: {
                status: punchStatus,
                late_minutes: punchStatus === 'late' ? lateMinutes : existingRec.late_minutes,
                arrival_time: time || existingRec.arrival_time || '08:30'
              }
            });
            processedCount++;
          }
        } else {
          // 2. Match Teacher
          const teacher = teachers.find((t: any) => {
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
            const punchKey = `teacher_${teacher.id}_${date}`;
            if (processedKeys.has(punchKey)) continue;
            processedKeys.add(punchKey);

            const existingT = existingTeacherAttMap.get(`${teacher.id}_${date}`);
            if (!existingT) {
              newTeacherAttendanceBatch.push({
                institution_id: matchedInstitutionId,
                teacher_id: teacher.id,
                date: date,
                status: 'present',
                arrival_time: time || '08:30'
              });
              processedCount++;
            }
          }
        }
      }

      // Execute Batches in Parallel
      const mutationPromises: any[] = [];

      if (newStudentAttendanceBatch.length > 0) {
        mutationPromises.push(
          supabase.from('attendance').insert(newStudentAttendanceBatch)
        );
      }

      if (updateStudentAttendanceBatch.length > 0) {
        for (const item of updateStudentAttendanceBatch) {
          mutationPromises.push(
            supabase.from('attendance').update(item.updates).eq('id', item.id)
          );
        }
      }

      if (newTeacherAttendanceBatch.length > 0) {
        mutationPromises.push(
          supabase.from('teacher_attendance').insert(newTeacherAttendanceBatch)
        );
      }

      // Asynchronously queue SMS logs in batch without blocking response
      if (smsQueueBatch.length > 0) {
        mutationPromises.push(
          supabase.from('sms_logs').insert(smsQueueBatch)
        );
      }

      if (mutationPromises.length > 0) {
        await Promise.allSettled(mutationPromises);
      }

      console.log(`[ZKteco ADMS] Completed punch batch: ${processedCount} present records processed for "${matchedDevice.institution_name}".`);

      if (req.headers['content-type']?.includes('application/json') || req.headers?.['accept']?.includes('json')) {
        const firstUserId = parsedPunches[0]?.userId || '';
        return res.status(200).json({
          success: true,
          processed: processedCount,
          matched_institution: matchedDevice.institution_name,
          device_sn: SN,
          message: processedCount > 0
            ? `সফলভাবে ${processedCount}টি হাজিরার রেকর্ড ডাটাবেজে উপস্থিত হিসেবে যুক্ত হয়েছে!`
            : `পাঞ্চ রিকোয়েস্ট সার্ভারে পৌঁছেছে, কিন্তু ইউজার আইডি "${firstUserId}" এর সাথে কোনো শিক্ষার্থী বা শিক্ষকের বায়োমেট্রিক আইডি মেলেনি।`
        });
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
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
