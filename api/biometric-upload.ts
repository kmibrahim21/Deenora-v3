import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dictionary of common Bengali/Islamic names and titles for accurate transliteration
const COMMON_NAME_MAP: Record<string, string> = {
  'মোঃ': 'MD.',
  'মো:': 'MD.',
  'মুহাম্মদ': 'MD.',
  'মোহাম্মদ': 'MD.',
  'আব্দুল্লাহ': 'ABDULLAH',
  'আব্দুর': 'ABDUR',
  'রহমান': 'RAHMAN',
  'রহিম': 'RAHIM',
  'করিম': 'KARIM',
  'হাসান': 'HASAN',
  'হোসাইন': 'HOSSAIN',
  'হুসাইন': 'HOSSAIN',
  'আলী': 'ALI',
  'আলি': 'ALI',
  'আহমেদ': 'AHMED',
  'মাহমুদ': 'MAHMUD',
  'ইব্রাহিম': 'IBRAHIM',
  'খলিল': 'KHALIL',
  'ইসমাইল': 'ISMAIL',
  'ইউসুফ': 'YOUSUF',
  'ইউনুস': 'YUNUS',
  'সোলাইমান': 'SOLAIMAN',
  'সুলাইমান': 'SULAIMAN',
  'সালমান': 'SALMAN',
  'ফারসি': 'FARSI',
  'ফারুক': 'FARUK',
  'উমর': 'UMAR',
  'ওমর': 'OMAR',
  'উসমান': 'USMAN',
  'ওসমান': 'OSMAN',
  'আবু': 'ABU',
  'বকর': 'BAKR',
  'জাফর': 'JAFAR',
  'হামজা': 'HAMZA',
  'বিলাল': 'BILAL',
  'তারেক': 'TAREK',
  'ফয়সাল': 'FAISAL',
  'জুবায়ের': 'ZUBAIR',
  'জুবায়ের': 'ZUBAIR',
  'মারুফ': 'MARUF',
  'শাকিল': 'SHAKIL',
  'নাঈম': 'NAEEM',
  'মাহফুজ': 'MAHFUZ',
  'তানভীর': 'TANVIR',
  'কাওসার': 'KAWSAR',
  'নোমান': 'NOMAN',
  'আরিফ': 'ARIF',
  'রায়হান': 'RAYHAN',
  'রায়হান': 'RAYHAN',
  'সাকিব': 'SAKIB',
  'রাব্বি': 'RABBI',
  'ফাহিম': 'FAHIM',
  'সাইফুল': 'SAIFUL',
  'ইসলাম': 'ISLAM',
  'আলম': 'ALAM',
  'হোসেন': 'HOSSAIN',
  'চৌধুরী': 'CHOWDHURY',
  'খান': 'KHAN',
  'শেখ': 'SHEIKH',
  'সৈয়দ': 'SYED',
  'সৈয়দ': 'SYED',
  'মোল্লা': 'MOLLA',
  'মিয়া': 'MIA',
  'আক্তার': 'AKTER',
  'খাতুন': 'KHATUN',
  'বেগম': 'BEGUM',
  'জান্নাত': 'JANNAT',
  'ফাতেমা': 'FATEMA',
  'আয়েশা': 'AYESHA',
  'খাদিজা': 'KHADIJA',
  'মারিয়াম': 'MARIYAM',
  'সুমাইয়া': 'SUMAIYA'
};

// General Bengali Phonetic Character Map
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

export function banglaToEnglishName(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'STUDENT';
  const trimmed = name.trim();
  if (!trimmed) return 'STUDENT';

  // If already pure ASCII English
  if (/^[A-Za-z0-9\s._-]+$/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, ' ').slice(0, 24);
  }

  // Tokenize by spaces / punctuation
  const words = trimmed.split(/[\s._-]+/).filter(Boolean);
  const convertedWords: string[] = [];

  for (const word of words) {
    if (COMMON_NAME_MAP[word]) {
      convertedWords.push(COMMON_NAME_MAP[word]);
      continue;
    }

    // Phonetic letter-by-letter conversion
    let res = '';
    let i = 0;
    while (i < word.length) {
      const char = word[i];
      if (BN_CHAR_MAP[char] !== undefined) {
        res += BN_CHAR_MAP[char];
      } else if (/[A-Za-z0-9]/.test(char)) {
        res += char.toUpperCase();
      }
      i++;
    }

    if (res) convertedWords.push(res);
  }

  const finalName = convertedWords.join(' ').replace(/[^A-Z0-9\s.-]/gi, '').replace(/\s+/g, ' ').trim().toUpperCase();
  return (finalName || 'STUDENT').slice(0, 24);
}

const BN_DIGIT_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

export function normalizeBioId(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[০-৯]/g, (d) => BN_DIGIT_MAP[d] ?? d)
    .trim();
}

function parseNotesExtra(notes: any): Record<string, any> | null {
  if (!notes) return null;
  if (typeof notes === 'object') return notes as Record<string, any>;
  const str = String(notes).trim();
  if (!str) return null;
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  const admMatch = str.match(/\[ADM_EXTRA:(\{[\s\S]*?\})\]/);
  if (admMatch && admMatch[1]) {
    try {
      const parsed = JSON.parse(admMatch[1]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  const bioMatch = str.match(/"biometric_id"\s*:\s*"?([^",}\]]+)"?/i) || str.match(/biometric_id\s*:\s*([^\s,}\]]+)/i);
  if (bioMatch && bioMatch[1]) {
    return { biometric_id: bioMatch[1] };
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') return res.status(200).send('OK');

    const { query } = req;
    const institutionId = (query.institution_id || query.inst || '').toString().trim();
    const rawIp = (query.ip || '192.168.1.201').toString().trim();
    const ip = /^[A-Za-z0-9.:-]+$/.test(rawIp) ? rawIp : '192.168.1.201';
    const parsedPort = parseInt((query.port || '4370').toString().trim(), 10);
    const port = !isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? String(parsedPort) : '4370';
    const format = (query.format || 'bat').toString().toLowerCase();

    if (!institutionId) {
      return res.status(400).json({ error: 'institution_id is required' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    // Fetch active students sorted deterministically by created_at, id so existing slots never shift
    const studentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id,student_name,name_en,roll,biometric_id,registration_number,is_active,notes,created_at&institution_id=eq.${encodeURIComponent(institutionId)}&is_active=eq.true&order=created_at.asc,id.asc&limit=3000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const students = studentRes.ok ? await studentRes.json() : [];

    // Fetch active teachers sorted deterministically by created_at, id
    const teacherRes = await fetch(
      `${SUPABASE_URL}/rest/v1/teachers?select=id,teacher_name,permissions,mobile,is_active,created_at&institution_id=eq.${encodeURIComponent(institutionId)}&is_active=eq.true&order=created_at.asc,id.asc&limit=200`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const teachers = teacherRes.ok ? await teacherRes.json() : [];

    // Process Users for ZKTeco K40 (16-bit safe sequential uid, actual biometric ID in user_id)
    const userList: Array<{ uid: number; user_id: string; name: string; role: string }> = [];
    const usedUids = new Set<number>();

    let currentUid = 1;
    const allocateUid = (): number => {
      while (usedUids.has(currentUid) && currentUid < 65000) {
        currentUid++;
      }
      usedUids.add(currentUid);
      return currentUid;
    };

    const sortedStudents = Array.isArray(students)
      ? [...students].sort((a: any, b: any) => {
          const ca = String(a?.created_at || '');
          const cb = String(b?.created_at || '');
          if (ca !== cb) return ca.localeCompare(cb);
          return String(a?.id || '').localeCompare(String(b?.id || ''));
        })
      : [];

    // 1. Map Students (exact priority: biometric_id -> notes.biometric_id -> registration_number -> roll)
    sortedStudents.forEach((st: any) => {
      if (st.is_active === false) return;
      const parsedNotes = parseNotesExtra(st.notes);
      const bioId =
        normalizeBioId(st.biometric_id) ||
        normalizeBioId(parsedNotes?.biometric_id) ||
        normalizeBioId(st.registration_number) ||
        normalizeBioId(st.roll);
      if (!bioId) return;
      const uid = allocateUid();
      const rawName = st.name_en || st.student_name;
      const cleanName = banglaToEnglishName(rawName);
      userList.push({
        uid,
        user_id: bioId,
        name: cleanName,
        role: 'student'
      });
    });

    const sortedTeachers = Array.isArray(teachers)
      ? [...teachers].sort((a: any, b: any) => {
          const ca = String(a?.created_at || '');
          const cb = String(b?.created_at || '');
          if (ca !== cb) return ca.localeCompare(cb);
          return String(a?.id || '').localeCompare(String(b?.id || ''));
        })
      : [];

    // 2. Map Teachers
    sortedTeachers.forEach((t: any) => {
      if (t.is_active === false) return;
      let perms: any = {};
      try {
        perms = (typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions) || {};
      } catch {
        perms = {};
      }
      const bioId =
        normalizeBioId(perms.biometric_id) ||
        normalizeBioId(t.biometric_id) ||
        normalizeBioId(perms.teacher_id_number);
      if (!bioId) return;
      const uid = allocateUid();
      const cleanName = banglaToEnglishName(t.teacher_name || t.name);
      userList.push({
        uid,
        user_id: bioId,
        name: cleanName,
        role: 'teacher'
      });
    });

    if (format === 'json') {
      return res.status(200).json({ success: true, count: userList.length, users: userList });
    }

    // Python script to upload users into K40 with smart incremental sync & old serial rewrite
    const pyScript = `# -*- coding: utf-8 -*-
import sys
import re
import time
import json

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

MACHINE_IP = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else '${ip}'
MACHINE_PORT = int(sys.argv[2].strip()) if len(sys.argv) > 2 and sys.argv[2].strip() else ${port}

USERS = ${JSON.stringify(userList)}

BN_DIGIT_TRANS = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')

def normalize_bio_id(val):
    if val is None:
        return ''
    return str(val).translate(BN_DIGIT_TRANS).strip()

def normalize_name_key(name):
    s = str(name or 'STUDENT').translate(BN_DIGIT_TRANS)
    s = re.sub(r'[^A-Za-z0-9\\s._-]', '', s)
    s = re.sub(r'\\s+', ' ', s).strip().upper()
    return (s or 'STUDENT')[:24]

print("=" * 64)
print("DEENORA ZKTECO K40 SMART INCREMENTAL STUDENT UPLOADER")
print(f"Target Machine IP : {MACHINE_IP}:{MACHINE_PORT}")
print(f"Total Users Found : {len(USERS)} (Students & Teachers)")
print("=" * 64)

try:
    from zk import ZK
except ImportError:
    print("[!] Installing pyzk library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk"])
    from zk import ZK

def connect_zk():
    for candidate_ip in [MACHINE_IP, "192.168.1.201", "192.168.0.201", "192.168.1.202", "192.168.0.202"]:
        try:
            print(f"[+] Connecting to ZKTeco machine at {candidate_ip}:{MACHINE_PORT}...")
            zk = ZK(candidate_ip, port=MACHINE_PORT, timeout=5, password=0, force_udp=False)
            conn = zk.connect()
            print(f"[OK] Successfully connected to {candidate_ip}!")
            return conn
        except Exception:
            try:
                zk = ZK(candidate_ip, port=MACHINE_PORT, timeout=5, password=0, force_udp=True)
                conn = zk.connect()
                print(f"[OK] Successfully connected to {candidate_ip} (UDP)!")
                return conn
            except Exception:
                continue
    return None

conn = connect_zk()
if not conn:
    print("[ERROR] Could not connect to ZKTeco K40. Please check:")
    print("  1. Machine is turned ON.")
    print("  2. Ethernet cable / Wi-Fi is connected to the same router as this PC.")
    print("  3. Machine IP in Menu -> Comm. -> Ethernet matches.")
    input("\\nPress Enter to exit...")
    sys.exit(1)

try:
    print("\\n[+] Reading existing users from ZKTeco machine...")
    try:
        existing_users = conn.get_users() or []
    except Exception as read_err:
        print(f"[!] Could not read existing users ({read_err}), continuing with fresh upload...")
        existing_users = []

    print(f"[OK] Found {len(existing_users)} existing users on machine.")

    existing_by_user_id = {}
    existing_by_uid = {}
    existing_by_name = {}
    used_uids = set()
    max_existing_uid = 0

    for eu in existing_users:
        eu_uid = int(getattr(eu, 'uid', 0) or 0)
        eu_user_id = normalize_bio_id(getattr(eu, 'user_id', ''))
        eu_name = normalize_name_key(getattr(eu, 'name', ''))
        if eu_uid > 0:
            used_uids.add(eu_uid)
            existing_by_uid[eu_uid] = eu
            if eu_uid > max_existing_uid:
                max_existing_uid = eu_uid
        if eu_user_id:
            existing_by_user_id[eu_user_id] = eu
        if eu_name:
            existing_by_name.setdefault(eu_name, []).append(eu)

    claimed_uids = set()
    for u in USERS:
        uid_str = normalize_bio_id(u.get('user_id', ''))
        if uid_str and uid_str in existing_by_user_id:
            claimed_uids.add(int(existing_by_user_id[uid_str].uid))

    new_uploaded_count = 0
    rewritten_count = 0
    skipped_count = 0
    fail_count = 0

    for idx, u in enumerate(USERS, 1):
        clean_name = normalize_name_key(u.get('name', 'STUDENT'))
        user_id_val = normalize_bio_id(u.get('user_id', ''))
        expected_slot_uid = int(u.get('uid', idx) or idx)
        if not user_id_val:
            user_id_val = str(expected_slot_uid)

        try:
            # Case A: Already exists with matching user_id
            matched_user = existing_by_user_id.get(user_id_val)
            if matched_user is not None:
                existing_uid = int(matched_user.uid)
                existing_name = normalize_name_key(getattr(matched_user, 'name', ''))
                if existing_name == clean_name:
                    skipped_count += 1
                    print(f"  [{idx}/{len(USERS)}] [SKIP] Slot: {existing_uid:<4} | ID: {user_id_val:<8} | {clean_name}")
                    continue
                conn.set_user(
                    uid=existing_uid,
                    name=clean_name,
                    privilege=0,
                    password=str(getattr(matched_user, 'password', '') or ''),
                    group_id='1',
                    user_id=user_id_val,
                    card=int(getattr(matched_user, 'card', 0) or 0)
                )
                rewritten_count += 1
                print(f"  [{idx}/{len(USERS)}] [REWRITE] Slot: {existing_uid:<4} | ID: {user_id_val:<8} | {clean_name}")
                continue

            # Case B: Old 1, 2, 3 serial rewrite by normalized name or unclaimed slot uid
            rewrite_user = None
            for cand in existing_by_name.get(clean_name, []):
                cand_uid = int(cand.uid)
                cand_uid_str = normalize_bio_id(getattr(cand, 'user_id', ''))
                if cand_uid not in claimed_uids and cand_uid_str != user_id_val:
                    rewrite_user = cand
                    break

            if rewrite_user is None and expected_slot_uid in existing_by_uid:
                slot_cand = existing_by_uid[expected_slot_uid]
                slot_uid = int(slot_cand.uid)
                slot_user_id = normalize_bio_id(getattr(slot_cand, 'user_id', ''))
                slot_name = normalize_name_key(getattr(slot_cand, 'name', ''))
                if slot_uid not in claimed_uids and slot_user_id != user_id_val and (slot_user_id == str(slot_uid) or slot_name == clean_name):
                    rewrite_user = slot_cand

            if rewrite_user is not None:
                existing_uid = int(rewrite_user.uid)
                claimed_uids.add(existing_uid)
                old_id = normalize_bio_id(getattr(rewrite_user, 'user_id', ''))
                conn.set_user(
                    uid=existing_uid,
                    name=clean_name,
                    privilege=0,
                    password=str(getattr(rewrite_user, 'password', '') or ''),
                    group_id='1',
                    user_id=user_id_val,
                    card=int(getattr(rewrite_user, 'card', 0) or 0)
                )
                rewritten_count += 1
                print(f"  [{idx}/{len(USERS)}] [REWRITE] Slot: {existing_uid:<4} | {old_id} -> {user_id_val:<8} | {clean_name}")
                continue

            # Case C: Newly added student/teacher -> allocate next unused uid
            max_existing_uid += 1
            while max_existing_uid in used_uids:
                max_existing_uid += 1
            new_uid = max_existing_uid
            used_uids.add(new_uid)
            claimed_uids.add(new_uid)
            conn.set_user(
                uid=new_uid,
                name=clean_name,
                privilege=0,
                password='',
                group_id='1',
                user_id=user_id_val,
                card=0
            )
            new_uploaded_count += 1
            print(f"  [{idx}/{len(USERS)}] [NEW] Slot: {new_uid:<4} | ID: {user_id_val:<8} | {clean_name}")
        except Exception as u_err:
            fail_count += 1
            print(f"  [{idx}/{len(USERS)}] [FAIL] ID: {user_id_val} ({clean_name}) -> {u_err}")

    print("\\n" + "=" * 64)
    print(f"নতুন আপলোড: {new_uploaded_count} | আইডি আপডেট (Rewrite): {rewritten_count} | আগে থেকেই ছিল (Skipped): {skipped_count}")
    if fail_count > 0:
        print(f"[!] ব্যর্থ (Failed): {fail_count}")
    print("Students can now register their fingerprints directly on the K40 machine!")
    print("=" * 64)
except Exception as e:
    print(f"[ERROR] Upload interrupted: {e}")
finally:
    try:
        conn.disconnect()
    except Exception:
        pass

input("\\nPress Enter to exit...")
`;

    if (format === 'py') {
      res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="deenora_k40_upload_students.py"');
      return res.status(200).send(pyScript);
    }

    const base64Py = Buffer.from(pyScript, 'utf-8').toString('base64');
    const batContent = `@echo off
setlocal EnableDelayedExpansion
title Deenora ZKTeco K40 Student Uploader
color 0A
cls

echo ===================================================================
echo               DEENORA ZKTECO K40 STUDENT UPLOADER
echo ===================================================================
echo This tool will automatically upload all student and teacher names
echo and roll numbers from Deenora into your ZKTeco K40 machine.
echo ===================================================================
echo.

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=python
    goto RUN_PY
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=py
    goto RUN_PY
)

echo [!] Python is required to communicate with ZKTeco K40 machine.
echo [*] Downloading and opening Python Installer...
start https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
echo [IMPORTANT] During installation, check "Add python.exe to PATH"!
echo After installing Python, run this file again.
pause
exit /b

:RUN_PY
echo [1/2] Checking local pyzk dependency...
%PY_CMD% -m pip install pyzk --quiet >nul 2>&1

echo [2/2] Preparing K40 Data Uploader...
set "TEMP_PY=%TEMP%\\deenora_k40_uploader_%RANDOM%.py"
powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Py}')) | Out-File -FilePath '%TEMP_PY%' -Encoding UTF8"

echo.
%PY_CMD% "%TEMP_PY%" "${ip}" "${port}"

del "%TEMP_PY%" >nul 2>&1
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Deenora-K40-Upload-Students.bat"');
    return res.status(200).send(batContent);
  } catch (err: any) {
    console.error('[Biometric Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
