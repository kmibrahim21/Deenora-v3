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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') return res.status(200).send('OK');

    const { query } = req;
    const institutionId = (query.institution_id || query.inst || '').toString().trim();
    const ip = (query.ip || '192.168.1.201').toString().trim();
    const port = (query.port || '4370').toString().trim();
    const format = (query.format || 'bat').toString().toLowerCase();

    if (!institutionId) {
      return res.status(400).json({ error: 'institution_id is required' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    // Fetch active students
    const studentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id,student_name,name_en,roll,biometric_id,is_active&institution_id=eq.${encodeURIComponent(institutionId)}&is_active=eq.true&order=roll.asc&limit=3000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const students = studentRes.ok ? await studentRes.json() : [];

    // Fetch active teachers
    const teacherRes = await fetch(
      `${SUPABASE_URL}/rest/v1/teachers?select=id,name,permissions,biometric_id,is_active&institute_id=eq.${encodeURIComponent(institutionId)}&is_active=eq.true&limit=200`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const teachers = teacherRes.ok ? await teacherRes.json() : [];

    // Process Users for ZKTeco K40 (uid, user_id, name)
    const userList: Array<{ uid: number; user_id: string; name: string; role: string }> = [];
    const usedUids = new Set<number>();

    let currentUid = 1;
    const allocateUid = (preferred?: number): number => {
      if (preferred && preferred > 0 && !usedUids.has(preferred)) {
        usedUids.add(preferred);
        return preferred;
      }
      while (usedUids.has(currentUid)) {
        currentUid++;
      }
      usedUids.add(currentUid);
      return currentUid;
    };

    // 1. Map Students
    (students || []).forEach((s: any) => {
      const bioId = (s.biometric_id || s.roll || '').toString().trim();
      const numBioId = parseInt(bioId, 10);
      const uid = allocateUid(!isNaN(numBioId) && numBioId > 0 ? numBioId : undefined);
      const rawName = s.name_en || s.student_name;
      const cleanName = banglaToEnglishName(rawName);
      userList.push({
        uid,
        user_id: bioId || String(uid),
        name: cleanName,
        role: 'student'
      });
    });

    // 2. Map Teachers
    (teachers || []).forEach((t: any) => {
      const perms = t.permissions || {};
      const bioId = (perms.biometric_id || t.biometric_id || perms.teacher_id_number || '').toString().trim();
      const numBioId = parseInt(bioId, 10);
      const uid = allocateUid(!isNaN(numBioId) && numBioId > 0 ? numBioId : undefined);
      const cleanName = banglaToEnglishName(t.name);
      userList.push({
        uid,
        user_id: bioId || String(uid),
        name: cleanName,
        role: 'teacher'
      });
    });

    if (format === 'json') {
      return res.status(200).json({ success: true, count: userList.length, users: userList });
    }

    // Python script to upload users into K40
    const pyScript = `import sys
import time
import json

MACHINE_IP = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else '${ip}'
MACHINE_PORT = int(sys.argv[2].strip()) if len(sys.argv) > 2 and sys.argv[2].strip() else ${port}

USERS = ${JSON.stringify(userList)}

print("=" * 64)
print("DEENORA ZKTECO K40 STUDENT DATA UPLOADER")
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
    print(f"\\n[+] Uploading {len(USERS)} users into K40 memory...")
    success_count = 0
    fail_count = 0

    for idx, u in enumerate(USERS, 1):
        try:
            # set_user(uid, name, privilege, password, group_id, user_id, card)
            conn.set_user(
                uid=int(u['uid']),
                name=str(u['name'])[:24],
                privilege=0,
                password='',
                group_id='',
                user_id=str(u['user_id']),
                card=0
            )
            success_count += 1
            print(f"  [{idx}/{len(USERS)}] [OK] ID: {u['user_id']:<6} | {u['name']}")
        except Exception as u_err:
            fail_count += 1
            print(f"  [{idx}/{len(USERS)}] [FAIL] ID: {u['user_id']} ({u['name']}) -> {u_err}")

    print("\\n" + "=" * 64)
    print(f"[COMPLETED] Successfully uploaded: {success_count} | Failed: {fail_count}")
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
