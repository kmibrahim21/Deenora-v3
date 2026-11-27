import { getSupabaseAdmin } from '../lib/supabase-admin.js';

// Module-level Singleton Supabase Client
const supabase = getSupabaseAdmin();

// In-Memory Device & Institution Cache (60 seconds TTL)
// Drastically cuts database queries during high-frequency biometric machine pings
interface RawPunchDiagnostic {
  timestamp: string;
  sn: string;
  table: string;
  raw_preview: string;
  parsed_pin: string | null;
  parsed_time: string | null;
  matched_name: string | null;
}

interface DeviceCacheEntry {
  sn: string;
  name?: string;
  brand?: 'zkteco' | 'vnotify' | 'hikvision';
  institution_id: string;
  institution_name: string;
  config_json?: any;
  last_seen_at?: string | null;
  ip?: string | null;
  recent_raw_punches?: RawPunchDiagnostic[];
}

let cachedDeviceList: DeviceCacheEntry[] | null = null;
let lastDeviceFetchTime = 0;
let lastUnknownSnRefreshTime = 0;
const DEVICE_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const DEVICE_HEARTBEAT_DB_THROTTLE_MS = 60 * 1000; // Persist last_seen_at to DB at most once every 60s per SN
const DEVICE_ONLINE_WINDOW_MS = 3 * 60 * 1000; // Online if seen within the last 3 minutes
const MAX_RAW_PUNCH_DIAGNOSTICS = 10;
const MAX_RAW_BODY_BYTES = 2 * 1024 * 1024; // 2MB cap for raw stream reads

// In-Memory ADMS Command Queue for ZKTeco Cloud Sync: SN (Uppercase) -> string[]
const pendingAdmsCommands = new Map<string, string[]>();
// In-Memory Device Last-Seen, IP & Recent Raw Punch Trackers: SN (Uppercase) -> Data
const deviceLastSeenMap = new Map<string, string>();
const deviceLastIpMap = new Map<string, string>();
const deviceRecentRawPunches = new Map<string, RawPunchDiagnostic[]>();
const deviceDbPersistThrottle = new Map<string, number>();
let globalCmdCounter = 1;

function sanitizeSnForPlainText(sn: string): string {
  return (sn || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64);
}

function makeRawPreview(raw: string, maxLen: number = 240): string {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/\n/g, ' | ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function mergeRecentRawPunches(
  memList?: RawPunchDiagnostic[] | null,
  dbList?: RawPunchDiagnostic[] | null
): RawPunchDiagnostic[] {
  const combined = [
    ...(Array.isArray(memList) ? memList : []),
    ...(Array.isArray(dbList) ? dbList : [])
  ].filter(item => item && typeof item === 'object' && typeof item.timestamp === 'string');

  const seen = new Set<string>();
  const deduped: RawPunchDiagnostic[] = [];
  for (const item of combined) {
    const key = `${item.timestamp}|${item.sn}|${item.parsed_pin ?? ''}|${item.parsed_time ?? ''}|${item.raw_preview}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const ta = Date.parse(a.timestamp);
    const tb = Date.parse(b.timestamp);
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return deduped.slice(0, MAX_RAW_PUNCH_DIAGNOSTICS);
}

function extractClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  const rawIp = Array.isArray(xff)
    ? xff[0]
    : (typeof xff === 'string' && xff.trim()
        ? xff.split(',')[0].trim()
        : (req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''));
  return String(rawIp || '').replace(/^::ffff:/i, '').replace(/[\r\n]/g, '').trim().slice(0, 64);
}

function resolveDeviceOnlineStatus(
  sn: string,
  dbLastSeen?: string | null,
  dbIp?: string | null
): { last_seen_at: string | null; is_online: boolean; ip: string | null } {
  const normSn = (sn || '').trim().toUpperCase();
  const memSeen = normSn ? deviceLastSeenMap.get(normSn) : undefined;
  const memIp = normSn ? deviceLastIpMap.get(normSn) : undefined;

  let latestSeen: string | null = null;
  const memMs = memSeen ? Date.parse(memSeen) : NaN;
  const dbMs = dbLastSeen ? Date.parse(dbLastSeen) : NaN;
  if (!Number.isNaN(memMs) && !Number.isNaN(dbMs)) {
    latestSeen = memMs >= dbMs ? memSeen! : dbLastSeen!;
  } else if (!Number.isNaN(memMs)) {
    latestSeen = memSeen!;
  } else if (!Number.isNaN(dbMs)) {
    latestSeen = dbLastSeen!;
  }

  const latestMs = latestSeen ? Date.parse(latestSeen) : NaN;
  const isOnline = !Number.isNaN(latestMs) && (Date.now() - latestMs) <= DEVICE_ONLINE_WINDOW_MS;
  return {
    last_seen_at: latestSeen,
    is_online: isOnline,
    ip: memIp || dbIp || null
  };
}

function findDeviceMetadataInConfig(
  configJson: any,
  targetSn: string
): { last_seen_at: string | null; ip: string | null; recent_raw_punches: RawPunchDiagnostic[] } {
  const normSn = (targetSn || '').trim().toUpperCase();
  if (!normSn || !configJson || typeof configJson !== 'object') {
    return { last_seen_at: null, ip: null, recent_raw_punches: [] };
  }
  const rawDevices = configJson.biometric_devices;
  const devicesList = Array.isArray(rawDevices) ? rawDevices : (rawDevices ? [rawDevices] : []);
  for (const entry of devicesList) {
    if (!entry || typeof entry !== 'object') continue;
    const entrySn = (entry.sn || entry.id || entry.device_sn || '').toString().trim().toUpperCase();
    if (entrySn === normSn) {
      return {
        last_seen_at: typeof entry.last_seen_at === 'string' ? entry.last_seen_at : null,
        ip: typeof entry.ip === 'string' ? entry.ip : null,
        recent_raw_punches: Array.isArray(entry.recent_raw_punches) ? entry.recent_raw_punches.slice(0, MAX_RAW_PUNCH_DIAGNOSTICS) : []
      };
    }
  }
  return { last_seen_at: null, ip: null, recent_raw_punches: [] };
}

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
            brand: dev?.brand || 'zkteco',
            institution_id: inst.id,
            institution_name: inst.name,
            config_json: inst.config_json,
            last_seen_at: typeof dev === 'object' && dev?.last_seen_at ? String(dev.last_seen_at) : null,
            ip: typeof dev === 'object' && dev?.ip ? String(dev.ip) : null,
            recent_raw_punches: typeof dev === 'object' && Array.isArray(dev?.recent_raw_punches)
              ? dev.recent_raw_punches.slice(0, MAX_RAW_PUNCH_DIAGNOSTICS)
              : []
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

async function recordDeviceHeartbeat(sn: string, clientIp: string): Promise<void> {
  const normSn = (sn || '').trim().toUpperCase();
  if (!normSn) return;

  try {
    let devices = await getRegisteredDevices();
    let dev = devices.find(d => d.sn === normSn);
    if (!dev && (Date.now() - lastUnknownSnRefreshTime) >= 15_000) {
      lastUnknownSnRefreshTime = Date.now();
      devices = await getRegisteredDevices(true);
      dev = devices.find(d => d.sn === normSn);
    }

    // Only track heartbeats for valid registered devices
    if (!dev) return;

    const nowIso = new Date().toISOString();
    deviceLastSeenMap.set(normSn, nowIso);
    if (clientIp) {
      deviceLastIpMap.set(normSn, clientIp);
    }
    dev.last_seen_at = nowIso;
    if (clientIp) {
      dev.ip = clientIp;
    }

    const nowMs = Date.now();
    const lastPersisted = deviceDbPersistThrottle.get(normSn) || 0;
    if (nowMs - lastPersisted < DEVICE_HEARTBEAT_DB_THROTTLE_MS) {
      return;
    }
    deviceDbPersistThrottle.set(normSn, nowMs);

    // Fetch fresh config_json strictly scoped to the device's institution_id so concurrent config updates are preserved
    const { data: inst } = await supabase
      .from('institutions')
      .select('config_json')
      .eq('id', dev.institution_id)
      .maybeSingle();

    if (!inst) return;

    const cfg = (inst.config_json && typeof inst.config_json === 'object') ? { ...(inst.config_json as any) } : {};
    const rawDevices = cfg.biometric_devices;

    if (Array.isArray(rawDevices)) {
      let updated = false;
      const nextDevices = rawDevices.map((entry: any) => {
        const entrySn = (typeof entry === 'string' ? entry : (entry?.sn || entry?.id || entry?.device_sn || '')).toString().trim().toUpperCase();
        if (entrySn === normSn) {
          updated = true;
          if (typeof entry === 'string') {
            return {
              sn: entry.trim(),
              last_seen_at: nowIso,
              ...(clientIp ? { ip: clientIp } : {})
            };
          }
          return {
            ...entry,
            last_seen_at: nowIso,
            ...(clientIp ? { ip: clientIp } : {})
          };
        }
        return entry;
      });
      if (updated) {
        await supabase
          .from('institutions')
          .update({
            config_json: {
              ...cfg,
              biometric_devices: nextDevices
            }
          })
          .eq('id', dev.institution_id);
      }
    } else if (rawDevices && typeof rawDevices === 'object') {
      const entrySn = (rawDevices.sn || rawDevices.id || rawDevices.device_sn || '').toString().trim().toUpperCase();
      if (entrySn === normSn) {
        await supabase
          .from('institutions')
          .update({
            config_json: {
              ...cfg,
              biometric_devices: {
                ...rawDevices,
                last_seen_at: nowIso,
                ...(clientIp ? { ip: clientIp } : {})
              }
            }
          })
          .eq('id', dev.institution_id);
      }
    } else if (typeof rawDevices === 'string' && rawDevices.trim().toUpperCase() === normSn) {
      await supabase
        .from('institutions')
        .update({
          config_json: {
            ...cfg,
            biometric_devices: [{
              sn: rawDevices.trim(),
              last_seen_at: nowIso,
              ...(clientIp ? { ip: clientIp } : {})
            }]
          }
        })
        .eq('id', dev.institution_id);
    }
  } catch (hbErr) {
    console.warn('[ZKteco ADMS] Failed to record device heartbeat:', hbErr);
  }
}

async function recordRecentRawPunches(
  institutionId: string | null,
  sn: string,
  newEntries: RawPunchDiagnostic[]
): Promise<void> {
  if (!newEntries || newEntries.length === 0) return;
  const normSn = (sn || '').trim().toUpperCase();
  if (!normSn) return;

  // 1. Update in-memory diagnostics ring buffer (latest 10, newest first, bounded map size)
  if (!deviceRecentRawPunches.has(normSn) && deviceRecentRawPunches.size >= 500) {
    const oldestKey = deviceRecentRawPunches.keys().next().value;
    if (oldestKey) deviceRecentRawPunches.delete(oldestKey);
  }
  const existingMem = deviceRecentRawPunches.get(normSn) || [];
  const mergedMem = mergeRecentRawPunches(newEntries, existingMem);
  deviceRecentRawPunches.set(normSn, mergedMem);

  if (!institutionId) return;

  // 2. Persist latest 10 items inside the matching device entry in institutions.config_json.biometric_devices
  try {
    const { data: inst } = await supabase
      .from('institutions')
      .select('config_json')
      .eq('id', institutionId)
      .maybeSingle();

    if (!inst) return;

    const cfg = (inst.config_json && typeof inst.config_json === 'object') ? { ...(inst.config_json as any) } : {};
    const rawDevices = cfg.biometric_devices;

    const buildUpdatedDevice = (entry: any) => {
      const base = typeof entry === 'string' ? { sn: entry.trim() } : { ...entry };
      const existingDb = Array.isArray(base.recent_raw_punches) ? base.recent_raw_punches : [];
      const nextPunches = mergeRecentRawPunches(mergedMem, existingDb);
      deviceRecentRawPunches.set(normSn, nextPunches);
      return {
        ...base,
        recent_raw_punches: nextPunches
      };
    };

    if (Array.isArray(rawDevices)) {
      let updated = false;
      const nextDevices = rawDevices.map((entry: any) => {
        const entrySn = (typeof entry === 'string' ? entry : (entry?.sn || entry?.id || entry?.device_sn || '')).toString().trim().toUpperCase();
        if (entrySn === normSn) {
          updated = true;
          return buildUpdatedDevice(entry);
        }
        return entry;
      });
      if (updated) {
        await supabase
          .from('institutions')
          .update({
            config_json: {
              ...cfg,
              biometric_devices: nextDevices
            }
          })
          .eq('id', institutionId);
      }
    } else if (rawDevices && typeof rawDevices === 'object') {
      const entrySn = (rawDevices.sn || rawDevices.id || rawDevices.device_sn || '').toString().trim().toUpperCase();
      if (entrySn === normSn) {
        await supabase
          .from('institutions')
          .update({
            config_json: {
              ...cfg,
              biometric_devices: buildUpdatedDevice(rawDevices)
            }
          })
          .eq('id', institutionId);
      }
    } else if (typeof rawDevices === 'string' && rawDevices.trim().toUpperCase() === normSn) {
      await supabase
        .from('institutions')
        .update({
          config_json: {
            ...cfg,
            biometric_devices: [buildUpdatedDevice(rawDevices)]
          }
        })
        .eq('id', institutionId);
    }

    // Keep cached device entry in sync
    if (cachedDeviceList) {
      const cachedDev = cachedDeviceList.find(d => d.sn === normSn && d.institution_id === institutionId);
      if (cachedDev) {
        cachedDev.recent_raw_punches = deviceRecentRawPunches.get(normSn) || mergedMem;
      }
    }
  } catch (diagPersistErr) {
    console.warn('[ZKteco ADMS] Failed to persist recent_raw_punches:', diagPersistErr);
  }
}

function normalizePunchTimestamp(rawTime: string): { date: string; time: string | null; fullTime: string } | null {
  let norm = String(rawTime || '').trim();
  if (!norm) return null;

  // Convert 14-digit YYYYMMDDHHmmss to YYYY-MM-DD HH:mm:ss
  if (/^\d{14}$/.test(norm)) {
    norm = `${norm.slice(0, 4)}-${norm.slice(4, 6)}-${norm.slice(6, 8)} ${norm.slice(8, 10)}:${norm.slice(10, 12)}:${norm.slice(12, 14)}`;
  }

  norm = norm.replace('T', ' ').replace(/\//g, '-');
  const m = norm.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;

  const year = m[1];
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  if (m[4] !== undefined && m[5] !== undefined) {
    const hour = m[4].padStart(2, '0');
    const min = m[5].padStart(2, '0');
    const sec = m[6] ? m[6].padStart(2, '0') : '00';
    return {
      date,
      time: `${hour}:${min}`,
      fullTime: `${date} ${hour}:${min}:${sec}`
    };
  }

  return {
    date,
    time: null,
    fullTime: date
  };
}

interface ParsedPunchLine {
  userId: string;
  date: string;
  time: string | null;
  fullTime: string;
  rawLine: string;
}

function isNonAttendanceMetaLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /^(OPLOG|USER|USERPIC|FP|BIODATA|FACE|TEMPLATE|OPTIONS|BIOPHOTO)\b/i.test(trimmed);
}

function parseSenseFacePunchLine(rawLine: string): ParsedPunchLine | null {
  const trimmed = rawLine.trim();
  if (!trimmed || isNonAttendanceMetaLine(trimmed)) return null;

  // Strip leading table prefix like "ATTLOG\t" or "RTLOG\t"
  const cleanLine = trimmed.replace(/^(ATTLOG|RTLOG)[\t\s]+/i, '').trim();
  if (!cleanLine || isNonAttendanceMetaLine(cleanLine)) return null;

  let userId = '';
  let rawCheckTime = '';

  // 1. Key-value format (e.g. SenseFace 2A RTLOG: "time=2026-11-27 18:20:05\tpin=101\t..." or "PIN=101\tTime=2026-11-27 18:20:05")
  const kvPinMatch = cleanLine.match(/(?:^|[\t,&\s])(?:pin|userid|user_id|enrollid)\s*=\s*([^\t,&\s]+)/i);
  const kvTimeMatch = cleanLine.match(/(?:^|[\t,&\s])(?:time|checktime|check_time|datetime|verifytime)\s*=\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?|\d{14})/i);

  if (kvPinMatch && kvTimeMatch) {
    userId = kvPinMatch[1].trim();
    rawCheckTime = kvTimeMatch[1].trim();
  } else {
    const isDateToken = (tok: string) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(tok) || /^\d{14}$/.test(tok);

    if (cleanLine.includes('\t')) {
      const parts = cleanLine.split('\t').map(p => p.trim());
      if (isDateToken(parts[0] || '') && parts[1]) {
        rawCheckTime = parts[0];
        userId = parts[1];
      } else if (parts[0] && isDateToken(parts[1] || '')) {
        userId = parts[0];
        rawCheckTime = parts[1];
      } else {
        userId = parts[0] || '';
        rawCheckTime = parts[1] || '';
      }
    } else if (cleanLine.includes(',')) {
      const parts = cleanLine.split(',').map(p => p.trim());
      if (isDateToken(parts[0] || '') && parts[1]) {
        rawCheckTime = parts[0];
        userId = parts[1];
      } else if (parts[0] && isDateToken(parts[1] || '')) {
        userId = parts[0];
        rawCheckTime = parts[1];
      } else {
        userId = parts[0] || '';
        rawCheckTime = parts[1] || '';
      }
    } else {
      const parts = cleanLine.split(/\s+/).filter(Boolean);
      if (isDateToken(parts[0] || '')) {
        if (parts.length >= 3 && parts[1].includes(':')) {
          rawCheckTime = `${parts[0]} ${parts[1]}`;
          userId = parts[2];
        } else if (parts.length >= 2) {
          rawCheckTime = parts[0];
          userId = parts[1];
        }
      } else {
        userId = parts[0] || '';
        if (parts.length >= 3 && isDateToken(parts[1] || '') && parts[2].includes(':')) {
          rawCheckTime = `${parts[1]} ${parts[2]}`;
        } else {
          rawCheckTime = parts[1] || '';
        }
      }
    }
  }

  userId = userId.trim();
  if (!userId || !rawCheckTime) return null;
  const upperUser = userId.toUpperCase();
  if (upperUser === 'USERID' || upperUser === 'PIN' || upperUser === 'TIME') return null;

  const normalizedTs = normalizePunchTimestamp(rawCheckTime);
  if (!normalizedTs) return null;

  return {
    userId,
    date: normalizedTs.date,
    time: normalizedTs.time,
    fullTime: normalizedTs.fullTime,
    rawLine: trimmed
  };
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
      .select('id, teacher_name, mobile, permissions, is_active')
      .eq('institution_id', instId)
  ]);

  const commands: string[] = [];
  (students || []).forEach((st: any) => {
    if (st.is_active === false) return;
    let rawBio = (st.biometric_id || '').toString().trim();
    if (!rawBio && st.notes) {
      try {
        const parsed = typeof st.notes === 'string' ? JSON.parse(st.notes) : st.notes;
        rawBio = (parsed?.biometric_id || '').toString().trim();
      } catch (e) {}
    }
    if (!rawBio && st.roll !== null && st.roll !== undefined) {
      rawBio = String(st.roll).trim();
    }
    if (!rawBio) return;
    const cleanBioId = rawBio.replace(/[০-৯]/g, (d: string) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
    if (!cleanBioId) return;

    const cleanName = transliterateBnToEn(st.name_en || st.student_name || 'STUDENT');
    const cmdId = commands.length + 1;
    commands.push(`C:${cmdId}:DATA UPDATE USERINFO PIN=${cleanBioId}\tName=${cleanName}\tPri=0\tPasswd=\tCard=\tGrp=1`);
  });

  (teachers || []).forEach((t: any) => {
    if (t.is_active === false) return;
    let perms: any = {};
    try {
      perms = (typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions) || {};
    } catch {
      perms = {};
    }
    const rawBio = (perms.biometric_id || perms.teacher_id_number || '').toString().trim();
    const cleanBioId = rawBio.replace(/[০-৯]/g, (d: string) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
    if (!cleanBioId) return;

    const cleanName = transliterateBnToEn(t.teacher_name || 'TEACHER');
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
        .select('id, teacher_name, mobile, permissions, is_active')
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

async function resolveInstitutionBySn(sn?: string, fallbackInstId?: string): Promise<string | null> {
  if (fallbackInstId && fallbackInstId.trim()) {
    return fallbackInstId.trim();
  }
  const cleanSn = (sn || '').trim().toUpperCase();
  if (!cleanSn) return null;

  let devices = await getRegisteredDevices();
  let matched = devices.find(d => d.sn === cleanSn);
  if (!matched) {
    devices = await getRegisteredDevices(true);
    matched = devices.find(d => d.sn === cleanSn);
  }
  if (matched) return matched.institution_id;

  if (devices.length === 1) {
    return devices[0].institution_id;
  }
  return null;
}

async function readRawRequestBody(req: any): Promise<string> {
  if (typeof req._cachedRawBody === 'string') return req._cachedRawBody;
  if (Buffer.isBuffer(req.body)) {
    req._cachedRawBody = req.body.toString('utf-8');
    return req._cachedRawBody;
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    req._cachedRawBody = req.body;
    return req._cachedRawBody;
  }
  if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
    try {
      req._cachedRawBody = JSON.stringify(req.body);
      return req._cachedRawBody;
    } catch {
      return '';
    }
  }
  try {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buf.length;
      if (totalBytes > MAX_RAW_BODY_BYTES) {
        chunks.push(buf.subarray(0, Math.max(0, buf.length - (totalBytes - MAX_RAW_BODY_BYTES))));
        break;
      }
      chunks.push(buf);
    }
    req._cachedRawBody = Buffer.concat(chunks).toString('utf-8');
    return req._cachedRawBody;
  } catch {
    return '';
  }
}

const BN_DIGIT_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

function normalizeBioId(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[০-৯]/g, (d) => BN_DIGIT_MAP[d] ?? d)
    .trim();
}

function matchTeacherByPin(teachers: any[], userId: string, numUserId: number): any | undefined {
  const normUserId = normalizeBioId(userId);
  const normNumUserId = !isNaN(numUserId) ? numUserId : Number(normUserId);

  return teachers.find((t: any) => {
    if (t.is_active === false) return false;
    let perms: any = {};
    try {
      perms = (typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions) || {};
    } catch {
      perms = {};
    }
    const bioId = normalizeBioId(perms.biometric_id || t.biometric_id);
    const teachId = normalizeBioId(perms.teacher_id_number || t.teacher_id_number);
    const mobile = normalizeBioId(t.mobile);
    const tId = (t.id || '').toString().trim();

    if (bioId && bioId.toLowerCase() === normUserId.toLowerCase()) return true;
    if (normUserId && !isNaN(normNumUserId) && bioId && !isNaN(Number(bioId)) && Number(bioId) === normNumUserId) return true;
    if (teachId && teachId.toLowerCase() === normUserId.toLowerCase()) return true;
    if (normUserId && !isNaN(normNumUserId) && teachId && !isNaN(Number(teachId)) && Number(teachId) === normNumUserId) return true;
    if (mobile && (mobile === normUserId || (normUserId.length >= 6 && mobile.endsWith(normUserId)))) return true;
    if (normUserId.length >= 8 && tId.toLowerCase().startsWith(normUserId.toLowerCase())) return true;
    return false;
  });
}

function matchStudentByExplicitBioId(students: any[], userId: string, numUserId: number): any | undefined {
  const normUserId = normalizeBioId(userId);
  const normNumUserId = !isNaN(numUserId) ? numUserId : Number(normUserId);

  return students.find((s: any) => {
    const bId = normalizeBioId(s.biometric_id);
    const regNo = normalizeBioId(s.registration_number);

    if (bId && bId.toLowerCase() === normUserId.toLowerCase()) return true;
    if (normUserId && !isNaN(normNumUserId) && bId && !isNaN(Number(bId)) && Number(bId) === normNumUserId) return true;
    if (regNo && regNo.toLowerCase() === normUserId.toLowerCase()) return true;
    if (normUserId && !isNaN(normNumUserId) && regNo && !isNaN(Number(regNo)) && Number(regNo) === normNumUserId) return true;
    if (s.notes) {
      const notesStr = normalizeBioId(typeof s.notes === 'string' ? s.notes : JSON.stringify(s.notes));
      if (notesStr.includes(`"biometric_id":"${normUserId}"`) || notesStr.includes(`biometric_id:${normUserId}`)) return true;
      if (normUserId && !isNaN(normNumUserId) && (notesStr.includes(`"biometric_id":${normNumUserId}`) || notesStr.includes(`"biometric_id":"${normNumUserId}"`))) return true;
    }
    return false;
  });
}

function matchStudentByRollFallback(students: any[], userId: string, numUserId: number): any | undefined {
  const normUserId = normalizeBioId(userId);
  const normNumUserId = !isNaN(numUserId) ? numUserId : Number(normUserId);

  return students.find((s: any) => {
    const rollNo = (s.roll !== null && s.roll !== undefined) ? normalizeBioId(s.roll) : '';
    const sId = (s.id || '').toString().trim();

    if (rollNo && rollNo === normUserId) return true;
    if (normUserId && !isNaN(normNumUserId) && rollNo && !isNaN(Number(rollNo)) && Number(rollNo) === normNumUserId) return true;
    if (normUserId.length >= 8 && sId.toLowerCase().startsWith(normUserId.toLowerCase())) return true;
    return false;
  });
}

async function processPunch(institutionId: string, pin: string, timestampStr: string): Promise<boolean> {
  if (!institutionId || !pin || !timestampStr) return false;

  const userId = normalizeBioId(pin);
  let normTime = String(timestampStr).trim();

  // Convert 14-digit YYYYMMDDHHmmss to YYYY-MM-DD HH:mm:ss
  if (/^\d{14}$/.test(normTime)) {
    normTime = `${normTime.slice(0, 4)}-${normTime.slice(4, 6)}-${normTime.slice(6, 8)} ${normTime.slice(8, 10)}:${normTime.slice(10, 12)}:${normTime.slice(12, 14)}`;
  } else if (normTime.includes('T')) {
    normTime = normTime.replace('T', ' ');
  }

  const date = normTime.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(normTime)
    ? normTime.substring(0, 10)
    : new Date(Date.now() + 6 * 3600 * 1000).toISOString().substring(0, 10);

  const time = normTime.length >= 16
    ? normTime.substring(11, 16)
    : (normTime.includes(':') && normTime.length <= 8 ? normTime.substring(0, 5) : '08:30');

  const [{ students, teachers }, { data: existingAttendanceList }, { data: freshInstData }] = await Promise.all([
    getInstitutionDirectory(institutionId),
    supabase
      .from('attendance')
      .select('id, student_id, status, session, late_minutes, arrival_time, date')
      .eq('institution_id', institutionId)
      .eq('date', date),
    supabase
      .from('institutions')
      .select('config_json')
      .eq('id', institutionId)
      .maybeSingle()
  ]);

  const instConfig = (freshInstData?.config_json as any) || {};
  const settings = instConfig.attendance_settings || {};
  const shouldSendSms = instConfig.student_attendance_sms === true || instConfig.modules?.student_attendance_sms === true;
  const numUserId = Number(userId);

  // 1. Check Teacher explicit biometric_id / teacher_id_number / mobile AND Student explicit biometric_id / registration_number
  // Only fall back to Student roll if neither Teacher nor Student explicit biometric_id matched!
  const teacher = matchTeacherByPin(teachers, userId, numUserId);
  const explicitStudent = matchStudentByExplicitBioId(students, userId, numUserId);
  const student = explicitStudent || (!teacher ? matchStudentByRollFallback(students, userId, numUserId) : undefined);

  if (student) {
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

    const existingRec = (existingAttendanceList || []).find((a: any) => a.student_id === student.id);

    if (!existingRec) {
      await supabase.from('attendance').insert([{
        institution_id: institutionId,
        student_id: student.id,
        class_id: student.class_id,
        date: date,
        status: punchStatus,
        late_minutes: lateMinutes,
        session: activeSessionId,
        arrival_time: time || '08:30',
        academic_year_id: academicYearId
      }]);

      if (shouldSendSms && student.guardian_phone) {
        await supabase.from('sms_logs').insert([{
          institution_id: institutionId,
          recipient: student.guardian_phone,
          message: `শ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${student.student_name || 'শিক্ষার্থী'} আজ ${date} তারিখ সময় ${time || '08:30'}-এ মাদরাসায় প্রবেশ করেছে। ধন্যবাদ।`,
          status: 'queued',
          sms_count: 1
        }]);
      }
      return true;
    } else if (
      (existingRec.status !== 'leave' && existingRec.status !== 'present' && existingRec.status !== 'late') ||
      (existingRec.status === 'late' && (
        punchStatus === 'present' ||
        (punchStatus === 'late' && lateMinutes !== null && (existingRec.late_minutes === null || existingRec.late_minutes === undefined || lateMinutes < Number(existingRec.late_minutes)))
      ))
    ) {
      await supabase.from('attendance').update({
        status: punchStatus,
        late_minutes: punchStatus === 'late' ? lateMinutes : null,
        arrival_time: time || existingRec.arrival_time || '08:30'
      }).eq('id', existingRec.id);
      return true;
    }
    return true;
  }

  // 2. Process Teacher Match
  if (teacher) {
    const teacherStartTimeStr = settings.teacher_start_time || settings.start_time || '08:00';
    const teacherGraceMinutes = Number(settings.teacher_late_grace_minutes ?? settings.late_grace_minutes ?? 10);
    let punchStatus: 'present' | 'late' = 'present';
    let lateMinutes = 0;

    if (time && teacherStartTimeStr) {
      const timeParts = time.split(':');
      const startParts = teacherStartTimeStr.split(':');
      if (timeParts.length >= 2 && startParts.length >= 2) {
        const punchTotal = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
        const startTotal = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
        const diff = punchTotal - startTotal;
        if (diff > teacherGraceMinutes) {
          punchStatus = 'late';
          lateMinutes = diff;
        }
      }
    }

    const existingTeacherAttConfig: Record<string, Record<string, any>> = {
      ...((instConfig.teacher_attendance as any) || {})
    };
    if (!existingTeacherAttConfig[date]) {
      existingTeacherAttConfig[date] = {};
    }

    const currentVal = existingTeacherAttConfig[date][teacher.id];
    const currentStatus = typeof currentVal === 'string' ? currentVal : currentVal?.status;

    if (
      !currentVal ||
      (currentStatus !== 'present' && currentStatus !== 'leave' && (currentStatus !== 'late' || punchStatus === 'present'))
    ) {
      existingTeacherAttConfig[date][teacher.id] = punchStatus === 'late'
        ? { status: 'late', arrival_time: time || '08:30', late_minutes: lateMinutes }
        : 'present';
      await supabase.from('institutions').update({
        config_json: {
          ...instConfig,
          teacher_attendance: existingTeacherAttConfig
        }
      }).eq('id', institutionId);
    }
    return true;
  }

  return false;
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    const rawUrl = (
      req.headers?.['x-vercel-original-path'] ||
      req.headers?.['x-matched-path'] ||
      req.originalUrl ||
      req.url ||
      ''
    ).toString();
    const urlPath = rawUrl.toLowerCase();
    const query = req.query || {};
    const method = req.method;

    // =========================================================================
    // 1. ISOLATED PROTOCOL HANDLER: Vnotify.ai (SS900 V4.0 / FKWeb / EBKN)
    // =========================================================================
    const isVnotifyRequest = Boolean(
      req.headers?.['dev_id'] ||
      req.headers?.['request_code'] ||
      urlPath.includes('/hdata.aspx') ||
      urlPath.includes('/ebkn') ||
      urlPath.includes('/fkweb')
    );

    if (isVnotifyRequest) {
      const vnotifySn = (
        req.headers?.['dev_id'] ||
        req.headers?.['device_id'] ||
        query.dev_id ||
        query.sn ||
        query.SN ||
        ''
      ).toString().trim().toUpperCase();

      if (vnotifySn) {
        await recordDeviceHeartbeat(vnotifySn, extractClientIp(req));
      }

      res.setHeader('response_code', 'OK');
      res.setHeader('trans_id', String(req.headers?.['trans_id'] || '1'));
      res.setHeader('Content-Type', 'application/octet-stream');

      const requestCode = String(req.headers?.['request_code'] || query.request_code || '').toLowerCase().trim();
      if (requestCode === 'receive_cmd' || requestCode === 'fk_info' || requestCode === 'keepalive') {
        return res.status(200).send('result=OK');
      }

      // Parse attendance log payload (realtime_glog, send_log, or POST body containing JSON/XML)
      let rawBodyStr = '';
      let parsedObj: any = null;

      if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
        parsedObj = req.body;
        try {
          rawBodyStr = JSON.stringify(req.body);
        } catch (e) {}
      } else {
        rawBodyStr = await readRawRequestBody(req);
      }

      if (!parsedObj && rawBodyStr) {
        const firstBrace = rawBodyStr.indexOf('{');
        const lastBrace = rawBodyStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonCandidate = rawBodyStr.substring(firstBrace, lastBrace + 1);
          try {
            parsedObj = JSON.parse(jsonCandidate);
          } catch (e) {}
        }
      }

      let pin = '';
      let timestampStr = '';

      if (parsedObj && typeof parsedObj === 'object') {
        pin = String(
          parsedObj.user_id ??
          parsedObj.enroll_id ??
          parsedObj.userId ??
          parsedObj.pin ??
          ''
        ).trim();
        timestampStr = String(
          parsedObj.io_time ??
          parsedObj.verify_time ??
          parsedObj.time ??
          ''
        ).trim();
      }

      if ((!pin || !timestampStr) && rawBodyStr) {
        const xmlUserMatch = rawBodyStr.match(/<UserID>([^<]+)<\/UserID>/i);
        const xmlTimeMatch = rawBodyStr.match(/<Time>([^<]+)<\/Time>/i);
        if (!pin && xmlUserMatch) pin = xmlUserMatch[1].trim();
        if (!timestampStr && xmlTimeMatch) timestampStr = xmlTimeMatch[1].trim();
      }

      if (/^\d{14}$/.test(timestampStr)) {
        const s = timestampStr;
        timestampStr = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
      }

      if (pin && timestampStr) {
        const institutionId = await resolveInstitutionBySn(vnotifySn, query.institution_id || query.institutionId);
        if (institutionId) {
          await processPunch(institutionId, pin, timestampStr);
        } else {
          console.warn(`[Vnotify.ai] Unregistered device SN "${vnotifySn}" sent punch for PIN=${pin}`);
        }
      }

      return res.status(200).send('result=OK');
    }

    // =========================================================================
    // 2. ISOLATED PROTOCOL HANDLER: Hikvision (ISAPI / AccessControllerEvent)
    // =========================================================================
    const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
    let rawBodyForHik = '';
    if (
      rawUrl.startsWith('/ISAPI') ||
      urlPath.includes('/isapi') ||
      contentType.includes('multipart/form-data') ||
      (typeof req.body === 'string' && req.body.includes('AccessControllerEvent')) ||
      Buffer.isBuffer(req.body)
    ) {
      rawBodyForHik = await readRawRequestBody(req);
    }

    const isHikvisionRequest = Boolean(
      rawUrl.startsWith('/ISAPI') ||
      urlPath.includes('/isapi') ||
      (typeof req.body === 'object' && req.body !== null && (req.body.AccessControllerEvent || req.body.event_log)) ||
      (rawBodyForHik && rawBodyForHik.includes('AccessControllerEvent'))
    );

    if (isHikvisionRequest) {
      if (!rawBodyForHik && (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0)) {
        rawBodyForHik = await readRawRequestBody(req);
      }

      let hikPayload: any = (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0)
        ? req.body
        : null;

      if (hikPayload?.event_log && typeof hikPayload.event_log === 'string') {
        try {
          hikPayload = JSON.parse(hikPayload.event_log);
        } catch (e) {}
      }
      if (!hikPayload && rawBodyForHik) {
        const firstBrace = rawBodyForHik.indexOf('{');
        const lastBrace = rawBodyForHik.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            hikPayload = JSON.parse(rawBodyForHik.substring(firstBrace, lastBrace + 1));
          } catch (e) {}
        }
      }

      const acEvent = hikPayload?.AccessControllerEvent || hikPayload || {};
      const hikSn = String(
        query.SN ||
        query.sn ||
        hikPayload?.shortSerialNumber ||
        hikPayload?.deviceID ||
        acEvent.deviceUUID ||
        hikPayload?.deviceUUID ||
        hikPayload?.macAddress ||
        acEvent.macAddress ||
        ''
      ).trim().toUpperCase();

      if (hikSn) {
        await recordDeviceHeartbeat(hikSn, extractClientIp(req));
      }

      const pin = String(
        acEvent.employeeNoString ??
        acEvent.employeeNo ??
        hikPayload?.employeeNoString ??
        hikPayload?.employeeNo ??
        ''
      ).trim();

      const timestampStr = String(
        hikPayload?.dateTime ??
        acEvent.dateTime ??
        acEvent.time ??
        hikPayload?.time ??
        ''
      ).trim();

      if (pin && timestampStr) {
        const institutionId = await resolveInstitutionBySn(hikSn, query.institution_id || query.institutionId);
        if (institutionId) {
          await processPunch(institutionId, pin, timestampStr);
        } else {
          console.warn(`[Hikvision ISAPI] Unregistered device SN "${hikSn}" sent punch for PIN=${pin}`);
        }
      }

      return res.status(200).json({ status: 'OK' });
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
    const clientIp = extractClientIp(req);

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

    // 1. ZKTeco SenseFace 2A / ADMS Registry & Ping Endpoints: /iclock/registry & /iclock/ping
    if (urlPath.includes('/registry')) {
      if (SN) {
        await recordDeviceHeartbeat(SN, clientIp);
      }
      const safeSn = sanitizeSnForPlainText(SN) || 'DEVICE';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`RegistryCode=Deenora_${safeSn}`);
    }

    if (urlPath.includes('/ping')) {
      if (SN) {
        await recordDeviceHeartbeat(SN, clientIp);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('OK');
    }

    // 2. ZKTeco Machine Command Polling: GET /iclock/getrequest
    if (method === 'GET' && urlPath.includes('/getrequest')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');

      if (!SN) {
        return res.status(200).send('OK');
      }

      await recordDeviceHeartbeat(SN, clientIp);

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

    // 3. Machine Execution Callback: POST /iclock/devicecmd
    if (urlPath.includes('/devicecmd')) {
      if (SN) {
        await recordDeviceHeartbeat(SN, clientIp);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('OK');
    }

    // 4. Full ZKTeco ADMS Push SDK Handshake: GET /iclock/cdata & GET /iclock/push
    const isDeviceHandshake = method === 'GET' && (
      urlPath.includes('/cdata') ||
      urlPath.includes('/push')
    );

    if (isDeviceHandshake) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const safeSn = sanitizeSnForPlainText(SN);
      if (SN && safeSn) {
        await recordDeviceHeartbeat(SN, clientIp);
        const admsOptions = [
          `GET OPTION FROM: ${safeSn}`,
          'Stamp=0',
          'ATTLOGStamp=0',
          'OPERLOGStamp=0',
          'ATTPHOTOStamp=0',
          'ErrorDelay=30',
          'Delay=10',
          'TransTimes=00:00;14:05',
          'TransInterval=1',
          'TransFlag=TransData AttLog\tOpLog\tEnrollUser\tChgUser\tEnrollFP\tChgFP\tUserPic',
          'TimeZone=6',
          'Realtime=1',
          'Encrypt=0'
        ].join('\n');
        return res.status(200).send(admsOptions);
      }
      return res.status(200).send('OK');
    }

    // 5. Browser / Admin Connection Ping Diagnostic (GET /api/iclock?action=status&sn=... or generic GET)
    if (method === 'GET') {
      try {
        let registeredDevices = await getRegisteredDevices(action === 'status');
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
          const targetSnForStatus = matchedDevice?.sn || SN || `PC_AGENT_${instId}`;
          let dbLastSeen: string | null = matchedDevice?.last_seen_at || null;
          let dbIp: string | null = matchedDevice?.ip || null;
          let dbRecentRawPunches: RawPunchDiagnostic[] = matchedDevice?.recent_raw_punches || [];

          // Fetch fresh config_json so serverless instances always read the latest DB-persisted last_seen_at & recent_raw_punches
          if (matchedDevice) {
            const { data: freshInst } = await supabase
              .from('institutions')
              .select('config_json')
              .eq('id', instId)
              .maybeSingle();
            if (freshInst?.config_json) {
              const freshMeta = findDeviceMetadataInConfig(freshInst.config_json, matchedDevice.sn);
              if (freshMeta.last_seen_at) dbLastSeen = freshMeta.last_seen_at;
              if (freshMeta.ip) dbIp = freshMeta.ip;
              if (freshMeta.recent_raw_punches.length > 0) dbRecentRawPunches = freshMeta.recent_raw_punches;
            }
          }

          const liveStatus = resolveDeviceOnlineStatus(targetSnForStatus, dbLastSeen, dbIp);
          const recentRawPunches = mergeRecentRawPunches(
            deviceRecentRawPunches.get(targetSnForStatus.toUpperCase()),
            dbRecentRawPunches
          );
          const { students, teachers } = await getInstitutionDirectory(instId);

          const { data: recentLogs } = await supabase
            .from('attendance')
            .select('id, student_id, arrival_time, date, status, created_at')
            .eq('institution_id', instId)
            .order('created_at', { ascending: false })
            .limit(10);

          const bioStudents = students.filter((s: any) => Boolean(s.biometric_id || s.roll));
          const bioTeachers = teachers.filter((t: any) => {
            let perms: any = {};
            try { perms = (typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions) || {}; } catch {}
            return Boolean(perms.biometric_id || perms.teacher_id_number || t.biometric_id);
          });
          const pendingCommandsCount = (SN && pendingAdmsCommands.get(SN)?.length) || 0;

          return res.status(200).json({
            success: true,
            status: 'REGISTERED_AND_ACTIVE',
            device_sn: targetSnForStatus,
            institution: instName,
            institution_id: instId,
            last_seen_at: liveStatus.last_seen_at,
            is_online: liveStatus.is_online,
            device_ip: liveStatus.ip,
            biometric_students_count: bioStudents.length,
            biometric_teachers_count: bioTeachers.length,
            pending_commands_in_queue: pendingCommandsCount,
            recent_punches_logged: recentLogs || [],
            recent_raw_punches: recentRawPunches,
            recommendation: bioStudents.length === 0 
              ? 'সতর্কতা: কোনো শিক্ষার্থীর বায়োমেট্রিক আইডি বা রোল যুক্ত করা হয়নি।'
              : 'প্রস্তুত: বায়োমেট্রিক ডিভাইস সফলভাবে সংযুক্ত এবং হাজিরা গ্রহণের জন্য প্রস্তুত।'
          });
        }

        if (SN && !matchedDevice) {
          return res.status(200).json({
            success: false,
            device_sn: SN,
            last_seen_at: null,
            is_online: false,
            recent_raw_punches: deviceRecentRawPunches.get(SN) || [],
            error: `মেশিনের সিরিয়াল নম্বর "${SN}" কোনো মাদরাসার সাথে রেজিস্টার করা নেই। অনুগ্রহ করে সেটিংস থেকে সিরিয়াল নম্বরটি যুক্ত করুন।`
          });
        }

        const sanitizedDevices = registeredDevices.map(d => {
          const st = resolveDeviceOnlineStatus(d.sn, d.last_seen_at, d.ip);
          return {
            sn: d.sn,
            name: d.name,
            brand: d.brand,
            institution_id: d.institution_id,
            institution_name: d.institution_name,
            last_seen_at: st.last_seen_at,
            is_online: st.is_online,
            ip: st.ip
          };
        });

        return res.status(200).json({
          success: true,
          message: 'Deenora ZKTeco ADMS / Biometric Machine API Active and Resilient',
          server_time: new Date().toISOString(),
          registered_devices_count: sanitizedDevices.length,
          registered_devices: sanitizedDevices
        });
      } catch (diagErr: any) {
        return res.status(500).json({ success: false, error: diagErr.message });
      }
    }

    // 6. ADMS Attendance Push Data (POST requests)
    if (method === 'POST') {
      res.setHeader('Content-Type', 'text/plain');

      if (SN && (urlPath.includes('/cdata') || urlPath.includes('/push'))) {
        await recordDeviceHeartbeat(SN, clientIp);
      }

      const tableParam = String(query.table || '').trim().toUpperCase();
      const eventTimestampIso = new Date().toISOString();

      let rawData: any = req.body;
      const isEmptyBodyObj = (
        typeof rawData === 'object' &&
        rawData !== null &&
        !Buffer.isBuffer(rawData) &&
        !Array.isArray(rawData) &&
        Object.keys(rawData).length === 0
      );

      // Read raw bytes directly from request stream when req.body is empty, undefined, or {}
      // (happens when ZKTeco SenseFace 2A sends application/octet-stream or omits Content-Type)
      if (rawData === undefined || rawData === null || rawData === '' || isEmptyBodyObj) {
        if (typeof req._cachedRawBody === 'string' && req._cachedRawBody.length > 0) {
          rawData = req._cachedRawBody;
        } else {
          try {
            const chunks: Buffer[] = [];
            let totalBytes = 0;
            for await (const chunk of req) {
              const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              totalBytes += buf.length;
              if (totalBytes > MAX_RAW_BODY_BYTES) {
                chunks.push(buf.subarray(0, Math.max(0, buf.length - (totalBytes - MAX_RAW_BODY_BYTES))));
                break;
              }
              chunks.push(buf);
            }
            rawData = Buffer.concat(chunks).toString('utf-8');
            req._cachedRawBody = rawData;
          } catch {
            rawData = '';
          }
        }
      }

      if (Buffer.isBuffer(rawData)) {
        rawData = rawData.toString('utf-8');
      }

      const originalRawString = typeof rawData === 'string' ? rawData : '';

      if (typeof rawData === 'string') {
        const trimmed = rawData.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            rawData = JSON.parse(trimmed);
          } catch {
            // keep as plain text
          }
        }
      }
      const parsedBodyObj: any = (typeof rawData === 'object' && rawData !== null) ? rawData : null;
      const effectiveTable = tableParam || String(parsedBodyObj?.table || '').trim().toUpperCase() || 'ATTLOG';

      // Handle JSON payload, Array, single-object logs, or form-urlencoded text lines
      if (typeof rawData === 'object' && rawData !== null) {
        if (Array.isArray(rawData)) {
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
        } else if (rawData.logs && typeof rawData.logs === 'object' && rawData.logs !== null) {
          const item = rawData.logs;
          const uId = item.userId || item.user_id || item.pin || item.id || '';
          const cTime = item.checkTime || item.check_time || item.time || item.timestamp || '';
          rawData = `${uId}\t${cTime}`;
        } else if (rawData.userId || rawData.user_id || rawData.pin) {
          const uId = rawData.userId || rawData.user_id || rawData.pin || '';
          const cTime = rawData.checkTime || rawData.check_time || rawData.time || rawData.timestamp || '';
          rawData = `${uId}\t${cTime}`;
        } else if ((rawData.table === 'ATTLOG' || rawData.table === 'RTLOG') && rawData.data) {
          rawData = rawData.data;
        } else {
          // Express / Vercel form parser turns text lines or key=value lines into object entries
          rawData = Object.entries(rawData)
            .flatMap(([k, v]) => {
              if (Array.isArray(v)) {
                return v.map(item => {
                  const s = (item === undefined || item === null) ? '' : String(item);
                  return s !== '' ? `${k}=${s}` : k;
                });
              }
              const valStr = (v === undefined || v === null) ? '' : String(v);
              return [valStr !== '' ? `${k}=${valStr}` : k];
            })
            .join('\n');
        }
      }

      const rawTextPayload = typeof rawData === 'string' ? rawData : originalRawString;

      // Fast match institution via cached device registry (resolved early so diagnostics persist accurately)
      const registeredDevices = await getRegisteredDevices();
      let matchedDevice: DeviceCacheEntry | undefined;

      const reqInstId = (
        query.institution_id || query.institutionId || query.inst ||
        req.headers['x-institution-id'] || req.headers['institution-id'] ||
        (parsedBodyObj && (parsedBodyObj.institution_id || parsedBodyObj.institutionId || parsedBodyObj.inst))
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

      const diagSn = matchedDevice?.sn || SN || 'UNKNOWN';
      const diagInstId = matchedDevice?.institution_id || null;

      // Handle OPERLOG or non-attendance table pushes immediately with OK
      if (effectiveTable === 'OPERLOG') {
        if (SN && urlPath.includes('/cdata')) {
          await recordRecentRawPunches(diagInstId, diagSn, [{
            timestamp: eventTimestampIso,
            sn: diagSn,
            table: effectiveTable,
            raw_preview: makeRawPreview(rawTextPayload || '(empty OPERLOG)'),
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
        return res.status(200).send('OK');
      }

      if (!rawTextPayload || typeof rawTextPayload !== 'string') {
        if (SN && urlPath.includes('/cdata')) {
          await recordRecentRawPunches(diagInstId, diagSn, [{
            timestamp: eventTimestampIso,
            sn: diagSn,
            table: effectiveTable,
            raw_preview: '(empty body)',
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
        if (req.headers['content-type']?.includes('application/json')) {
          return res.status(200).json({ success: true, processed: 0 });
        }
        return res.status(200).send('OK');
      }

      const lines = rawTextPayload.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
      if (lines.length === 0) {
        if (SN && urlPath.includes('/cdata')) {
          await recordRecentRawPunches(diagInstId, diagSn, [{
            timestamp: eventTimestampIso,
            sn: diagSn,
            table: effectiveTable,
            raw_preview: '(blank payload)',
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
        return res.status(200).send('OK');
      }

      // If every line is a metadata/OPERLOG line (OPLOG / USER / FP / etc.), return OK immediately
      if (lines.every((l: string) => isNonAttendanceMetaLine(l))) {
        if (SN && urlPath.includes('/cdata')) {
          await recordRecentRawPunches(diagInstId, diagSn, [{
            timestamp: eventTimestampIso,
            sn: diagSn,
            table: effectiveTable,
            raw_preview: makeRawPreview(lines[0]),
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
        return res.status(200).send('OK');
      }

      if (!matchedDevice) {
        console.warn(`[ZKteco ADMS Security] Unregistered device SN: "${SN}"`);
        if (SN && urlPath.includes('/cdata')) {
          await recordRecentRawPunches(null, SN, [{
            timestamp: eventTimestampIso,
            sn: SN,
            table: effectiveTable,
            raw_preview: makeRawPreview(lines[0]),
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
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

      // Parse all punch lines in memory (supports SenseFace 2A RTLOG key=value, prefixed ATTLOG/RTLOG, and classic tab/comma/space formats)
      const parsedPunches: ParsedPunchLine[] = [];
      const targetDates = new Set<string>();

      for (const line of lines) {
        const parsed = parseSenseFacePunchLine(line);
        if (!parsed) continue;
        parsedPunches.push(parsed);
        targetDates.add(parsed.date);
      }

      if (parsedPunches.length === 0) {
        if (urlPath.includes('/cdata') || SN) {
          await recordRecentRawPunches(matchedInstitutionId, diagSn, [{
            timestamp: eventTimestampIso,
            sn: diagSn,
            table: effectiveTable,
            raw_preview: makeRawPreview(lines[0]),
            parsed_pin: null,
            parsed_time: null,
            matched_name: null
          }]);
        }
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

      // Teacher attendance in Deenora is stored in institutions.config_json.teacher_attendance[date][teacher_id] = status | { status, arrival_time, late_minutes }
      const existingTeacherAttConfig: Record<string, Record<string, any>> = {
        ...((instConfig.teacher_attendance as any) || {})
      };
      let teacherAttendanceModified = false;

      // Prepare batch operations
      const newStudentAttendanceBatch: any[] = [];
      const updateStudentAttendanceBatch: { id: string; updates: any }[] = [];
      const smsQueueBatch: any[] = [];
      const rawPunchDiagEntries: RawPunchDiagnostic[] = [];

      const processedKeys = new Set<string>();
      let processedCount = 0;
      let alreadyMarkedCount = 0;
      const unmatchedUserIds = new Set<string>();

      const settings = instConfig.attendance_settings || {};
      const shouldSendSms = instConfig.student_attendance_sms === true || instConfig.modules?.student_attendance_sms === true;

      for (const punch of parsedPunches) {
        const userId = normalizeBioId(punch.userId);
        const { date, time } = punch;
        const numUserId = Number(userId);

        // 1. Check Teacher explicit biometric_id / teacher_id_number / mobile AND Student explicit biometric_id / registration_number
        // Only fall back to Student roll if neither Teacher nor Student explicit biometric_id matched!
        const teacher = matchTeacherByPin(teachers, userId, numUserId);
        const explicitStudent = matchStudentByExplicitBioId(students, userId, numUserId);
        const student = explicitStudent || (!teacher ? matchStudentByRollFallback(students, userId, numUserId) : undefined);

        const matchedName = student
          ? (student.student_name || student.name_en || null)
          : (teacher ? (teacher.teacher_name || null) : null);

        rawPunchDiagEntries.push({
          timestamp: eventTimestampIso,
          sn: diagSn,
          table: effectiveTable,
          raw_preview: makeRawPreview(punch.rawLine),
          parsed_pin: userId || punch.userId || null,
          parsed_time: punch.fullTime || null,
          matched_name: matchedName
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
        } else if (teacher) {
          const punchKey = `teacher_${teacher.id}_${date}`;
          if (processedKeys.has(punchKey)) continue;
          processedKeys.add(punchKey);

          const teacherStartTimeStr = settings.teacher_start_time || settings.start_time || '08:00';
          const teacherGraceMinutes = Number(settings.teacher_late_grace_minutes ?? settings.late_grace_minutes ?? 10);
          let punchStatus: 'present' | 'late' = 'present';
          let lateMinutes = 0;

          if (time && teacherStartTimeStr) {
            const timeParts = time.split(':');
            const startParts = teacherStartTimeStr.split(':');
            if (timeParts.length >= 2 && startParts.length >= 2) {
              const punchTotal = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
              const startTotal = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
              const diff = punchTotal - startTotal;
              if (diff > teacherGraceMinutes) {
                punchStatus = 'late';
                lateMinutes = diff;
              }
            }
          }

          if (!existingTeacherAttConfig[date]) {
            existingTeacherAttConfig[date] = {};
          }
          const currentVal = existingTeacherAttConfig[date][teacher.id];
          const currentStatus = typeof currentVal === 'string' ? currentVal : currentVal?.status;

          if (
            !currentVal ||
            (currentStatus !== 'present' && currentStatus !== 'leave' && (currentStatus !== 'late' || punchStatus === 'present'))
          ) {
            existingTeacherAttConfig[date][teacher.id] = punchStatus === 'late'
              ? { status: 'late', arrival_time: time || '08:30', late_minutes: lateMinutes }
              : 'present';
            teacherAttendanceModified = true;
            processedCount++;
          } else {
            alreadyMarkedCount++;
          }
        } else {
          unmatchedUserIds.add(userId);
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

      // Persist latest 10 raw punch diagnostics after attendance mutations settle so config_json updates never race
      if (rawPunchDiagEntries.length > 0) {
        const latestSlice = rawPunchDiagEntries.slice(-MAX_RAW_PUNCH_DIAGNOSTICS).reverse();
        await recordRecentRawPunches(matchedInstitutionId, diagSn, latestSlice);
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
