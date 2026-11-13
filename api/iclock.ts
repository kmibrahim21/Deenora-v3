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

// In-Memory ADMS Command Queue for ZKTeco Cloud Sync: SN (Uppercase) -> string[]
const pendingAdmsCommands = new Map<string, string[]>();
let globalCmdCounter = 1;

// Bengali to English Transliteration for ZKTeco Machine LCD (ASCII only, max 23 chars)
const BN_TO_EN_NAME_MAP: Record<string, string> = {
  'মোঃ': 'MD.', 'মো:': 'MD.', 'মুহাম্মদ': 'MD.', 'মোহাম্মদ': 'MD.',
  'মোসাঃ': 'MST.', 'মোসা:': 'MST.', 'মোসাম্মৎ': 'MST.',
  'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
  'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
  'আলী': 'ALI', 'আলি': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
  'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
  'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উমর': 'UMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
  'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
  'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH',
  'মারুফ': 'MARUF', 'রাব্বি': 'RABBI', 'ফাহিম': 'FAHIM', 'আলম': 'ALAM',
  'জান্নাত': 'JANNAT', 'ফাতেমা': 'FATEMA', 'আয়েশা': 'AYESHA', 'খাদিজা': 'KHADIJA',
  'সুমাইয়া': 'SUMAIYA', 'মারিয়াম': 'MARIYAM', 'আক্তার': 'AKTER', 'খাতুন': 'KHATUN'
};

const BN_CHAR_MAP: Record<string, string> = {
  'অ': 'O', 'আ': 'A', 'ই': 'I', 'ঈ': 'I', 'উ': 'U', 'ঊ': 'U', 'ঋ': 'RI',
  'এ': 'E', 'ঐ': 'OI', 'ও': 'O', 'ঔ': 'OU',
  'া': 'A', 'ি': 'I', 'ী': 'I', 'ু': 'U', 'ূ': 'U', 'ৃ': 'RI',
  'ে': 'E', 'ৈ': 'OI', 'ো': 'O', 'ৌ': 'OU',
  'ক': 'K', 'খ': 'KH', 'গ': 'G', 'ঘ': 'GH', 'ঙ': 'NG',
  'চ': 'CH', 'ছ': 'CH', 'জ': 'J', 'ঝ': 'JH', 'ঞ': 'N',
  'ট': 'T', 'ঠ': 'TH', 'ড': 'D', 'ঢ': 'DH', 'ণ': 'N',
  'ত': 'T', 'থ': 'TH', 'দ': 'D', 'ধ': 'DH', 'ন': 'N',
  'প': 'P', 'ফ': 'F', 'ব': 'B', 'ভ': 'BH', 'ম': 'M',
  'য': 'Z', 'র': 'R', 'ল': 'L', 'শ': 'SH', 'ষ': 'SH', 'স': 'S', 'হ': 'H',
  'ড়': 'R', 'ঢ়': 'RH', 'য়': 'Y', 'ৎ': 'T', 'ং': 'NG', 'ঃ': '', 'ঁ': ''
};

function transliterateBnToEn(text?: string | null): string {
  if (!text || typeof text !== 'string') return 'STUDENT';
  const trimmed = text.trim();
  if (!trimmed) return 'STUDENT';

  if (/^[A-Za-z0-9\s._-]+$/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, ' ').slice(0, 23);
  }

  const words = trimmed.split(/[\s._-]+/).filter(Boolean);
  const convertedWords: string[] = [];

  for (const word of words) {
    if (BN_TO_EN_NAME_MAP[word]) {
      convertedWords.push(BN_TO_EN_NAME_MAP[word]);
      continue;
    }
    let res = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (BN_CHAR_MAP[ch] !== undefined) {
        res += BN_CHAR_MAP[ch];
      } else if (/[A-Za-z0-9]/.test(ch)) {
        res += ch.toUpperCase();
      }
    }
    if (res) convertedWords.push(res);
  }

  const clean = convertedWords.join(' ').replace(/[^A-Za-z0-9\s._-]/g, '').replace(/\s+/g, ' ').trim();
  return (clean ? clean.toUpperCase() : 'STUDENT').slice(0, 23);
}

async function getRegisteredDevices(forceRefresh: boolean = false): Promise<DeviceCacheEntry[]> {
  const now = Date.now();
  if (!forceRefresh && cachedDeviceList && (now - lastDeviceFetchTime) < DEVICE_CACHE_TTL_MS) {
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

async function generateAndQueueCommandsForDevice(instId: string, sn: string): Promise<string[]> {
  const [{ data: students }, { data: teachers }] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, name_en, roll, biometric_id, is_active, notes')
      .eq('institution_id', instId)
      .order('roll', { ascending: true }),
    supabase
      .from('teachers')
      .select('id, teacher_name, name, biometric_id, permissions, is_active')
      .eq('institution_id', instId)
  ]);

  const commands: string[] = [];
  (students || []).forEach((st: any, idx: number) => {
    if (st.is_active === false) return;
    let rawBio = (st.biometric_id || '').toString().trim();
    if (!rawBio && st.notes) {
      try {
        const parsed = typeof st.notes === 'string' ? JSON.parse(st.notes) : st.notes;
        rawBio = (parsed?.biometric_id || '').toString().trim();
      } catch (e) {}
    }
    if (!rawBio) {
      rawBio = (st.roll !== null && st.roll !== undefined) ? String(st.roll).trim() : String(idx + 1);
    }
    const cleanBioId = rawBio.replace(/[০-৯]/g, (d: string) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
    if (!cleanBioId) return;

    const cleanName = transliterateBnToEn(st.name_en || st.student_name || 'STUDENT');
    const cmdId = commands.length + 1;
    commands.push(`C:${cmdId}:DATA UPDATE USERINFO PIN=${cleanBioId}\tName=${cleanName}\tPri=0\tPasswd=\tCard=\tGrp=1`);
  });

  (teachers || []).forEach((t: any) => {
    if (t.is_active === false) return;
    const perms = t.permissions || {};
    const rawBio = (perms.biometric_id || t.biometric_id || perms.teacher_id_number || '').toString().trim();
    const cleanBioId = rawBio.replace(/[০-৯]/g, (d: string) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
    if (!cleanBioId) return;

    const cleanName = transliterateBnToEn(t.name || t.teacher_name || 'TEACHER');
    const cmdId = commands.length + 1;
    commands.push(`C:${cmdId}:DATA UPDATE USERINFO PIN=${cleanBioId}\tName=${cleanName}\tPri=0\tPasswd=\tCard=\tGrp=1`);
  });

  pendingAdmsCommands.set(sn.toUpperCase(), commands);
  return commands;
}

async function clearPendingAdmsSyncFlag(sn: string) {
  try {
    const devices = await getRegisteredDevices();
    const dev = devices.find(d => d.sn === sn.toUpperCase());
    if (!dev) return;
    const { data: inst } = await supabase
      .from('institutions')
      .select('config_json')
      .eq('id', dev.institution_id)
      .maybeSingle();
    if (inst && ((inst.config_json as any)?.pending_adms_sync_sn || (inst.config_json as any)?.pending_adms_sync)) {
      const cfg = { ...(inst.config_json as any) };
      delete cfg.pending_adms_sync_sn;
      delete cfg.pending_adms_sync;
      await supabase.from('institutions').update({ config_json: cfg }).eq('id', dev.institution_id);
    }
  } catch (e) {
    console.warn('[ZKteco ADMS] Failed to clear pending_adms_sync_sn:', e);
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

    // Extract Serial Number (SN) from URL query regex, query object, body, or headers
    const urlSnMatch = (req.originalUrl || req.url || '').match(/[?&]sn=([^&]+)/i);
    const snFromUrl = urlSnMatch ? decodeURIComponent(urlSnMatch[1]) : '';

    const rawSN = (
      query.SN || query.sn || query.device_sn || query.sn_number || snFromUrl ||
      (typeof req.body === 'object' && req.body !== null && (req.body?.SN || req.body?.sn)) ||
      req.headers['x-device-sn'] || ''
    ).toString().trim();
    const SN = rawSN.toUpperCase();

    const action = (
      query.action ||
      (typeof req.body === 'object' && req.body !== null && req.body?.action) ||
      ''
    ).toString().trim().toLowerCase();

    // 0. Handle ADMS User Queuing (Push students/teachers from Cloud to Machine)
    if (action === 'queue_users' || action === 'push_users') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      let targetInstId = (
        query.institution_id || query.institutionId || query.inst ||
        (typeof req.body === 'object' && req.body !== null && (req.body?.institution_id || req.body?.institutionId)) ||
        req.headers['x-institution-id'] || ''
      )?.toString().trim();

      let targetSn = (
        SN || query.target_sn || query.targetSn ||
        (typeof req.body === 'object' && req.body !== null && (req.body?.sn || req.body?.SN || req.body?.target_sn)) ||
        ''
      )?.toString().trim().toUpperCase();

      let registeredDevices = await getRegisteredDevices();
      if (!targetInstId && targetSn) {
        let dev = registeredDevices.find(d => d.sn === targetSn);
        if (!dev) {
          registeredDevices = await getRegisteredDevices(true);
          dev = registeredDevices.find(d => d.sn === targetSn);
        }
        if (dev) {
          targetInstId = dev.institution_id;
        }
      }

      if (!targetInstId) {
        return res.status(400).json({
          success: false,
          error: 'Institution ID পাওয়া যায়নি। অনুগ্রহ করে institution_id প্যারামিটার প্রদান করুন।'
        });
      }

      if (!targetSn) {
        const instDevs = registeredDevices.filter(d => d.institution_id === targetInstId);
        if (instDevs.length > 0) {
          targetSn = instDevs[0].sn;
        }
      }

      if (!targetSn) {
        return res.status(400).json({
          success: false,
          error: 'ডিভাইসের সিরিয়াল নম্বর (SN) পাওয়া যায়নি। অনুগ্রহ করে প্রথমে একটি ADMS ডিভাইস রেজিস্টার করুন।'
        });
      }

      const commands = await generateAndQueueCommandsForDevice(targetInstId, targetSn);

      // Persist pending_adms_sync_sn in institutions.config_json
      try {
        const { data: inst } = await supabase
          .from('institutions')
          .select('config_json')
          .eq('id', targetInstId)
          .maybeSingle();

        if (inst) {
          const cfg = (inst.config_json as any) || {};
          await supabase
            .from('institutions')
            .update({
              config_json: {
                ...cfg,
                pending_adms_sync_sn: targetSn.toUpperCase()
              }
            })
            .eq('id', targetInstId);
        }
      } catch (persistErr) {
        console.warn('[ZKteco ADMS] Failed to persist pending_adms_sync_sn in DB:', persistErr);
      }

      return res.status(200).json({
        success: true,
        queued: commands.length,
        device_sn: targetSn,
        institution_id: targetInstId,
        message: 'সকল শিক্ষার্থীর তথ্য ক্লাউড কিউতে যুক্ত হয়েছে। মেশিনটি অনলাইনে থাকলে কয়েক সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যাবে।'
      });
    }

    // 1. ZKTeco Machine Command Polling: GET /iclock/getrequest
    if (method === 'GET' && urlPath.includes('/getrequest')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');

      if (!SN) {
        return res.status(200).send('OK');
      }

      let commands = pendingAdmsCommands.get(SN);

      if (!commands || commands.length === 0) {
        // Fallback: check if DB has pending_adms_sync_sn for this SN
        try {
          let devices = await getRegisteredDevices();
          let dev = devices.find(d => d.sn === SN);
          if (!dev) {
            lastDeviceFetchTime = 0;
            devices = await getRegisteredDevices(true);
            dev = devices.find(d => d.sn === SN);
          }
          if (dev && (dev.config_json?.pending_adms_sync_sn === SN || dev.config_json?.pending_adms_sync?.sn === SN)) {
            commands = await generateAndQueueCommandsForDevice(dev.institution_id, SN);
          }
        } catch (rebuildErr) {
          console.warn('[ZKteco ADMS] Error checking pending_adms_sync_sn:', rebuildErr);
        }
      }

      if (commands && commands.length > 0) {
        const toSend = commands.splice(0, 50);
        if (commands.length === 0) {
          pendingAdmsCommands.delete(SN);
          clearPendingAdmsSyncFlag(SN);
        }
        console.log(`[ZKteco ADMS] Sending ${toSend.length} queued commands to machine SN "${SN}" (${commands.length} remaining)`);
        return res.status(200).send(toSend.join('\n'));
      }

      return res.status(200).send('OK');
    }

    // 2. Machine Execution Callback: POST /iclock/devicecmd
    if (urlPath.includes('/devicecmd')) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send('OK');
    }

    // 3. Fast-path for ZKTeco ADMS machine heartbeats / handshakes:
    // Biometric devices send frequent GET /iclock/cdata or /push pulses.
    const isDeviceHeartbeat = method === 'GET' && (
      urlPath.includes('/cdata') || 
      urlPath.includes('/push')
    );

    if (isDeviceHeartbeat) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send('OK');
    }

    // 4. Browser / Admin Connection Ping Diagnostic (GET requests not from machine firmware)
    if (method === 'GET') {
      try {
        let registeredDevices = await getRegisteredDevices();
        const reqInstId = (
          query.institution_id || query.institutionId || query.inst ||
          req.headers['x-institution-id'] || req.headers['institution-id']
        )?.toString().trim();

        let matchedDevice = SN ? registeredDevices.find(d => d.sn === SN) : null;
        if (!matchedDevice && reqInstId) {
          matchedDevice = registeredDevices.find(d => d.institution_id === reqInstId);
        }

        // Force fresh DB lookup if SN provided and not found in cache:
        if (SN && !matchedDevice) {
          registeredDevices = await getRegisteredDevices(true);
          matchedDevice = registeredDevices.find(d => d.sn === SN);
          if (!matchedDevice && reqInstId) {
            matchedDevice = registeredDevices.find(d => d.institution_id === reqInstId);
          }
        }

        let instId = matchedDevice?.institution_id || '';
        let instName = matchedDevice?.institution_name || '';

        // Non-ADMS fallback lookup by ID or SN prefix
        if (!instId) {
          const fallbackId = reqInstId || (SN && SN.startsWith('PC_AGENT_') ? SN.replace(/^PC_AGENT_/i, '').trim() : null);
          if (fallbackId) {
            const { data: instData } = await supabase
              .from('institutions')
              .select('id, name')
              .eq('id', fallbackId)
              .maybeSingle();
            if (instData) {
              instId = instData.id;
              instName = instData.name;
            }
          }
        }

        if (instId) {
          const { students, teachers } = await getInstitutionDirectory(instId);

          const { data: recentLogs } = await supabase
            .from('attendance')
            .select('id, student_id, arrival_time, date, status, created_at')
            .eq('institution_id', instId)
            .order('created_at', { ascending: false })
            .limit(10);

          const bioStudents = students.filter((s: any) => Boolean(s.biometric_id || s.roll));
          const bioTeachers = teachers.filter((t: any) => Boolean(t.permissions?.biometric_id || t.biometric_id));
          const pendingCommandsCount = (SN && pendingAdmsCommands.get(SN)?.length) || 0;

          return res.status(200).json({
            success: true,
            status: 'REGISTERED_AND_ACTIVE',
            device_sn: SN || `PC_AGENT_${instId}`,
            institution: instName,
            institution_id: instId,
            biometric_students_count: bioStudents.length,
            biometric_teachers_count: bioTeachers.length,
            pending_commands_in_queue: pendingCommandsCount,
            recent_punches_logged: recentLogs || [],
            recommendation: bioStudents.length === 0 
              ? 'সতর্কতা: কোনো শিক্ষার্থীর বায়োমেট্রিক আইডি বা রোল যুক্ত করা হয়নি।'
              : 'প্রস্তুত: বায়োমেট্রিক ডিভাইস সফলভাবে সংযুক্ত এবং হাজিরা গ্রহণের জন্য প্রস্তুত।'
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
        query.institution_id || query.institutionId || query.inst ||
        req.headers['x-institution-id'] || req.headers['institution-id'] ||
        (typeof req.body === 'object' && req.body !== null && (req.body.institution_id || req.body.institutionId || req.body.inst))
      )?.toString().trim();

      if (reqInstId) {
        matchedDevice = registeredDevices.find(d => d.institution_id === reqInstId);
      } else if (SN) {
        matchedDevice = registeredDevices.find(d => d.sn === SN);
      }

      // If SN provided and not matched in cache, force fresh DB query:
      if (SN && !matchedDevice) {
        const freshDevices = await getRegisteredDevices(true);
        matchedDevice = freshDevices.find(d => d.sn === SN);
      }

      if (!matchedDevice && registeredDevices.length === 1) {
        matchedDevice = registeredDevices[0];
      }

      // Fallback for Non-ADMS Local PC Sync Agent:
      // Non-ADMS machines do not register SN in biometric_devices.
      // Lookup the institution directly by ID or SN prefix:
      if (!matchedDevice) {
        const fallbackInstId = reqInstId || (SN && SN.startsWith('PC_AGENT_') ? SN.replace(/^PC_AGENT_/i, '').trim() : null);
        if (fallbackInstId) {
          const { data: instData } = await supabase
            .from('institutions')
            .select('id, name, config_json')
            .eq('id', fallbackInstId)
            .maybeSingle();

          if (instData) {
            matchedDevice = {
              sn: SN || `PC_AGENT_${instData.id}`,
              name: `PC Sync Agent (${instData.name})`,
              institution_id: instData.id,
              institution_name: instData.name,
              config_json: instData.config_json
            };
          }
        }
      }

      // If still not matched, check if there is only 1 active institution in DB
      if (!matchedDevice) {
        const { data: singleInst } = await supabase
          .from('institutions')
          .select('id, name, config_json')
          .eq('is_active', true)
          .limit(2);

        if (singleInst && singleInst.length === 1) {
          matchedDevice = {
            sn: SN || `PC_AGENT_${singleInst[0].id}`,
            name: `PC Sync Agent (${singleInst[0].name})`,
            institution_id: singleInst[0].id,
            institution_name: singleInst[0].name,
            config_json: singleInst[0].config_json
          };
        }
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

      // Fetch directory, existing attendance, and fresh institution config_json in parallel
      const [{ students, teachers }, { data: existingAttendanceList }, { data: freshInstData }] = await Promise.all([
        getInstitutionDirectory(matchedInstitutionId),
        supabase
          .from('attendance')
          .select('id, student_id, status, session, late_minutes, arrival_time, date')
          .eq('institution_id', matchedInstitutionId)
          .in('date', Array.from(targetDates)),
        supabase
          .from('institutions')
          .select('config_json')
          .eq('id', matchedInstitutionId)
          .maybeSingle()
      ]);

      const instConfig = (freshInstData?.config_json as any) || (matchedDevice.config_json as any) || {};
      matchedDevice.config_json = instConfig;

      const existingAttMap = new Map<string, any>();
      (existingAttendanceList || []).forEach((att: any) => {
        existingAttMap.set(`${att.student_id}_${att.date}`, att);
      });

      // Teacher attendance in Deenora is stored in institutions.config_json.teacher_attendance[date][teacher_id] = status
      const existingTeacherAttConfig: Record<string, Record<string, string>> = {
        ...((instConfig.teacher_attendance as any) || {})
      };
      let teacherAttendanceModified = false;

      // Prepare batch operations
      const newStudentAttendanceBatch: any[] = [];
      const updateStudentAttendanceBatch: { id: string; updates: any }[] = [];
      const smsQueueBatch: any[] = [];

      const processedKeys = new Set<string>();
      let processedCount = 0;
      let alreadyMarkedCount = 0;
      const unmatchedUserIds = new Set<string>();

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
          if (rollNo && rollNo === userId) return true;
          if (!isNaN(numUserId) && rollNo && !isNaN(Number(rollNo)) && Number(rollNo) === numUserId) return true;
          if (regNo && regNo.toLowerCase() === userId.toLowerCase()) return true;
          if (!isNaN(numUserId) && regNo && !isNaN(Number(regNo)) && Number(regNo) === numUserId) return true;
          if (s.notes) {
            if (s.notes.includes(`"biometric_id":"${userId}"`) || s.notes.includes(`biometric_id:${userId}`)) return true;
            if (!isNaN(numUserId) && (s.notes.includes(`"biometric_id":${numUserId}`) || s.notes.includes(`"biometric_id":"${numUserId}"`))) return true;
          }
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
          const classGraceMinutes = Number(classTimes?.late_grace_minutes ?? settings.late_grace_minutes ?? 10);

          let punchStatus: 'present' | 'late' = 'present';
          let lateMinutes: number | null = null;

          if (time && classStartTimeStr) {
            const timeParts = time.split(':');
            const startParts = classStartTimeStr.split(':');
            if (timeParts.length >= 2 && startParts.length >= 2) {
              const punchTotal = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
              const startTotal = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
              const diff = punchTotal - startTotal;
              if (diff > classGraceMinutes) {
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
          } else if (
            (existingRec.status !== 'leave' && existingRec.status !== 'present' && existingRec.status !== 'late') ||
            (existingRec.status === 'late' && (
              punchStatus === 'present' ||
              (punchStatus === 'late' && lateMinutes !== null && (existingRec.late_minutes === null || existingRec.late_minutes === undefined || lateMinutes < Number(existingRec.late_minutes)))
            ))
          ) {
            updateStudentAttendanceBatch.push({
              id: existingRec.id,
              updates: {
                status: punchStatus,
                late_minutes: punchStatus === 'late' ? lateMinutes : null,
                arrival_time: time || existingRec.arrival_time || '08:30'
              }
            });
            processedCount++;
          } else {
            alreadyMarkedCount++;
          }
        } else {
          // 2. Match Teacher
          const teacher = teachers.find((t: any) => {
            const perms = t.permissions || {};
            const bioId = (perms.biometric_id || t.biometric_id || '').toString().trim();
            const teachId = (perms.teacher_id_number || t.teacher_id_number || '').toString().trim();
            const mobile = (t.mobile || '').toString().trim();
            const tId = (t.id || '').toString().trim();

            if (bioId && bioId.toLowerCase() === userId.toLowerCase()) return true;
            if (!isNaN(numUserId) && bioId && !isNaN(Number(bioId)) && Number(bioId) === numUserId) return true;
            if (teachId && teachId.toLowerCase() === userId.toLowerCase()) return true;
            if (!isNaN(numUserId) && teachId && !isNaN(Number(teachId)) && Number(teachId) === numUserId) return true;
            if (mobile && (mobile === userId || mobile.endsWith(userId))) return true;
            if (tId.toLowerCase().startsWith(userId.toLowerCase())) return true;
            return false;
          });

          if (teacher) {
            const punchKey = `teacher_${teacher.id}_${date}`;
            if (processedKeys.has(punchKey)) continue;
            processedKeys.add(punchKey);

            if (!existingTeacherAttConfig[date]) {
              existingTeacherAttConfig[date] = {};
            }
            if (existingTeacherAttConfig[date][teacher.id] !== 'present') {
              existingTeacherAttConfig[date][teacher.id] = 'present';
              teacherAttendanceModified = true;
              processedCount++;
            } else {
              alreadyMarkedCount++;
            }
          } else {
            unmatchedUserIds.add(userId);
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

      if (teacherAttendanceModified) {
        mutationPromises.push(
          supabase.from('institutions').update({
            config_json: {
              ...instConfig,
              teacher_attendance: existingTeacherAttConfig
            }
          }).eq('id', matchedInstitutionId)
        );
      }

      // Asynchronously queue SMS logs in batch without blocking response
      if (smsQueueBatch.length > 0) {
        mutationPromises.push(
          supabase.from('sms_logs').insert(smsQueueBatch)
        );
      }

      if (mutationPromises.length > 0) {
        const results = await Promise.allSettled(mutationPromises);
        for (const res of results) {
          if (res.status === 'rejected') {
            console.error('[ZKteco ADMS DB Mutation Error]:', res.reason);
          }
        }
      }

      console.log(`[ZKteco ADMS] Completed punch batch: ${processedCount} new/updated present records, ${alreadyMarkedCount} already marked for "${matchedDevice.institution_name}".`);

      if (req.headers['content-type']?.includes('application/json') || req.headers?.['accept']?.includes('json')) {
        let responseMsg = '';
        if (processedCount > 0) {
          responseMsg = `সফলভাবে ${processedCount}টি হাজিরার রেকর্ড ডাটাবেজে উপস্থিত হিসেবে যুক্ত হয়েছে!`;
        } else if (alreadyMarkedCount > 0) {
          responseMsg = `${alreadyMarkedCount}টি পাঞ্চ সফলভাবে গৃহীত হয়েছে (আজকের তারিখে ইতিমধ্যেই উপস্থিত হিসেবে সংরক্ষিত ছিল)।`;
        } else if (unmatchedUserIds.size > 0) {
          const idSample = Array.from(unmatchedUserIds).slice(0, 3).join(', ');
          responseMsg = `পাঞ্চ রিকোয়েস্ট এসেছে, কিন্তু ইউজার আইডি "${idSample}" এর সাথে কোনো শিক্ষার্থী বা শিক্ষকের বায়োমেট্রিক আইডি বা রোল মেলেনি।`;
        } else {
          responseMsg = 'পাঞ্চ রিসিভ হয়েছে।';
        }

        return res.status(200).json({
          success: true,
          processed: processedCount,
          already_present: alreadyMarkedCount,
          unmatched_ids: Array.from(unmatchedUserIds),
          matched_institution: matchedDevice.institution_name,
          device_sn: SN,
          message: responseMsg
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
