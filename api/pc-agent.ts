import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const supabase = getSupabaseAdmin();

// Common Bengali/Islamic Name Transliteration for ZKTeco LCD
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const rawInstitutionId = (query.institution_id || query.institutionId || query.inst || '').toString().trim();
  const institutionId = rawInstitutionId.replace(/[^A-Za-z0-9_-]/g, '');
  const rawDeviceIp = (query.device_ip || query.deviceIp || '192.168.0.201').toString().trim();
  const deviceIp = /^[A-Za-z0-9.:-]+$/.test(rawDeviceIp) ? rawDeviceIp : '192.168.0.201';
  const format = (query.format || '').toString().trim().toLowerCase();
  const action = (query.action || '').toString().trim().toLowerCase();

  const rawHost = (req.headers.host || 'deenora.app').toString().trim();
  const serverHost = /^[A-Za-z0-9.:-]+$/.test(rawHost) ? rawHost : 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  let institutionName = 'Deenora Madrasah';
  let userList: Array<{ uid: number; user_id: string; name: string; role: string }> = [];

  if (institutionId) {
    try {
      const { data: inst } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', institutionId)
        .maybeSingle();
      if (inst?.name) {
        institutionName = inst.name;
      }
    } catch {
      // ignore
    }

    try {
      const { data: students } = await supabase
        .from('students')
        .select('id, student_name, name_en, roll, biometric_id, registration_number, is_active, notes, created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      // ZKTeco K40 internal slot uid MUST be 1..3000 (16-bit safe).
      // Actual student biometric ID / reg / roll goes into user_id (PIN2).
      const allocatedUids = new Set<number>();
      let autoUid = 1;
      const allocateUid = (): number => {
        while (allocatedUids.has(autoUid) && autoUid < 65000) {
          autoUid++;
        }
        allocatedUids.add(autoUid);
        return autoUid;
      };

      const sortedStudents = (students || []).slice().sort((a: any, b: any) => {
        const ca = String(a?.created_at || '');
        const cb = String(b?.created_at || '');
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      });

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
        const rawName = st.name_en || st.student_name || 'STUDENT';
        const cleanName = transliterateBnToEn(rawName).substring(0, 23);

        userList.push({
          uid,
          user_id: bioId,
          name: cleanName,
          role: 'student'
        });
      });

      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, teacher_name, mobile, permissions, is_active, created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      const sortedTeachers = (teachers || []).slice().sort((a: any, b: any) => {
        const ca = String(a?.created_at || '');
        const cb = String(b?.created_at || '');
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      });

      sortedTeachers.forEach((t: any) => {
        if (t.is_active === false) return;
        let perms: any = {};
        try {
          perms = (typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions) || {};
        } catch {
          perms = {};
        }
        const cleanBioId =
          normalizeBioId(perms.biometric_id) ||
          normalizeBioId(t.biometric_id) ||
          normalizeBioId(perms.teacher_id_number);
        if (cleanBioId) {
          const uid = allocateUid();
          const cleanName = transliterateBnToEn(t.teacher_name || 'TEACHER').substring(0, 23);
          userList.push({
            uid,
            user_id: cleanBioId,
            name: cleanName,
            role: 'teacher'
          });
        }
      });
    } catch (err: any) {
      console.error('[PC Agent] User fetch error:', err.message);
    }
  }

  // =========================================================================
  // 0a. Dynamic PowerShell Script for Student Uploader
  //     100% Pure 7-bit ASCII Source (All Bengali strings Base64-encoded so
  //     Windows PowerShell 5.1 never hits the 0x93 smart-quote parser bug!)
  // =========================================================================
  if (action === 'get_upload_script') {
    const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
    const instNameB64 = b64(institutionName);
    const embeddedUsersB64 = b64(JSON.stringify(userList));

    // Bengali UI Messages encoded as Base64 for 100% immunity against encoding corruption
    const msgFetchingB64 = b64('[১/৪] সার্ভার থেকে শিক্ষার্থীদের তালিকা লোড করা হচ্ছে...');
    const msgCloudLoadedB64 = b64('  -> ক্লাউড সার্ভার থেকে শিক্ষার্থীদের তালিকা লোড হয়েছে: ');
    const msgOfflineLoadedB64 = b64('  -> প্রি-প্যাকড তালিকা থেকে শিক্ষার্থীদের তথ্য লোড হয়েছে: ');
    const msgNoStudentsB64 = b64('কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি। অনুগ্রহ করে নিশ্চিত করুন প্রতিষ্ঠানে শিক্ষার্থী যুক্ত আছে।');
    const msgScanningB64 = b64('[২/৪] লোকাল নেটওয়ার্কে ZKTeco হাজিরা মেশিন স্ক্যান করা হচ্ছে...');
    const msgTestingIpB64 = b64('  -> আইপি পরীক্ষা করা হচ্ছে: ');
    const msgConnectedB64 = b64('সংযুক্ত! [OK]');
    const msgFailedShortB64 = b64('পাওয়া যায়নি');
    const msgNoMachineErrB64 = b64('হাজিরা মেশিনের সাথে সংযোগ পাওয়া যায়নি! অনুগ্রহ করে নিশ্চিত করুন মেশিনটি চালু আছে এবং রাউটারের সাথে ল্যান (LAN) ক্যাবলে যুক্ত আছে।');
    const msgUploadingStartB64 = b64('[৩/৪] ZKTeco মেশিনে শিক্ষার্থীদের নাম ও রোল আপলোড শুরু হচ্ছে...');
    const msgRefreshingB64 = b64('[৪/৪] মেশিনের ইন্টারনাল মেমোরি রিফ্রেশ ও সেভ করা হচ্ছে...');
    const msgDoneTitleB64 = b64('Deenora ZKTeco Uploader - সফল');
    const msgDonePopupPrefixB64 = b64('সফলভাবে ZKTeco হাজিরা মেশিনে সিঙ্ক সম্পন্ন হয়েছে!\n\n');
    const msgSummaryNewB64 = b64('নতুন আপলোড: ');
    const msgSummaryRewriteB64 = b64(' | আইডি আপডেট (Rewrite): ');
    const msgSummarySkippedB64 = b64(' | আগে থেকেই ছিল (Skipped): ');
    const msgPressEnterB64 = b64('উইন্ডো বন্ধ করতে Enter চাপুন...');

    const safeCacheInstId = institutionId || 'default';

    const ps1UploadScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")

function Decode-B64([string]$b) {
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
}

$instName = Decode-B64 "${instNameB64}"
$embeddedUsersJson = Decode-B64 "${embeddedUsersB64}"
$cacheFilePath = Join-Path $env:USERPROFILE ".deenora_zk_synced_${safeCacheInstId}.json"

$msgFetching = Decode-B64 "${msgFetchingB64}"
$msgCloudLoaded = Decode-B64 "${msgCloudLoadedB64}"
$msgOfflineLoaded = Decode-B64 "${msgOfflineLoadedB64}"
$msgNoStudents = Decode-B64 "${msgNoStudentsB64}"
$msgScanning = Decode-B64 "${msgScanningB64}"
$msgTestingIp = Decode-B64 "${msgTestingIpB64}"
$msgConnected = Decode-B64 "${msgConnectedB64}"
$msgFailedShort = Decode-B64 "${msgFailedShortB64}"
$msgNoMachineErr = Decode-B64 "${msgNoMachineErrB64}"
$msgUploadingStart = Decode-B64 "${msgUploadingStartB64}"
$msgRefreshing = Decode-B64 "${msgRefreshingB64}"
$msgDoneTitle = Decode-B64 "${msgDoneTitleB64}"
$msgDonePopupPrefix = Decode-B64 "${msgDonePopupPrefixB64}"
$msgSummaryNew = Decode-B64 "${msgSummaryNewB64}"
$msgSummaryRewrite = Decode-B64 "${msgSummaryRewriteB64}"
$msgSummarySkipped = Decode-B64 "${msgSummarySkippedB64}"
$msgPressEnter = Decode-B64 "${msgPressEnterB64}"

function Show-MsgBox([string]$msg, [string]$title, [string]$iconType) {
    try {
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($iconType -eq "Error") {
            $icon = [System.Windows.Forms.MessageBoxIcon]::Error
        } elseif ($iconType -eq "Warning") {
            $icon = [System.Windows.Forms.MessageBoxIcon]::Warning
        }
        [void][System.Windows.Forms.MessageBox]::Show($msg, $title, [System.Windows.Forms.MessageBoxButtons]::OK, $icon)
    } catch {
        Write-Host ($title + ": " + $msg)
    }
}

function Calculate-ZKChecksum([byte[]]$buf) {
    [uint32]$chk = 0
    $len = $buf.Length
    $i = 0
    while ($len -gt 1) {
        $word = [uint32]([int]$buf[$i] -bor ([int]$buf[$i+1] -shl 8))
        $chk += $word
        $i += 2
        $len -= 2
    }
    if ($len -eq 1) {
        $chk += [uint32]$buf[$i]
    }
    while (($chk -shr 16) -gt 0) {
        $chk = ($chk -band 0xFFFF) + ($chk -shr 16)
    }
    return [uint16]((-bnot $chk) -band 0xFFFF)
}

function Make-ZKCommKey([uint32]$key, [uint16]$sessionId) {
    [uint32]$k = 0
    for ($i = 0; $i -lt 32; $i++) {
        if (($key -band ([uint32]1 -shl $i)) -ne 0) {
            $k = (($k -shl 1) -bor 1) -band 0xFFFFFFFF
        } else {
            $k = ($k -shl 1) -band 0xFFFFFFFF
        }
    }
    $k = ($k + [uint32]$sessionId) -band 0xFFFFFFFF
    $b = [System.BitConverter]::GetBytes([uint32]$k)
    $b[0] = [byte]($b[0] -bxor 0x5A)
    $b[1] = [byte]($b[1] -bxor 0x4B)
    $b[2] = [byte]($b[2] -bxor 0x53)
    $b[3] = [byte]($b[3] -bxor 0x4F)
    $t0 = $b[0]; $t1 = $b[1]
    $b[0] = $b[2]; $b[1] = $b[3]
    $b[2] = $t0; $b[3] = $t1
    [byte]$ticks = 50
    $b[0] = [byte]($b[0] -bxor $ticks)
    $b[1] = [byte]($b[1] -bxor $ticks)
    $b[2] = $ticks
    $b[3] = [byte]($b[3] -bxor $ticks)
    return $b
}

function Build-ZKPacket([uint16]$cmd, [uint16]$session, [uint16]$reply, [byte[]]$payload) {
    $pLen = if ($payload) { $payload.Length } else { 0 }
    $full = New-Object byte[] (8 + $pLen)
    $cmdB = [System.BitConverter]::GetBytes([uint16]$cmd)
    $sesB = [System.BitConverter]::GetBytes([uint16]$session)
    $repB = [System.BitConverter]::GetBytes([uint16]$reply)
    $full[0] = $cmdB[0]; $full[1] = $cmdB[1]
    $full[2] = 0;        $full[3] = 0
    $full[4] = $sesB[0]; $full[5] = $sesB[1]
    $full[6] = $repB[0]; $full[7] = $repB[1]
    if ($pLen -gt 0) {
        [System.Buffer]::BlockCopy($payload, 0, $full, 8, $pLen)
    }
    $chk = Calculate-ZKChecksum $full
    $chkB = [System.BitConverter]::GetBytes([uint16]$chk)
    $full[2] = $chkB[0]; $full[3] = $chkB[1]
    return $full
}

function Convert-BnDigits([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return "" }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $text.ToCharArray()) {
        $code = [int][char]$ch
        if ($code -ge 0x09E6 -and $code -le 0x09EF) {
            [void]$sb.Append([char](0x0030 + ($code - 0x09E6)))
        } else {
            [void]$sb.Append($ch)
        }
    }
    return $sb.ToString()
}

function Normalize-UserName([string]$name) {
    $norm = Convert-BnDigits $name
    $clean = ($norm -replace '[^A-Za-z0-9\\s._-]', '') -replace '\\s+', ' '
    $clean = $clean.Trim().ToUpper()
    if ([string]::IsNullOrWhiteSpace($clean)) { $clean = "STUDENT" }
    if ($clean.Length -gt 24) { $clean = $clean.Substring(0, 24) }
    return $clean
}

function Normalize-UserBioId([string]$userId) {
    $norm = Convert-BnDigits $userId
    return ($norm -replace '[^A-Za-z0-9._-]', '').Trim()
}

function Build-UserPayload([uint16]$uid, [string]$name, [string]$userId) {
    $bytes = New-Object byte[] 72
    $uidB = [System.BitConverter]::GetBytes([uint16]$uid)
    $bytes[0] = $uidB[0]
    $bytes[1] = $uidB[1]
    $bytes[2] = 0
    $cleanName = Normalize-UserName $name
    $nameBytes = [System.Text.Encoding]::ASCII.GetBytes($cleanName)
    $maxName = [Math]::Min($nameBytes.Length, 24)
    [System.Buffer]::BlockCopy($nameBytes, 0, $bytes, 11, $maxName)
    $bytes[40] = 0x31
    $cleanId = Normalize-UserBioId $userId
    if ([string]::IsNullOrWhiteSpace($cleanId)) { $cleanId = "" + $uid }
    $idBytes = [System.Text.Encoding]::ASCII.GetBytes($cleanId)
    $maxId = [Math]::Min($idBytes.Length, 24)
    [System.Buffer]::BlockCopy($idBytes, 0, $bytes, 48, $maxId)
    return $bytes
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   DEENORA ZKTECO K40/K14 STUDENT UPLOADER (DEPENDENCY-FREE)    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ("Institution : " + $instName) -ForegroundColor Yellow
Write-Host "Server URL  : ${serverUrl}" -ForegroundColor Gray
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

Write-Host $msgFetching -ForegroundColor White
$users = @()
try {
    [System.Net.ServicePointManager]::SecurityProtocol = 3072
    $apiUrl = "${serverUrl}/api/biometric-upload?institution_id=${institutionId}&format=json"
    $wc = New-Object System.Net.WebClient
    $wc.Encoding = [System.Text.Encoding]::UTF8
    $rawJson = $wc.DownloadString($apiUrl)
    $parsed = ConvertFrom-Json $rawJson
    if ($parsed.users -and $parsed.users.Count -gt 0) {
        $users = @($parsed.users)
        Write-Host ($msgCloudLoaded + $users.Count) -ForegroundColor Green
    }
} catch {}

if ($users.Count -eq 0 -and $embeddedUsersJson -and $embeddedUsersJson.Length -gt 2) {
    try {
        $parsedOffline = ConvertFrom-Json $embeddedUsersJson
        if ($parsedOffline) {
            $users = @($parsedOffline)
            Write-Host ($msgOfflineLoaded + $users.Count) -ForegroundColor Green
        }
    } catch {}
}

if ($users.Count -eq 0) {
    Write-Host $msgNoStudents -ForegroundColor Red
    Show-MsgBox $msgNoStudents "Deenora Uploader" "Warning"
    Read-Host $msgPressEnter
    return
}

Write-Host ""
Write-Host $msgScanning -ForegroundColor White

$candidateIps = New-Object System.Collections.Generic.List[string]

# 1. Auto-detect ZKTeco MAC address (00-17-61) from Windows ARP table first!
try {
    $arpLines = arp -a
    foreach ($line in $arpLines) {
        if ($line -match "(\\d+\\.\\d+\\.\\d+\\.\\d+)\\s+([0-9a-fA-F-]{17})") {
            $arpIp = $Matches[1]
            $arpMac = $Matches[2].ToLower()
            if ($arpMac.StartsWith("00-17-61")) {
                if (-not $candidateIps.Contains($arpIp)) {
                    $candidateIps.Add($arpIp)
                }
            }
        }
    }
} catch {}

$defaultIp = "${deviceIp}"
if ($defaultIp -and -not $candidateIps.Contains($defaultIp)) { $candidateIps.Add($defaultIp) }
$presetIps = @("192.168.0.201", "192.168.1.201", "192.168.0.202", "192.168.1.202", "192.168.0.100", "192.168.1.100")
foreach ($tip in $presetIps) {
    if (-not $candidateIps.Contains($tip)) { $candidateIps.Add($tip) }
}

try {
    $nics = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()
    foreach ($nic in $nics) {
        if ($nic.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up) {
            foreach ($ipInfo in $nic.GetIPProperties().UnicastAddresses) {
                if ($ipInfo.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
                    $ipStr = $ipInfo.Address.ToString()
                    if (-not $ipStr.StartsWith("127.") -and -not $ipStr.StartsWith("169.254.")) {
                        $parts = $ipStr.Split('.')
                        if ($parts.Length -eq 4) {
                            $sub = "" + $parts[0] + "." + $parts[1] + "." + $parts[2]
                            foreach ($hostNum in @(201, 202, 100, 200, 101)) {
                                $genIp = "" + $sub + "." + $hostNum
                                if (-not $candidateIps.Contains($genIp)) {
                                    $candidateIps.Add($genIp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
} catch {}

$port = 4370
$activeIp = $null
$activeSession = [uint16]0
$activeReply = [uint16]0
$udpClient = New-Object System.Net.Sockets.UdpClient
$udpClient.Client.ReceiveTimeout = 1500
$udpClient.Client.SendTimeout = 1500

foreach ($tip in $candidateIps) {
    Write-Host ($msgTestingIp + $tip + ":4370 ... ") -NoNewline -ForegroundColor Gray
    try {
        $targetEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($tip), $port)
        # CMD_CONNECT = 1000
        $pkt = Build-ZKPacket 1000 0 0 $null
        $udpClient.Send($pkt, $pkt.Length, $targetEp) | Out-Null
        $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $recv = $udpClient.Receive([ref]$remoteEp)
        if ($recv -and $recv.Length -ge 8) {
            $respCode = [System.BitConverter]::ToUInt16($recv, 0)
            $respSession = [System.BitConverter]::ToUInt16($recv, 4)
            $respReply = [System.BitConverter]::ToUInt16($recv, 6)

            # Handle CMD_ACK_UNAUTH (2005) by sending CMD_AUTH (1102)
            if ($respCode -eq 2005) {
                $authKey = Make-ZKCommKey 0 $respSession
                $nextReply = [uint16](([int]$respReply + 1) -band 0xFFFF)
                $authPkt = Build-ZKPacket 1102 $respSession $nextReply $authKey
                $udpClient.Send($authPkt, $authPkt.Length, $targetEp) | Out-Null
                $recvAuth = $udpClient.Receive([ref]$remoteEp)
                if ($recvAuth -and $recvAuth.Length -ge 8) {
                    $respCode = [System.BitConverter]::ToUInt16($recvAuth, 0)
                    $respReply = [System.BitConverter]::ToUInt16($recvAuth, 6)
                }
            }

            if ($respCode -eq 2000 -or $respCode -eq 1000) {
                Write-Host $msgConnected -ForegroundColor Green
                $activeIp = $tip
                $activeSession = $respSession
                $activeReply = [uint16](([int]$respReply + 1) -band 0xFFFF)
                break
            }
        }
        Write-Host $msgFailedShort -ForegroundColor DarkGray
    } catch {
        Write-Host $msgFailedShort -ForegroundColor DarkGray
    }
}

if (-not $activeIp) {
    Write-Host ""
    Write-Host $msgNoMachineErr -ForegroundColor Red
    Show-MsgBox $msgNoMachineErr "Deenora ZKTeco Uploader" "Error"
    Read-Host $msgPressEnter
    return
}

Write-Host ""
Write-Host ($msgUploadingStart + " (" + $activeIp + ")") -ForegroundColor White
$machineEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($activeIp), $port)
$udpClient.Client.ReceiveTimeout = 2500

# Load local incremental sync cache per machine IP
$allMachinesCache = @{}
if (Test-Path $cacheFilePath) {
    try {
        $rawCache = [System.IO.File]::ReadAllText($cacheFilePath, [System.Text.Encoding]::UTF8)
        if (-not [string]::IsNullOrWhiteSpace($rawCache)) {
            $parsedCache = ConvertFrom-Json $rawCache
            if ($parsedCache) {
                foreach ($ipProp in $parsedCache.PSObject.Properties) {
                    $ipMap = @{}
                    if ($ipProp.Value) {
                        foreach ($uProp in $ipProp.Value.PSObject.Properties) {
                            $ipMap[[string]$uProp.Name] = @{
                                uid  = [int]($uProp.Value.uid)
                                name = [string]($uProp.Value.name)
                            }
                        }
                    }
                    $allMachinesCache[[string]$ipProp.Name] = $ipMap
                }
            }
        }
    } catch {
        $allMachinesCache = @{}
    }
}

$machineCache = @{}
if ($allMachinesCache.ContainsKey($activeIp)) {
    $machineCache = $allMachinesCache[$activeIp]
} else {
    $allMachinesCache[$activeIp] = $machineCache
}

$usedUids = New-Object System.Collections.Generic.HashSet[int]
$claimedUids = New-Object System.Collections.Generic.HashSet[int]
$cacheByName = @{}
$cacheByUid = @{}
$maxCachedUid = 0

foreach ($k in @($machineCache.Keys)) {
    $entry = $machineCache[$k]
    $cUid = [int]$entry.uid
    $cName = Normalize-UserName ([string]$entry.name)
    if ($cUid -gt 0) {
        [void]$usedUids.Add($cUid)
        $cacheByUid[$cUid] = [string]$k
        if ($cUid -gt $maxCachedUid) { $maxCachedUid = $cUid }
    }
    if (-not $cacheByName.ContainsKey($cName)) {
        $cacheByName[$cName] = New-Object System.Collections.Generic.List[string]
    }
    $cacheByName[$cName].Add([string]$k)
}

foreach ($u in $users) {
    $tId = Normalize-UserBioId ([string]$u.user_id)
    if ($tId -and $machineCache.ContainsKey($tId)) {
        [void]$claimedUids.Add([int]$machineCache[$tId].uid)
    }
}

$newCount = 0
$rewrittenCount = 0
$skippedCount = 0
$failedCount = 0
$cacheDirty = $false

for ($i = 0; $i -lt $users.Count; $i++) {
    $u = $users[$i]
    $expectedSlot = [int]($i + 1)
    $cleanName = Normalize-UserName ([string]$u.name)
    $userBioId = Normalize-UserBioId ([string]$u.user_id)
    if ([string]::IsNullOrWhiteSpace($userBioId)) { $userBioId = "" + $expectedSlot }

    $opType = "NEW"
    $targetUidInt = 0
    $oldCacheKeyToRemove = $null

    # Case A: Already synced with matching user_id
    if ($machineCache.ContainsKey($userBioId)) {
        $cached = $machineCache[$userBioId]
        $cachedName = Normalize-UserName ([string]$cached.name)
        $cachedUid = [int]$cached.uid
        if ($cachedName -eq $cleanName -and $cachedUid -gt 0) {
            $skippedCount++
            Write-Host ("  [" + ($i+1) + "/" + $users.Count + "] [SKIP] Slot: " + $cachedUid + " | ID: " + $userBioId.PadRight(8) + " | Name: " + $cleanName) -ForegroundColor DarkGray
            continue
        }
        $opType = "REWRITE"
        $targetUidInt = if ($cachedUid -gt 0) { $cachedUid } else { $expectedSlot }
    } else {
        # Case B: Detect old serial ID (e.g. 1, 2, 3) rewrite by normalized name or unclaimed slot uid
        $foundOldKey = $null
        if ($cacheByName.ContainsKey($cleanName)) {
            foreach ($candKey in $cacheByName[$cleanName]) {
                if ($machineCache.ContainsKey($candKey)) {
                    $candUid = [int]$machineCache[$candKey].uid
                    if (-not $claimedUids.Contains($candUid) -and $candKey -ne $userBioId) {
                        $foundOldKey = $candKey
                        break
                    }
                }
            }
        }
        if (-not $foundOldKey -and $cacheByUid.ContainsKey($expectedSlot)) {
            $slotKey = $cacheByUid[$expectedSlot]
            if ($machineCache.ContainsKey($slotKey)) {
                $slotUid = [int]$machineCache[$slotKey].uid
                $slotName = Normalize-UserName ([string]$machineCache[$slotKey].name)
                if (-not $claimedUids.Contains($slotUid) -and $slotKey -ne $userBioId -and ($slotKey -eq ("" + $slotUid) -or $slotName -eq $cleanName)) {
                    $foundOldKey = $slotKey
                }
            }
        }

        if ($foundOldKey) {
            $opType = "REWRITE"
            $targetUidInt = [int]$machineCache[$foundOldKey].uid
            $oldCacheKeyToRemove = $foundOldKey
            [void]$claimedUids.Add($targetUidInt)
        } else {
            # Case C: Newly added student/teacher -> next unused sequential uid slot
            $opType = "NEW"
            $maxCachedUid++
            while ($usedUids.Contains($maxCachedUid)) {
                $maxCachedUid++
            }
            $targetUidInt = $maxCachedUid
            [void]$usedUids.Add($targetUidInt)
            [void]$claimedUids.Add($targetUidInt)
        }
    }

    $uidVal = [uint16]$targetUidInt
    $payload = Build-UserPayload $uidVal $cleanName $userBioId
    # CMD_USER_WRQ = 8
    $pkt = Build-ZKPacket 8 $activeSession $activeReply $payload
    $activeReply = [uint16](([int]$activeReply + 1) -band 0xFFFF)

    $ackOk = $false
    for ($retry = 0; $retry -lt 3; $retry++) {
        try {
            $udpClient.Send($pkt, $pkt.Length, $machineEp) | Out-Null
            $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
            $recv = $udpClient.Receive([ref]$remoteEp)
            if ($recv -and $recv.Length -ge 8) {
                $code = [System.BitConverter]::ToUInt16($recv, 0)
                if ($code -eq 2000 -or $code -eq 8) {
                    $ackOk = $true
                    break
                }
            }
        } catch {
            Start-Sleep -Milliseconds 50
        }
    }

    if ($ackOk) {
        if ($oldCacheKeyToRemove -and $machineCache.ContainsKey($oldCacheKeyToRemove)) {
            $machineCache.Remove($oldCacheKeyToRemove)
        }
        $machineCache[$userBioId] = @{ uid = $targetUidInt; name = $cleanName }
        $cacheDirty = $true
        if ($opType -eq "REWRITE") {
            $rewrittenCount++
            $tagInfo = if ($oldCacheKeyToRemove) { $oldCacheKeyToRemove + " -> " + $userBioId } else { $userBioId }
            Write-Host ("  [" + ($i+1) + "/" + $users.Count + "] [REWRITE] Slot: " + $uidVal + " | ID: " + $tagInfo + " | Name: " + $cleanName) -ForegroundColor Cyan
        } else {
            $newCount++
            Write-Host ("  [" + ($i+1) + "/" + $users.Count + "] [NEW] Slot: " + $uidVal + " | ID: " + $userBioId.PadRight(8) + " | Name: " + $cleanName) -ForegroundColor Green
        }
    } else {
        $failedCount++
        Write-Host ("  [" + ($i+1) + "/" + $users.Count + "] [FAIL] Slot: " + $uidVal + " | ID: " + $userBioId.PadRight(8) + " | Name: " + $cleanName) -ForegroundColor Yellow
    }
    Start-Sleep -Milliseconds 20
}

if ($cacheDirty -or (-not (Test-Path $cacheFilePath))) {
    try {
        $allMachinesCache[$activeIp] = $machineCache
        $jsonOut = $allMachinesCache | ConvertTo-Json -Depth 6
        [System.IO.File]::WriteAllText($cacheFilePath, $jsonOut, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

if (($newCount + $rewrittenCount) -gt 0) {
    Write-Host ""
    Write-Host $msgRefreshing -ForegroundColor White
    try {
        $refreshPkt = Build-ZKPacket 1013 $activeSession $activeReply $null
        $activeReply = [uint16](([int]$activeReply + 1) -band 0xFFFF)
        $udpClient.Send($refreshPkt, $refreshPkt.Length, $machineEp) | Out-Null
        $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $udpClient.Receive([ref]$remoteEp) | Out-Null
    } catch {}
}

try {
    $exitPkt = Build-ZKPacket 1001 $activeSession $activeReply $null
    $udpClient.Send($exitPkt, $exitPkt.Length, $machineEp) | Out-Null
} catch {}
$udpClient.Close()

$summaryLine = $msgSummaryNew + $newCount + $msgSummaryRewrite + $rewrittenCount + $msgSummarySkipped + $skippedCount

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host ("   " + $summaryLine) -ForegroundColor Green
Write-Host ("   Machine: " + $activeIp + " | Total Users: " + $users.Count) -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

Show-MsgBox ($msgDonePopupPrefix + $summaryLine) $msgDoneTitle "Info"
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    return res.status(200).send(ps1UploadScript);
  }

  // =========================================================================
  // 0b. Pure 7-Bit ASCII Windows Batch Runner (.bat) with CRLF (\r\n)
  //     Zero UTF-8 CMD parser bugs, zero 1-second crashes!
  // =========================================================================
  if (action === 'upload_students' || format === 'upload' || format === 'upload_students') {
    const scriptUrl = `${serverUrl}/api/pc-agent?institution_id=${institutionId}&device_ip=${encodeURIComponent(deviceIp)}&action=get_upload_script`;
    const uploadBatLines = [
      '@echo off',
      'title Deenora ZKTeco K40 Student Uploader',
      'cls',
      'echo ================================================================',
      'echo       DEENORA - ZKTECO K40/K14 STUDENT UPLOAD ENGINE',
      'echo ================================================================',
      'echo [*] Connecting to Deenora Cloud Server...',
      'set "PS_FILE=%TEMP%\\deenora_upload_students.ps1"',
      'del /f /q "%PS_FILE%" >nul 2>&1',
      `curl.exe -sSL "${scriptUrl}" -o "%PS_FILE%"`,
      'if not exist "%PS_FILE%" (',
      `  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object System.Net.WebClient).DownloadFile('${scriptUrl}', '%PS_FILE%')"`,
      ')',
      'if exist "%PS_FILE%" (',
      '  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"',
      ') else (',
      '  echo [!] Failed to download uploader script from server. Check internet connection.',
      ')',
      'echo.',
      'pause'
    ];
    const uploadBat = uploadBatLines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Deenora_Upload_Students.bat"');
    return res.status(200).send(uploadBat);
  }

  // =========================================================================
  // 0c. Dynamic Pure PowerShell Script for Live Attendance Sync
  //     100% Pure 7-bit ASCII Source - Zero Python, Zero 3rd-Party Libraries!
  // =========================================================================
  if (action === 'get_sync_script') {
    const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
    const instNameB64 = b64(institutionName);
    const syncSelfUrl = `${serverUrl}/api/pc-agent?institution_id=${institutionId}&device_ip=${encodeURIComponent(deviceIp)}&action=get_sync_script`;

    const ps1SyncScript = `param([switch]$BackgroundMode)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Net.ServicePointManager]::SecurityProtocol = 3072

function Decode-B64([string]$b) {
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
}

$institutionId = "${institutionId}"
$instName = Decode-B64 "${instNameB64}"
$deviceIp = "${deviceIp}"
$serverUrl = "${serverUrl}"
$syncScriptUrl = "${syncSelfUrl}"

function Calculate-ZKChecksum([byte[]]$buf) {
    [uint32]$chk = 0
    $len = $buf.Length
    $i = 0
    while ($len -gt 1) {
        $word = [uint32]([int]$buf[$i] -bor ([int]$buf[$i+1] -shl 8))
        $chk += $word
        $i += 2
        $len -= 2
    }
    if ($len -eq 1) {
        $chk += [uint32]$buf[$i]
    }
    while (($chk -shr 16) -gt 0) {
        $chk = ($chk -band 0xFFFF) + ($chk -shr 16)
    }
    return [uint16]((-bnot $chk) -band 0xFFFF)
}

function Make-ZKCommKey([uint32]$key, [uint16]$sessionId) {
    [uint32]$k = 0
    for ($i = 0; $i -lt 32; $i++) {
        if (($key -band ([uint32]1 -shl $i)) -ne 0) {
            $k = (($k -shl 1) -bor 1) -band 0xFFFFFFFF
        } else {
            $k = ($k -shl 1) -band 0xFFFFFFFF
        }
    }
    $k = ($k + [uint32]$sessionId) -band 0xFFFFFFFF
    $b = [System.BitConverter]::GetBytes([uint32]$k)
    $b[0] = [byte]($b[0] -bxor 0x5A)
    $b[1] = [byte]($b[1] -bxor 0x4B)
    $b[2] = [byte]($b[2] -bxor 0x53)
    $b[3] = [byte]($b[3] -bxor 0x4F)
    $t0 = $b[0]; $t1 = $b[1]
    $b[0] = $b[2]; $b[1] = $b[3]
    $b[2] = $t0; $b[3] = $t1
    [byte]$ticks = 50
    $b[0] = [byte]($b[0] -bxor $ticks)
    $b[1] = [byte]($b[1] -bxor $ticks)
    $b[2] = $ticks
    $b[3] = [byte]($b[3] -bxor $ticks)
    return $b
}

function Build-ZKPacket([uint16]$cmd, [uint16]$session, [uint16]$reply, [byte[]]$payload) {
    $pLen = if ($payload) { $payload.Length } else { 0 }
    $full = New-Object byte[] (8 + $pLen)
    $cmdB = [System.BitConverter]::GetBytes([uint16]$cmd)
    $sesB = [System.BitConverter]::GetBytes([uint16]$session)
    $repB = [System.BitConverter]::GetBytes([uint16]$reply)
    $full[0] = $cmdB[0]; $full[1] = $cmdB[1]
    $full[2] = 0;        $full[3] = 0
    $full[4] = $sesB[0]; $full[5] = $sesB[1]
    $full[6] = $repB[0]; $full[7] = $repB[1]
    if ($pLen -gt 0) {
        [System.Buffer]::BlockCopy($payload, 0, $full, 8, $pLen)
    }
    $chk = Calculate-ZKChecksum $full
    $chkB = [System.BitConverter]::GetBytes([uint16]$chk)
    $full[2] = $chkB[0]; $full[3] = $chkB[1]
    return $full
}

function Send-ZKTcpPacket($stream, [byte[]]$zkPkt) {
    $frame = New-Object byte[] (8 + $zkPkt.Length)
    $frame[0] = 0x50; $frame[1] = 0x50; $frame[2] = 0x82; $frame[3] = 0x7D
    $lenB = [System.BitConverter]::GetBytes([uint32]$zkPkt.Length)
    $frame[4] = $lenB[0]; $frame[5] = $lenB[1]; $frame[6] = $lenB[2]; $frame[7] = $lenB[3]
    [System.Buffer]::BlockCopy($zkPkt, 0, $frame, 8, $zkPkt.Length)
    $stream.Write($frame, 0, $frame.Length)
    $stream.Flush()
}

function Read-ZKTcpExact($stream, [int]$count) {
    $buf = New-Object byte[] $count
    $read = 0
    while ($read -lt $count) {
        $n = $stream.Read($buf, $read, $count - $read)
        if ($n -le 0) { return $null }
        $read += $n
    }
    return $buf
}

function Recv-ZKTcpPacket($stream) {
    $hdr = Read-ZKTcpExact $stream 8
    if (-not $hdr -or $hdr.Length -lt 8) { return $null }
    if ($hdr[0] -ne 0x50 -or $hdr[1] -ne 0x50 -or $hdr[2] -ne 0x82 -or $hdr[3] -ne 0x7D) {
        return $null
    }
    $pktLen = [System.BitConverter]::ToInt32($hdr, 4)
    if ($pktLen -lt 8 -or $pktLen -gt 10485760) { return $null }
    return Read-ZKTcpExact $stream $pktLen
}

function Read-ZKTcpAttendance([string]$ip, [int]$port) {
    $res = @{ Success = $false; Data = $null }
    $tcp = $null
    $stream = $null
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($ip, $port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(1500, $false)) {
            try { $tcp.Close() } catch {}
            return $res
        }
        $tcp.EndConnect($iar)
        $tcp.ReceiveTimeout = 3000
        $tcp.SendTimeout = 2000
        $tcp.ReceiveBufferSize = 262144
        $stream = $tcp.GetStream()

        # CMD_CONNECT = 1000
        Send-ZKTcpPacket $stream (Build-ZKPacket 1000 0 0 $null)
        $recv = Recv-ZKTcpPacket $stream
        if (-not $recv -or $recv.Length -lt 8) { return $res }

        $code = [System.BitConverter]::ToUInt16($recv, 0)
        $ses  = [System.BitConverter]::ToUInt16($recv, 4)
        $rep  = [System.BitConverter]::ToUInt16($recv, 6)

        if ($code -eq 2005) {
            $authKey = Make-ZKCommKey 0 $ses
            $nextRep = [uint16](([int]$rep + 1) -band 0xFFFF)
            Send-ZKTcpPacket $stream (Build-ZKPacket 1102 $ses $nextRep $authKey)
            $recvAuth = Recv-ZKTcpPacket $stream
            if (-not $recvAuth -or $recvAuth.Length -lt 8) { return $res }
            $code = [System.BitConverter]::ToUInt16($recvAuth, 0)
            $rep  = [System.BitConverter]::ToUInt16($recvAuth, 6)
        }

        if ($code -ne 2000 -and $code -ne 1000) { return $res }
        $rep = [uint16](([int]$rep + 1) -band 0xFFFF)

        # ZK6 Buffered Read: CMD_DATA_WRRQ (1503) for ATTLOG (13)
        [byte[]]$wrrqPayload = @(1, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        Send-ZKTcpPacket $stream (Build-ZKPacket 1503 $ses $rep $wrrqPayload)
        $rep = [uint16](([int]$rep + 1) -band 0xFFFF)

        $first = Recv-ZKTcpPacket $stream
        if (-not $first -or $first.Length -lt 8) {
            try { Send-ZKTcpPacket $stream (Build-ZKPacket 1001 $ses $rep $null) } catch {}
            return $res
        }

        $fCode = [System.BitConverter]::ToUInt16($first, 0)
        $rawStream = New-Object System.IO.MemoryStream

        if ($fCode -eq 1501) {
            if ($first.Length -gt 8) {
                $rawStream.Write($first, 8, $first.Length - 8)
            }
            $res.Success = $true
        } elseif ($fCode -eq 2000 -or $fCode -eq 1500) {
            [uint32]$totalSize = 0
            if ($fCode -eq 2000) {
                if ($first.Length -ge 13) {
                    $totalSize = [System.BitConverter]::ToUInt32($first, 9)
                }
                if ($totalSize -eq 0 -and $first.Length -ge 12) {
                    $totalSize = [System.BitConverter]::ToUInt32($first, 8)
                }
            } else {
                if ($first.Length -ge 13 -and $first[8] -eq 1) {
                    $s9 = [System.BitConverter]::ToUInt32($first, 9)
                    if (($s9 -ge 40 -and (($s9 - 4) % 40 -eq 0 -or ($s9 % 40 -eq 0)))) {
                        $totalSize = $s9
                    }
                }
                if ($totalSize -eq 0 -and $first.Length -ge 12) {
                    $totalSize = [System.BitConverter]::ToUInt32($first, 8)
                }
                if ($totalSize -eq 0 -and $first.Length -ge 13) {
                    $totalSize = [System.BitConverter]::ToUInt32($first, 9)
                }
            }

            if ($totalSize -gt 0 -and $totalSize -lt 52428800) {
                [uint32]$offsetPos = 0
                [uint32]$maxChunk = 65472
                while ($offsetPos -lt $totalSize) {
                    [uint32]$remSize = $totalSize - $offsetPos
                    [uint32]$chunkReq = if ($remSize -gt $maxChunk) { $maxChunk } else { $remSize }
                    $rdyPayload = New-Object byte[] 8
                    $offB = [System.BitConverter]::GetBytes($offsetPos)
                    $lenB = [System.BitConverter]::GetBytes($chunkReq)
                    [System.Buffer]::BlockCopy($offB, 0, $rdyPayload, 0, 4)
                    [System.Buffer]::BlockCopy($lenB, 0, $rdyPayload, 4, 4)

                    Send-ZKTcpPacket $stream (Build-ZKPacket 1504 $ses $rep $rdyPayload)
                    $rep = [uint16](([int]$rep + 1) -band 0xFFFF)

                    $cPkt = Recv-ZKTcpPacket $stream
                    if (-not $cPkt -or $cPkt.Length -lt 8) { break }
                    $cCode = [System.BitConverter]::ToUInt16($cPkt, 0)

                    if ($cCode -eq 1501) {
                        if ($cPkt.Length -le 8) { break }
                        $rawStream.Write($cPkt, 8, $cPkt.Length - 8)
                        $offsetPos += [uint32]($cPkt.Length - 8)
                    } elseif ($cCode -eq 1500) {
                        while ($true) {
                            $dPkt = Recv-ZKTcpPacket $stream
                            if (-not $dPkt -or $dPkt.Length -lt 8) { break }
                            $dCode = [System.BitConverter]::ToUInt16($dPkt, 0)
                            if ($dCode -eq 1501) {
                                if ($dPkt.Length -gt 8) {
                                    $rawStream.Write($dPkt, 8, $dPkt.Length - 8)
                                    $offsetPos += [uint32]($dPkt.Length - 8)
                                }
                            } elseif ($dCode -eq 2000) {
                                break
                            } else {
                                break
                            }
                        }
                    } elseif ($cCode -eq 2000) {
                        break
                    } else {
                        break
                    }
                }
                # CMD_FREE_DATA = 1502
                try {
                    Send-ZKTcpPacket $stream (Build-ZKPacket 1502 $ses $rep $null)
                    $rep = [uint16](([int]$rep + 1) -band 0xFFFF)
                    [void](Recv-ZKTcpPacket $stream)
                } catch {}
            }
            $res.Success = $true
        }

        # CMD_EXIT = 1001
        try {
            Send-ZKTcpPacket $stream (Build-ZKPacket 1001 $ses $rep $null)
        } catch {}

        $res.Data = $rawStream.ToArray()
        $rawStream.Dispose()
    } catch {
        # Fallback to UDP in caller
    } finally {
        try { if ($stream) { $stream.Close() } } catch {}
        try { if ($tcp) { $tcp.Close() } } catch {}
    }
    return $res
}

function Decode-ZKTime([uint32]$t) {
    $second = $t % 60; $t = [Math]::Floor($t / 60)
    $minute = $t % 60; $t = [Math]::Floor($t / 60)
    $hour   = $t % 24; $t = [Math]::Floor($t / 24)
    $day    = ($t % 31) + 1; $t = [Math]::Floor($t / 31)
    $month  = ($t % 12) + 1; $t = [Math]::Floor($t / 12)
    $year   = $t + 2000
    return ("{0:D4}-{1:D2}-{2:D2} {3:D2}:{4:D2}:{5:D2}" -f [int]$year, [int]$month, [int]$day, [int]$hour, [int]$minute, [int]$second)
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   DEENORA ZKTECO LIVE ATTENDANCE SYNC ENGINE (PYTHON-FREE)     " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ("Institution : " + $instName) -ForegroundColor Yellow
Write-Host ("Server URL  : " + $serverUrl) -ForegroundColor Gray

# Bulletproof 1-time setup: space-free permanent dir + self-updating runner + 3-layer Windows boot registration
try {
    $appDir = $null
    if ($env:PUBLIC -and (Test-Path $env:PUBLIC)) {
        try {
            $tryDir = Join-Path $env:PUBLIC "DeenoraBiometric"
            if (-not (Test-Path $tryDir)) {
                New-Item -ItemType Directory -Path $tryDir -Force -ErrorAction Stop | Out-Null
            }
            $probeFile = Join-Path $tryDir ".write_test"
            [System.IO.File]::WriteAllText($probeFile, "ok")
            Remove-Item $probeFile -Force -ErrorAction SilentlyContinue
            $appDir = $tryDir
        } catch {
            $appDir = $null
        }
    }
    if (-not $appDir) {
        $appDir = Join-Path $env:LOCALAPPDATA "DeenoraBiometric"
        if (-not (Test-Path $appDir)) {
            New-Item -ItemType Directory -Path $appDir -Force | Out-Null
        }
    }

    $savedPs1 = Join-Path $appDir "deenora_sync_attendance.ps1"
    if ($MyInvocation.MyCommand.Path -and (Test-Path $MyInvocation.MyCommand.Path) -and ($MyInvocation.MyCommand.Path -ne $savedPs1)) {
        Copy-Item -Path $MyInvocation.MyCommand.Path -Destination $savedPs1 -Force -ErrorAction SilentlyContinue
    }

    $runCmd = Join-Path $appDir "run_deenora_sync.cmd"
    $cmdUrlSafe = $syncScriptUrl -replace '%', '%%'
    $cmdLines = @(
        '@echo off',
        ('set "PS_FILE=' + $savedPs1 + '"'),
        ('set "TMP_FILE=' + $savedPs1 + '.tmp"'),
        ('set "SYNC_URL=' + $cmdUrlSafe + '"'),
        'del /f /q "%TMP_FILE%" >nul 2>&1',
        'curl.exe -fsSL --connect-timeout 8 --max-time 20 "%SYNC_URL%" -o "%TMP_FILE%" >nul 2>&1',
        'if not exist "%TMP_FILE%" (',
        '  powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { [System.Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object System.Net.WebClient).DownloadFile($env:SYNC_URL, $env:TMP_FILE) } catch {}" >nul 2>&1',
        ')',
        'if exist "%TMP_FILE%" (',
        '  for %%A in ("%TMP_FILE%") do if %%~zA GTR 1000 (',
        '    move /y "%TMP_FILE%" "%PS_FILE%" >nul 2>&1',
        '  )',
        ')',
        'del /f /q "%TMP_FILE%" >nul 2>&1',
        'if exist "%PS_FILE%" (',
        '  powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PS_FILE%" -BackgroundMode',
        ')'
    )
    [System.IO.File]::WriteAllLines($runCmd, $cmdLines, [System.Text.Encoding]::ASCII)

    # Layer 1: Windows Startup folder .vbs (fixed VBScript quoting)
    $startupVbs = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\Startup\\DeenoraAutoSync.vbs"
    $vbsLines = @(
        'Set WshShell = CreateObject("WScript.Shell")',
        ('WshShell.Run """' + $runCmd + '""", 0, False')
    )
    [System.IO.File]::WriteAllLines($startupVbs, $vbsLines, [System.Text.Encoding]::ASCII)

    # Layer 2: Windows Registry HKCU Run
    try {
        $regPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
        }
        $regCmd = 'wscript.exe //B //Nologo "' + $startupVbs + '"'
        Set-ItemProperty -Path $regPath -Name "DeenoraBiometricAutoSync" -Value $regCmd -Force
    } catch {}

    # Layer 3: Windows Task Scheduler ONLOGON
    try {
        $trEsc = 'wscript.exe //B //Nologo \\"' + $startupVbs + '\\"'
        $schArgs = '/Create /TN "DeenoraBiometricAutoSync" /TR "' + $trEsc + '" /SC ONLOGON /RL LIMITED /F'
        Start-Process -FilePath "schtasks.exe" -ArgumentList $schArgs -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
    } catch {}

    if (-not $BackgroundMode) {
        try {
            Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like "*deenora_sync_attendance.ps1*" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        } catch {}

        try {
            Start-Process "wscript.exe" -ArgumentList ('"' + $startupVbs + '"') -WindowStyle Hidden -ErrorAction SilentlyContinue
        } catch {}

        Write-Host ("[OK] Background Auto-Sync installed permanently in: " + $appDir) -ForegroundColor Green
        Write-Host "[OK] 3-Layer Boot Auto-Start registered (Startup + Registry + Task Scheduler). Sync will run 24/7 even after closing this window or restarting PC." -ForegroundColor Green
    }
} catch {}

Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
Write-Host "[*] Live punch monitoring active (checks every 4 seconds)..." -ForegroundColor White
Write-Host ""

$syncedKeys = New-Object System.Collections.Generic.HashSet[string]
$port = 4370
$lastConnectedIp = $null
$scanCycle = 0

while ($true) {
    $scanCycle++
    $candidateIps = New-Object System.Collections.Generic.List[string]
    $activeSubnets = New-Object System.Collections.Generic.List[string]

    if ($lastConnectedIp) { $candidateIps.Add($lastConnectedIp) }
    if ($deviceIp -and -not $candidateIps.Contains($deviceIp)) { $candidateIps.Add($deviceIp) }

    # Check Windows ARP table for ZKTeco MAC prefix (00-17-61)
    try {
        $arpLines = arp -a
        foreach ($line in $arpLines) {
            if ($line -match "(\\d+\\.\\d+\\.\\d+\\.\\d+)\\s+([0-9a-fA-F-]{17})") {
                $arpIp = $Matches[1]
                $arpMac = $Matches[2].ToLower()
                if ($arpMac.StartsWith("00-17-61") -and -not $candidateIps.Contains($arpIp)) {
                    $candidateIps.Add($arpIp)
                }
            }
        }
    } catch {}

    # Inspect all active IPv4 NICs for /24 subnets and add standard ZKTeco host IPs
    try {
        $nics = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()
        foreach ($nic in $nics) {
            if ($nic.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up) {
                foreach ($ipInfo in $nic.GetIPProperties().UnicastAddresses) {
                    if ($ipInfo.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
                        $ipStr = $ipInfo.Address.ToString()
                        if (-not $ipStr.StartsWith("127.") -and -not $ipStr.StartsWith("169.254.")) {
                            $parts = $ipStr.Split('.')
                            if ($parts.Length -eq 4) {
                                $sub = "" + $parts[0] + "." + $parts[1] + "." + $parts[2]
                                if (-not $activeSubnets.Contains($sub)) {
                                    $activeSubnets.Add($sub)
                                }
                                foreach ($hostNum in @(201, 202, 100, 200, 101)) {
                                    $genIp = "" + $sub + "." + $hostNum
                                    if (-not $candidateIps.Contains($genIp)) {
                                        $candidateIps.Add($genIp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch {}

    foreach ($tip in @("192.168.0.201", "192.168.1.201", "192.168.0.202", "192.168.1.202")) {
        if (-not $candidateIps.Contains($tip)) { $candidateIps.Add($tip) }
    }

    $activeIp = $null
    $raw = $null

    foreach ($tip in $candidateIps) {
        # 1. Try TCP Buffered Reader first (supports unlimited >25 punches)
        $tcpRes = Read-ZKTcpAttendance $tip $port
        if ($tcpRes.Success) {
            $activeIp = $tip
            $raw = $tcpRes.Data
            if ($lastConnectedIp -ne $activeIp) {
                Write-Host ("[OK] Connected to ZKTeco " + $activeIp + " (TCP Buffered)") -ForegroundColor Green
                $lastConnectedIp = $activeIp
            }
            break
        }

        # 2. Fallback to UDP Reader on Port 4370
        $udp = $null
        try {
            $udp = New-Object System.Net.Sockets.UdpClient
            $udp.Client.ReceiveTimeout = 1800
            $udp.Client.SendTimeout = 1800
            $udp.Client.ReceiveBufferSize = 262144

            $ep = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($tip), $port)
            $pkt = Build-ZKPacket 1000 0 0 $null
            [void]$udp.Send($pkt, $pkt.Length, $ep)
            $rem = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
            $recv = $udp.Receive([ref]$rem)
            if ($recv -and $recv.Length -ge 8) {
                $code = [System.BitConverter]::ToUInt16($recv, 0)
                $ses  = [System.BitConverter]::ToUInt16($recv, 4)
                $rep  = [System.BitConverter]::ToUInt16($recv, 6)

                if ($code -eq 2005) {
                    $authKey = Make-ZKCommKey 0 $ses
                    $nextRep = [uint16](([int]$rep + 1) -band 0xFFFF)
                    $authPkt = Build-ZKPacket 1102 $ses $nextRep $authKey
                    [void]$udp.Send($authPkt, $authPkt.Length, $ep)
                    $recvAuth = $udp.Receive([ref]$rem)
                    if ($recvAuth -and $recvAuth.Length -ge 8) {
                        $code = [System.BitConverter]::ToUInt16($recvAuth, 0)
                        $rep  = [System.BitConverter]::ToUInt16($recvAuth, 6)
                    }
                }

                if ($code -eq 2000 -or $code -eq 1000) {
                    $activeIp = $tip
                    $activeSession = $ses
                    $activeReply = [uint16](([int]$rep + 1) -band 0xFFFF)
                    if ($lastConnectedIp -ne $activeIp) {
                        Write-Host ("[OK] Connected to ZKTeco " + $activeIp + " (UDP)") -ForegroundColor Green
                        $lastConnectedIp = $activeIp
                    }

                    $udp.Client.ReceiveTimeout = 2500
                    $rrqPkt = Build-ZKPacket 13 $activeSession $activeReply $null
                    $activeReply = [uint16](([int]$activeReply + 1) -band 0xFFFF)
                    [void]$udp.Send($rrqPkt, $rrqPkt.Length, $ep)

                    $first = $udp.Receive([ref]$rem)
                    $rawStream = New-Object System.IO.MemoryStream
                    if ($first -and $first.Length -ge 8) {
                        $fCode = [System.BitConverter]::ToUInt16($first, 0)
                        if (($fCode -eq 2000 -or $fCode -eq 1501 -or $fCode -eq 2002) -and $first.Length -gt 8) {
                            $rawStream.Write($first, 8, $first.Length - 8)
                        } elseif ($fCode -eq 1500) {
                            while ($true) {
                                try {
                                    $chunk = $udp.Receive([ref]$rem)
                                    if (-not $chunk -or $chunk.Length -lt 8) { break }
                                    $cCode = [System.BitConverter]::ToUInt16($chunk, 0)
                                    if (($cCode -eq 1501 -or $cCode -eq 2002) -and $chunk.Length -gt 8) {
                                        $rawStream.Write($chunk, 8, $chunk.Length - 8)
                                    } elseif ($cCode -eq 2000) {
                                        break
                                    }
                                } catch {
                                    break
                                }
                            }
                        }
                    }

                    try {
                        $exitPkt = Build-ZKPacket 1001 $activeSession $activeReply $null
                        [void]$udp.Send($exitPkt, $exitPkt.Length, $ep)
                    } catch {}

                    $raw = $rawStream.ToArray()
                    $rawStream.Dispose()
                    $udp.Close()
                    break
                }
            }
            $udp.Close()
        } catch {
            try { if ($udp) { $udp.Close() } } catch {}
        }
    }

    if ($activeIp) {
        if ($raw -and $raw.Length -ge 40) {
            $declaredSize = [System.BitConverter]::ToUInt32($raw, 0)
            $offset = if ((($raw.Length - 4) % 40 -eq 0) -or ($declaredSize -ge 40 -and $declaredSize -le ($raw.Length + 40) -and ($declaredSize % 40 -eq 0))) { 4 } else { 0 }
            $cutoffDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
            $newLogs = New-Object System.Collections.ArrayList

            for ($pos = $offset; ($pos + 40) -le $raw.Length; $pos += 40) {
                $idEnd = $pos + 2
                while ($idEnd -lt ($pos + 26) -and $raw[$idEnd] -ne 0) {
                    $idEnd++
                }
                $userIdStr = ""
                if ($idEnd -gt ($pos + 2)) {
                    $userIdStr = [System.Text.Encoding]::ASCII.GetString($raw, $pos + 2, $idEnd - ($pos + 2)).Trim()
                }
                if ([string]::IsNullOrWhiteSpace($userIdStr)) {
                    $uidFallback = [System.BitConverter]::ToUInt16($raw, $pos)
                    if ($uidFallback -gt 0) { $userIdStr = "" + $uidFallback }
                }

                $timeVal = [System.BitConverter]::ToUInt32($raw, $pos + 27)
                if ($userIdStr -and $timeVal -gt 0) {
                    $dtStr = Decode-ZKTime $timeVal
                    if ($dtStr.Length -ge 10 -and $dtStr.Substring(0, 10) -ge $cutoffDate) {
                        $syncKey = $userIdStr + "_" + $dtStr
                        if (-not $syncedKeys.Contains($syncKey)) {
                            [void]$newLogs.Add(@{
                                userId = $userIdStr
                                checkTime = $dtStr
                            })
                        }
                    }
                }
            }

            if ($newLogs.Count -gt 0) {
                try {
                    $postUrl = $serverUrl + "/api/iclock?sn=PC_AGENT_" + $institutionId + "&institution_id=" + $institutionId
                    $bodyObj = @{
                        institution_id = $institutionId
                        sn = ("PC_AGENT_" + $institutionId)
                        logs = @($newLogs.ToArray())
                    }
                    $jsonBody = ConvertTo-Json $bodyObj -Depth 5 -Compress
                    $resp = Invoke-RestMethod -Uri $postUrl -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody)) -TimeoutSec 15
                    foreach ($item in $newLogs) {
                        $k = $item.userId + "_" + $item.checkTime
                        [void]$syncedKeys.Add($k)
                        Write-Host ("[PUNCH SYNCED] ID: " + $item.userId + " | Time: " + $item.checkTime + " -> Uploaded to Deenora!") -ForegroundColor Green
                    }
                } catch {
                    Write-Host ("[!] Cloud upload retry pending: " + $_.Exception.Message) -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "[*] Scanning for ZKTeco machine on local network (4370 TCP/UDP)..." -ForegroundColor DarkGray
        if (($scanCycle -eq 1 -or ($scanCycle % 3 -eq 0)) -and $activeSubnets.Count -gt 0) {
            try {
                $probeUdp = New-Object System.Net.Sockets.UdpClient
                $probePkt = Build-ZKPacket 1000 0 0 $null
                foreach ($sub in $activeSubnets) {
                    for ($h = 2; $h -le 254; $h++) {
                        try {
                            $probeIp = $sub + "." + $h
                            $probeEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($probeIp), $port)
                            [void]$probeUdp.Send($probePkt, $probePkt.Length, $probeEp)
                        } catch {}
                    }
                }
                $probeUdp.Close()
                Start-Sleep -Milliseconds 400
            } catch {}
        }
    }

    Start-Sleep -Seconds 4
}
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    return res.status(200).send(ps1SyncScript);
  }

  // =========================================================================
  // 0d. Pure 7-Bit ASCII Windows Batch Runner for Attendance Sync (.bat)
  //     Zero Python, Zero Third-Party Libraries!
  // =========================================================================
  if (action === 'sync_attendance' || format === 'sync' || format === 'exe' || format === 'bat') {
    const syncScriptUrl = `${serverUrl}/api/pc-agent?institution_id=${institutionId}&device_ip=${encodeURIComponent(deviceIp)}&action=get_sync_script`;
    const syncBatLines = [
      '@echo off',
      'title Deenora ZKTeco Live Attendance Sync',
      'cls',
      'echo ================================================================',
      'echo       DEENORA - ZKTECO K40/K14 LIVE ATTENDANCE SYNC ENGINE',
      'echo ================================================================',
      'echo [*] Connecting to Deenora Cloud Server...',
      'set "APP_DIR=%PUBLIC%\\DeenoraBiometric"',
      'if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1',
      'if not exist "%APP_DIR%" set "APP_DIR=%LOCALAPPDATA%\\DeenoraBiometric"',
      'if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1',
      'set "PS_FILE=%APP_DIR%\\deenora_sync_attendance.ps1"',
      `set "SYNC_URL=${syncScriptUrl}"`,
      'del /f /q "%PS_FILE%" >nul 2>&1',
      'curl.exe -fsSL "%SYNC_URL%" -o "%PS_FILE%"',
      'if not exist "%PS_FILE%" (',
      '  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object System.Net.WebClient).DownloadFile($env:SYNC_URL, $env:PS_FILE)"',
      ')',
      'if exist "%PS_FILE%" (',
      '  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"',
      ') else (',
      '  echo [!] Failed to download attendance sync script. Check internet connection.',
      ')',
      'echo.',
      'pause'
    ];
    const syncBat = syncBatLines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Deenora_Attendance_Sync.bat"');
    return res.status(200).send(syncBat);
  }

  // =========================================================================
  // 1. ZKTeco USB Pen Drive Export (user.dat 72-Byte Binary Format)
  // =========================================================================
  if (format === 'usb' || format === 'dat') {
    try {
      const RECORD_SIZE = 72;
      const buffer = Buffer.alloc(userList.length * RECORD_SIZE);

      userList.forEach((u, idx) => {
        const offset = idx * RECORD_SIZE;
        const pin = (idx + 1) & 0xffff;
        const bioId = u.user_id.substring(0, 23);
        const cleanName = u.name.substring(0, 23);

        buffer.writeUInt16LE(pin, offset + 0);
        buffer.writeUInt8(0, offset + 2);
        buffer.write(cleanName, offset + 11, cleanName.length, 'ascii');
        buffer.writeUInt8(0x31, offset + 40);
        buffer.write(bioId, offset + 48, bioId.length, 'ascii');
      });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="user.dat"');
      return res.status(200).send(buffer);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to generate user.dat', details: err.message });
    }
  }

  // =========================================================================
  // 2. Full Standalone Python Tkinter Desktop GUI Application (.pyw)
  // =========================================================================
  const embeddedUsersJson = JSON.stringify(userList);

  const pythonGuiScript = `# -*- coding: utf-8 -*-
"""
Deenora SaaS ZKTeco K40/K14 Sync Manager
Native Desktop GUI Application - Automated Launch Edition
"""

import sys
import os
import time
import socket
import subprocess
import threading
from datetime import datetime, timedelta

def ensure_package(pkg, mod=None):
    if not mod:
        mod = pkg
    try:
        __import__(mod)
    except ImportError:
        try:
            py_exe = sys.executable
            if py_exe.lower().endswith("pythonw.exe"):
                candidate = py_exe[:-5] + ".exe"
                if os.path.exists(candidate):
                    py_exe = candidate
            subprocess.run([py_exe, "-m", "pip", "install", pkg, "--quiet"], check=True)
            __import__(mod)
        except Exception:
            pass

ensure_package("requests")
ensure_package("pyzk", "zk")

import requests
from zk import ZK
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

INSTITUTION_ID = "${institutionId}"
INSTITUTION_NAME = "${institutionName.replace(/"/g, '\\"')}"
SERVER_URL = "${serverUrl}"
DEFAULT_IP = "${deviceIp}"
DEFAULT_PORT = 4370
EMBEDDED_USERS = ${embeddedUsersJson}

BN_TO_EN_MAP = {
    'মোঃ': 'MD.', 'মো:': 'MD.', 'মুহাম্মদ': 'MD.', 'মোহাম্মদ': 'MD.',
    'মোসাঃ': 'MST.', 'মোসা:': 'MST.', 'মোসাম্মৎ': 'MST.',
    'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
    'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
    'আলী': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
    'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
    'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
    'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
    'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH'
}

BN_DIGIT_TRANS = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')

def normalize_bio_id_py(val):
    if val is None:
        return ''
    return str(val).translate(BN_DIGIT_TRANS).strip()

def clean_student_name(name):
    if not name:
        return 'STUDENT'
    s = str(name).translate(BN_DIGIT_TRANS).strip()
    for bn, en in BN_TO_EN_MAP.items():
        s = s.replace(bn, en)
    import re
    s = re.sub(r'[^A-Za-z0-9\\s._-]', '', s)
    s = re.sub(r'\\s+', ' ', s).strip()
    return (s.upper() if s else 'STUDENT')[:24]

class DeenoraBiometricApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Deenora - ZKTeco K40/K14 Sync Manager")
        self.geometry("780x640")
        self.minsize(720, 600)
        self.configure(bg="#0F172A")
        
        self.sync_running = False
        self.sync_thread = None
        self.synced_keys = set()
        self.active_machine_ip = DEFAULT_IP
        self.active_is_udp = False
        self.upload_in_progress = False

        self.setup_ui()
        self.check_cloud_connection_async()
        self.after(500, self.start_auto_sync_and_upload)

    def setup_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0F172A", foreground="#F8FAFC", font=("Segoe UI", 9))
        style.configure("TProgressbar", thickness=18, troughcolor="#1E293B", background="#10B981")

        header = tk.Frame(self, bg="#1E1B4B", padx=20, pady=16)
        header.pack(fill=tk.X)

        title_box = tk.Frame(header, bg="#1E1B4B")
        title_box.pack(side=tk.LEFT, fill=tk.Y)

        lbl_logo = tk.Label(title_box, text="DEENORA BIOMETRIC SYNC", font=("Segoe UI", 11, "bold"), fg="#A5B4FC", bg="#1E1B4B")
        lbl_logo.pack(anchor="w")

        lbl_inst = tk.Label(title_box, text=INSTITUTION_NAME, font=("Segoe UI", 15, "bold"), fg="#FFFFFF", bg="#1E1B4B")
        lbl_inst.pack(anchor="w", pady=(2, 0))

        lbl_sub = tk.Label(title_box, text="ZKTeco K40/K14 Biometric Machine Management Platform", font=("Segoe UI", 9), fg="#94A3B8", bg="#1E1B4B")
        lbl_sub.pack(anchor="w")

        status_bar = tk.Frame(self, bg="#1E293B", padx=16, pady=10)
        status_bar.pack(fill=tk.X, padx=16, pady=(12, 0))

        self.pill_cloud = tk.Label(status_bar, text="🟢 ক্লাউড: সংযুক্ত হচ্ছে...", font=("Segoe UI", 9, "bold"), fg="#E2E8F0", bg="#334155", padx=10, pady=4)
        self.pill_cloud.pack(side=tk.LEFT, padx=(0, 10))

        self.pill_machine = tk.Label(status_bar, text="🟡 মেশিন: স্ক্যানিং...", font=("Segoe UI", 9, "bold"), fg="#FEF08A", bg="#854D0E", padx=10, pady=4)
        self.pill_machine.pack(side=tk.LEFT)

        ip_frame = tk.Frame(status_bar, bg="#1E293B")
        ip_frame.pack(side=tk.RIGHT)

        tk.Label(ip_frame, text="মেশিন IP:", fg="#CBD5E1", bg="#1E293B", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
        self.ent_ip = tk.Entry(ip_frame, width=15, font=("Consolas", 10, "bold"), bg="#0F172A", fg="#38BDF8", insertbackground="white", bd=1, relief="solid")
        self.ent_ip.insert(0, DEFAULT_IP)
        self.ent_ip.pack(side=tk.LEFT, padx=4)

        btn_test = tk.Button(ip_frame, text="🔌 রি-স্ক্যান", font=("Segoe UI", 9, "bold"), bg="#4F46E5", fg="white", activebackground="#4338CA", activeforeground="white", bd=0, padx=8, pady=2, cursor="hand2", command=self.start_auto_sync_and_upload)
        btn_test.pack(side=tk.LEFT, padx=4)

        self.banner_error = tk.Frame(self, bg="#7F1D1D", padx=16, pady=10)
        lbl_err_text = tk.Label(
            self.banner_error, 
            text="⚠️ মেশিনের সাথে সংযোগ পাওয়া যায়নি! নিশ্চিত করুন মেশিনটি চালু আছে এবং রাউটারের সাথে নেটওয়ার্ক ক্যাবলে যুক্ত আছে।", 
            font=("Segoe UI", 9, "bold"), 
            fg="#FECACA", 
            bg="#7F1D1D",
            wraplength=540,
            justify=tk.LEFT
        )
        lbl_err_text.pack(side=tk.LEFT, fill=tk.X, expand=True)

        btn_retry = tk.Button(
            self.banner_error, 
            text="🔄 পুনরায় চেষ্টা করুন", 
            font=("Segoe UI", 9, "bold"), 
            bg="#DC2626", 
            fg="white", 
            activebackground="#B91C1C", 
            activeforeground="white", 
            bd=0, 
            padx=12, 
            pady=4, 
            cursor="hand2", 
            command=self.start_auto_sync_and_upload
        )
        btn_retry.pack(side=tk.RIGHT, padx=4)

        self.card_progress = tk.Frame(self, bg="#1E293B", padx=16, pady=12, highlightbackground="#334155", highlightthickness=1)
        self.card_progress.pack(fill=tk.X, padx=16, pady=10)

        top_row = tk.Frame(self.card_progress, bg="#1E293B")
        top_row.pack(fill=tk.X)

        self.lbl_task_title = tk.Label(top_row, text="🚀 স্বয়ংক্রিয় শিক্ষার্থী আপলোড ও সিঙ্ক শুরু হচ্ছে...", font=("Segoe UI", 10, "bold"), fg="#38BDF8", bg="#1E293B")
        self.lbl_task_title.pack(side=tk.LEFT)

        self.lbl_counter = tk.Label(top_row, text="অটো-স্ক্যান চলছে...", font=("Segoe UI", 9, "bold"), fg="#34D399", bg="#1E293B")
        self.lbl_counter.pack(side=tk.RIGHT)

        self.progress = ttk.Progressbar(self.card_progress, style="TProgressbar", mode="determinate")
        self.progress.pack(fill=tk.X, pady=(8, 4))

        self.lbl_sub_progress = tk.Label(self.card_progress, text="অপেক্ষা করুন, রাউটারের 192.168.0.x এবং 192.168.1.x সাবনেট পরীক্ষা করা হচ্ছে...", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B")
        self.lbl_sub_progress.pack(anchor="w")

        sync_bar = tk.Frame(self, bg="#0F172A", padx=16)
        sync_bar.pack(fill=tk.X, pady=(2, 6))

        self.btn_sync = tk.Button(sync_bar, text="▶️ লাইভ সিঙ্ক রানিং", font=("Segoe UI", 9, "bold"), bg="#059669", fg="white", activebackground="#047857", activeforeground="white", bd=0, padx=14, pady=6, cursor="hand2", command=self.toggle_sync)
        self.btn_sync.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_manual_upload = tk.Button(sync_bar, text="📥 পুনরায় শিক্ষার্থী আপলোড করুন", font=("Segoe UI", 9, "bold"), bg="#334155", fg="#E2E8F0", activebackground="#475569", activeforeground="white", bd=0, padx=12, pady=6, cursor="hand2", command=self.start_auto_sync_and_upload)
        self.btn_manual_upload.pack(side=tk.LEFT, padx=(0, 8))

        btn_min = tk.Button(sync_bar, text="🗕 উইন্ডো মিনিমাইজ", font=("Segoe UI", 9, "bold"), bg="#1E293B", fg="#94A3B8", activebackground="#334155", activeforeground="white", bd=0, padx=12, pady=6, cursor="hand2", command=self.iconify)
        btn_min.pack(side=tk.RIGHT)

        log_header = tk.Frame(self, bg="#0F172A", padx=16)
        log_header.pack(fill=tk.X, pady=(6, 2))

        tk.Label(log_header, text="📋 লাইভ পাঞ্চ ও অ্যাক্টিভিটি লগ (Live Activity Log):", font=("Segoe UI", 9, "bold"), fg="#CBD5E1", bg="#0F172A").pack(side=tk.LEFT)
        btn_clear = tk.Button(log_header, text="লগ মুছুন", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B", bd=0, padx=6, cursor="hand2", command=self.clear_log)
        btn_clear.pack(side=tk.RIGHT)

        log_frame = tk.Frame(self, bg="#0F172A", padx=16, pady=(0, 16))
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.txt_log = scrolledtext.ScrolledText(log_frame, bg="#020617", fg="#34D399", font=("Consolas", 9), bd=1, relief="solid", insertbackground="white")
        self.txt_log.pack(fill=tk.BOTH, expand=True)
        self.log("✅ Deenora Biometric Sync Manager সফলভাবে চালু হয়েছে।")

    def log(self, msg):
        now = datetime.now().strftime("%I:%M:%S %p")
        self.txt_log.insert(tk.END, f"[{now}] {msg}\\n")
        self.txt_log.see(tk.END)

    def clear_log(self):
        self.txt_log.delete("1.0", tk.END)

    def check_cloud_connection_async(self):
        def task():
            try:
                res = requests.get(f"{SERVER_URL}/api/iclock?sn=PC_AGENT_{INSTITUTION_ID}&institution_id={INSTITUTION_ID}", timeout=8)
                if res.status_code == 200:
                    self.pill_cloud.config(text="🟢 ক্লাউড: সংযুক্ত", bg="#065F46", fg="#A7F3D0")
                    self.log(f"সার্ভার কানেকশন ভেরিফাইড ({SERVER_URL})")
                else:
                    self.pill_cloud.config(text=f"🟡 ক্লাউড: কোড {res.status_code}", bg="#854D0E", fg="#FEF08A")
            except Exception as e:
                self.pill_cloud.config(text="🔴 ক্লাউড: অফলাইন মোড", bg="#991B1B", fg="#FECACA")
                self.log(f"সার্ভার অফলাইন বা লোকাল নেটওয়ার্কে কাজ করছে: {e}")
        threading.Thread(target=task, daemon=True).start()

    def start_auto_sync_and_upload(self):
        if self.upload_in_progress:
            return
        self.upload_in_progress = True
        self.banner_error.pack_forget()
        self.lbl_task_title.config(text="🚀 স্বয়ংক্রিয় প্রসেস চলছে...", fg="#38BDF8")
        self.lbl_counter.config(text="ধাপ ১: ডাটা ফেচ...")
        self.lbl_sub_progress.config(text="সার্ভার থেকে শিক্ষার্থীদের তালিকা আনা হচ্ছে...")
        self.progress["value"] = 5
        self.pill_machine.config(text="🟡 মেশিন: স্ক্যানিং...", bg="#854D0E", fg="#FEF08A")

        def worker():
            try:
                users = []
                self.log("সার্ভার থেকে শিক্ষার্থীদের তথ্য ফেচ করা হচ্ছে...")
                try:
                    res = requests.get(f"{SERVER_URL}/api/biometric-upload?institution_id={INSTITUTION_ID}&format=json", timeout=10)
                    if res.status_code == 200:
                        data = res.json()
                        users = data.get("users", [])
                except Exception as net_err:
                    self.log(f"অনলাইন ফেচে বিলম্ব: {net_err}। এমবেডেড ডাটা ব্যবহার করা হচ্ছে...")

                if not users and EMBEDDED_USERS:
                    users = EMBEDDED_USERS

                if not users:
                    self.log("⚠️ প্রতিষ্ঠানে কোনো শিক্ষার্থী পাওয়া যায়নি।")
                    self.lbl_counter.config(text="০ শিক্ষার্থী")
                    self.lbl_sub_progress.config(text="কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি")
                    self.upload_in_progress = False
                    return

                total_users = len(users)
                self.log(f"মোট {total_users} জন শিক্ষার্থী ও শিক্ষকের তালিকা প্রস্তুত হয়েছে।")
                self.lbl_counter.config(text=f"মোট: {total_users} জন")
                self.progress["value"] = 15

                self.lbl_sub_progress.config(text="লোকাল নেটওয়ার্কে ZKTeco K40 মেশিন খোঁজা হচ্ছে...")
                candidate_ips = []

                custom_ip = self.ent_ip.get().strip()
                if custom_ip and custom_ip not in candidate_ips:
                    candidate_ips.append(custom_ip)
                if DEFAULT_IP and DEFAULT_IP not in candidate_ips:
                    candidate_ips.append(DEFAULT_IP)

                defaults = ["192.168.0.201", "192.168.1.201", "192.168.0.202", "192.168.1.202", "192.168.0.100", "192.168.1.100"]
                for tip in defaults:
                    if tip not in candidate_ips:
                        candidate_ips.append(tip)

                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.connect(("8.8.8.8", 80))
                    local_ip = s.getsockname()[0]
                    s.close()
                    parts = local_ip.split('.')
                    if len(parts) == 4:
                        sub = f"{parts[0]}.{parts[1]}.{parts[2]}"
                        for h in [201, 202, 100, 200, 101]:
                            dip = f"{sub}.{h}"
                            if dip not in candidate_ips:
                                candidate_ips.insert(1, dip)
                except Exception:
                    pass

                self.log(f"স্ক্যানিং প্রার্থী আইপিসমূহ: {', '.join(candidate_ips[:6])}...")
                
                conn = None
                active_ip = None
                is_udp = False

                for tip in candidate_ips:
                    self.lbl_sub_progress.config(text=f"আইপি পরীক্ষা করা হচ্ছে: {tip}:{DEFAULT_PORT}...")
                    try:
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        sock.settimeout(1.2)
                        res = sock.connect_ex((tip, DEFAULT_PORT))
                        sock.close()
                        if res == 0:
                            zk = ZK(tip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=False, ommit_ping=True)
                            conn = zk.connect()
                            active_ip = tip
                            is_udp = False
                            self.log(f"✅ মেশিন পাওয়া গেছে: {tip} (TCP মোড)!")
                            break
                    except Exception:
                        pass

                    try:
                        zk = ZK(tip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=True, ommit_ping=True)
                        conn = zk.connect()
                        active_ip = tip
                        is_udp = True
                        self.log(f"✅ মেশিন পাওয়া গেছে: {tip} (UDP মোড)!")
                        break
                    except Exception:
                        pass

                if not conn or not active_ip:
                    self.log("❌ মেশিনের সাথে সংযোগ করা যায়নি! ক্যাবল ও পাওয়ার নিশ্চিত করুন।")
                    self.pill_machine.config(text="🔴 মেশিন: পাওয়া যায়নি", bg="#991B1B", fg="#FECACA")
                    self.lbl_task_title.config(text="⚠️ মেশিনের সংযোগ ব্যর্থ", fg="#F87171")
                    self.lbl_counter.config(text="কানেকশন এরর")
                    self.lbl_sub_progress.config(text="মেশিনটি রাউটারের সাথে নেটওয়ার্ক ক্যাবলে যুক্ত আছে কিনা তা নিশ্চিত করুন।")
                    self.banner_error.pack(fill=tk.X, padx=16, pady=(0, 10))
                    self.upload_in_progress = False
                    return

                self.active_machine_ip = active_ip
                self.active_is_udp = is_udp
                self.ent_ip.delete(0, tk.END)
                self.ent_ip.insert(0, active_ip)
                self.pill_machine.config(text=f"🟢 মেশিন: সংযুক্ত ({active_ip})", bg="#065F46", fg="#A7F3D0")

                self.log(f"🔍 ZKTeco মেশিনের বর্তমান ব্যবহারকারীদের তালিকা পড়া হচ্ছে...")
                self.lbl_task_title.config(text=f"📥 স্মার্ট ইনক্রিমেন্টাল আপলোড চলছে ({active_ip})...", fg="#38BDF8")

                try:
                    existing_users = conn.get_users() or []
                except Exception as read_err:
                    self.log(f"⚠️ মেশিনের পুরনো তালিকা পড়া যায়নি ({read_err})। নতুনভাবে আপলোড শুরু হচ্ছে...")
                    existing_users = []

                self.log(f"মেশিনে পূর্বে সংরক্ষিত ইউজার পাওয়া গেছে: {len(existing_users)} জন।")

                existing_by_user_id = {}
                existing_by_uid = {}
                existing_by_name = {}
                used_uids = set()
                max_existing_uid = 0

                for eu in existing_users:
                    eu_uid = int(getattr(eu, 'uid', 0) or 0)
                    eu_user_id = normalize_bio_id_py(getattr(eu, 'user_id', ''))
                    eu_name = clean_student_name(getattr(eu, 'name', ''))
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
                for u in users:
                    uid_str = normalize_bio_id_py(u.get("user_id", ""))
                    if uid_str and uid_str in existing_by_user_id:
                        claimed_uids.add(int(existing_by_user_id[uid_str].uid))

                new_uploaded_count = 0
                rewritten_count = 0
                skipped_count = 0
                fail_count = 0

                for idx, u in enumerate(users, 1):
                    raw_name = u.get("name", "STUDENT")
                    clean_name = clean_student_name(raw_name)
                    expected_slot_uid = int(u.get("uid", idx) or idx)
                    user_id_val = normalize_bio_id_py(u.get("user_id", ""))
                    if not user_id_val:
                        user_id_val = str(expected_slot_uid)

                    try:
                        # Case A: Already exists with matching user_id
                        matched_user = existing_by_user_id.get(user_id_val)
                        if matched_user is not None:
                            existing_uid = int(matched_user.uid)
                            existing_name = clean_student_name(getattr(matched_user, 'name', ''))
                            if existing_name == clean_name:
                                skipped_count += 1
                            else:
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
                                self.log(f"[{idx}/{total_users}] [REWRITE] স্লট: {existing_uid} | আইডি: {user_id_val:<6} | নাম: {clean_name}")
                        else:
                            # Case B: Old 1, 2, 3 serial rewrite by normalized name or unclaimed slot uid
                            rewrite_user = None
                            for cand in existing_by_name.get(clean_name, []):
                                cand_uid = int(cand.uid)
                                cand_uid_str = normalize_bio_id_py(getattr(cand, 'user_id', ''))
                                if cand_uid not in claimed_uids and cand_uid_str != user_id_val:
                                    rewrite_user = cand
                                    break

                            if rewrite_user is None and expected_slot_uid in existing_by_uid:
                                slot_cand = existing_by_uid[expected_slot_uid]
                                slot_uid = int(slot_cand.uid)
                                slot_user_id = normalize_bio_id_py(getattr(slot_cand, 'user_id', ''))
                                slot_name = clean_student_name(getattr(slot_cand, 'name', ''))
                                if slot_uid not in claimed_uids and slot_user_id != user_id_val and (slot_user_id == str(slot_uid) or slot_name == clean_name):
                                    rewrite_user = slot_cand

                            if rewrite_user is not None:
                                existing_uid = int(rewrite_user.uid)
                                claimed_uids.add(existing_uid)
                                old_id = normalize_bio_id_py(getattr(rewrite_user, 'user_id', ''))
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
                                self.log(f"[{idx}/{total_users}] [REWRITE] স্লট: {existing_uid} | {old_id} -> {user_id_val} | নাম: {clean_name}")
                            else:
                                # Case C: Newly added student/teacher -> next unused uid
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
                                self.log(f"[{idx}/{total_users}] [NEW] স্লট: {new_uid} | আইডি: {user_id_val:<6} | নাম: {clean_name}")
                    except Exception as u_err:
                        fail_count += 1
                        self.log(f"[{idx}/{total_users}] [ত্রুটি] আইডি: {user_id_val} -> {u_err}")

                    pct = int(20 + ((idx / total_users) * 75))
                    self.progress["value"] = pct
                    self.lbl_counter.config(text=f"প্রসেস হচ্ছে: {idx}/{total_users}")
                    self.lbl_sub_progress.config(text=f"আইডি: {user_id_val} - {clean_name} ({pct}%)")

                try:
                    conn.set_time(datetime.now())
                except Exception:
                    pass

                conn.disconnect()

                summary_text = f"নতুন আপলোড: {new_uploaded_count} | আইডি আপডেট (Rewrite): {rewritten_count} | আগে থেকেই ছিল (Skipped): {skipped_count}"
                self.progress["value"] = 100
                self.lbl_task_title.config(text="🎉 স্মার্ট শিক্ষার্থী সিঙ্ক সফল ও সম্পন্ন!", fg="#34D399")
                self.lbl_counter.config(text=f"নতুন: {new_uploaded_count} | আপডেট: {rewritten_count} | স্কিপ: {skipped_count}")
                self.lbl_sub_progress.config(text=summary_text)
                self.log(f"🎉 {summary_text}")

                try:
                    messagebox.showinfo("সফল আপলোড", f"🎉 সফল!\\n\\n{summary_text}\\n\\nএখন লাইভ হাজিরা সিঙ্ক স্বয়ংক্রিয়ভাবে চালু হচ্ছে...")
                except Exception:
                    pass

                self.log("🚀 লাইভ হাজিরা সিঙ্ক সার্ভিস ব্যাকগ্রাউন্ডে স্বয়ংক্রিয়ভাবে চালু করা হচ্ছে...")
                self.start_sync_service()

            except Exception as e:
                self.log(f"❌ আপলোডে অপ্রত্যাশিত ত্রুটি: {e}")
                self.lbl_task_title.config(text="⚠️ আপলোড ব্যর্থ", fg="#F87171")
                self.lbl_sub_progress.config(text=f"ত্রুটি: {e}")
                self.banner_error.pack(fill=tk.X, padx=16, pady=(0, 10))
            finally:
                self.upload_in_progress = False

        threading.Thread(target=worker, daemon=True).start()

    def start_sync_service(self):
        if self.sync_running:
            return
        self.sync_running = True
        self.btn_sync.config(text="⏹️ সিঙ্ক বন্ধ করুন", bg="#E11D48")
        self.log(f"🟢 লাইভ সিঙ্ক শুরু হয়েছে। প্রতি ৩ সেকেন্ড পর পর ZKTeco ({self.active_machine_ip}) থেকে পাঞ্চ গ্রহণ করা হচ্ছে...")
        self.sync_thread = threading.Thread(target=self.run_sync_loop, daemon=True)
        self.sync_thread.start()

    def toggle_sync(self):
        if self.sync_running:
            self.sync_running = False
            self.btn_sync.config(text="▶️ লাইভ সিঙ্ক শুরু করুন", bg="#059669")
            self.log("⏹️ লাইভ সিঙ্ক সার্ভিস বন্ধ করা হয়েছে।")
        else:
            self.start_sync_service()

    def run_sync_loop(self):
        while self.sync_running:
            target_ip = self.active_machine_ip or self.ent_ip.get().strip() or DEFAULT_IP
            try:
                zk = ZK(target_ip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=self.active_is_udp, ommit_ping=True)
                conn = zk.connect()
                self.pill_machine.config(text=f"🟢 মেশিন: লাইভ ({target_ip})", bg="#065F46", fg="#A7F3D0")

                while self.sync_running:
                    attendances = conn.get_attendance()
                    if attendances:
                        cutoff = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
                        new_logs = []
                        for att in attendances:
                            t_str = str(att.timestamp)
                            if t_str[:10] >= cutoff:
                                k = f"{att.user_id}_{t_str}"
                                if k not in self.synced_keys:
                                    new_logs.append({"userId": str(att.user_id), "checkTime": t_str})

                        if new_logs:
                            payload = {
                                "institution_id": INSTITUTION_ID,
                                "sn": f"PC_AGENT_{INSTITUTION_ID}",
                                "logs": new_logs
                            }
                            res = requests.post(
                                f"{SERVER_URL}/api/iclock", 
                                json=payload, 
                                headers={"X-Institution-Id": INSTITUTION_ID}, 
                                timeout=(8, 20)
                            )
                            if res.status_code == 200:
                                for l in new_logs:
                                    self.synced_keys.add(f"{l['userId']}_{l['checkTime']}")
                                    self.log(f"🔔 [পাঞ্চ রিসিভড] আইডি/রোল: {l['userId']} | সময়: {l['checkTime']} -> Deenora-তে উপস্থিতি নিশ্চিত!")
                            else:
                                self.log(f"⚠️ সার্ভার রেসপন্স কোড: {res.status_code}")

                    time.sleep(3)

                conn.disconnect()
            except Exception as e:
                if self.sync_running:
                    self.log(f"⚠️ মেশিন সংযোগ সাময়িক বিচ্ছিন্ন ({e})। ৫ সেকেন্ডে পুনরায় চেষ্টা করা হচ্ছে...")
                    self.pill_machine.config(text="🟡 মেশিন: রিকানেক্টিং...", bg="#854D0E", fg="#FEF08A")
                    time.sleep(5)

if __name__ == "__main__":
    app = DeenoraBiometricApp()
    app.mainloop()
`;

  if (format === 'pyw' || format === 'py') {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DeenoraBiometricManager_${institutionId || 'Setup'}.pyw"`);
    return res.status(200).send(pythonGuiScript);
  }

  // =========================================================================
  // 3. Dependency-Free 1-Click Native Windows Batch/PowerShell Script (.bat)
  // =========================================================================
  if (format === 'bat' || format === 'cmd') {
    const batLines = [
      '@echo off',
      'setlocal EnableDelayedExpansion',
      'title Deenora ZKTeco Biometric Sync Manager',
      'cls',
      'echo ===================================================================',
      'echo           DEENORA BIOMETRIC SYNC - ZKTECO K40/K14 MANAGER',
      'echo ===================================================================',
      'echo [*] Checking local environment...',
      'set "SCRIPT_DIR=%LOCALAPPDATA%\\DeenoraBiometric"',
      'if not exist "%SCRIPT_DIR%" mkdir "%SCRIPT_DIR%"',
      'set "PY_FILE=%SCRIPT_DIR%\\DeenoraBiometricManager.pyw"',
      'where pythonw >nul 2>&1',
      'if %ERRORLEVEL% EQU 0 (',
      '    set RUN_CMD=pythonw',
      '    goto EXTRACT_AND_RUN',
      ')',
      'where python >nul 2>&1',
      'if %ERRORLEVEL% EQU 0 (',
      '    set RUN_CMD=python',
      '    goto EXTRACT_AND_RUN',
      ')',
      'where py >nul 2>&1',
      'if %ERRORLEVEL% EQU 0 (',
      '    set RUN_CMD=py',
      '    goto EXTRACT_AND_RUN',
      ')',
      'echo [!] Python is not installed. Please use Button 2 (Student Upload Downloader) which requires zero Python!',
      'pause',
      'exit /b 1',
      ':EXTRACT_AND_RUN',
      'echo [*] Launching Deenora Biometric GUI Application...',
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('%PY_FILE%', [System.Convert]::FromBase64String('${Buffer.from(pythonGuiScript, 'utf-8').toString('base64')}'))"`,
      'start "" %RUN_CMD% "%PY_FILE%"',
      'exit /b 0'
    ];
    const batScript = batLines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Deenora1ClickRunner.bat"');
    return res.status(200).send(batScript);
  }

  // =========================================================================
  // 4. Native Windows Standalone Executable (.exe) Packaging
  // =========================================================================
  const stubPath = path.join(process.cwd(), 'public', 'DeenoraBiometricSetup_stub.exe');
  const libStubPath = path.join(process.cwd(), 'lib', 'DeenoraBiometricSetup_stub.exe');
  const effectiveStubPath = fs.existsSync(stubPath) ? stubPath : (fs.existsSync(libStubPath) ? libStubPath : null);

  if (effectiveStubPath && fs.existsSync(effectiveStubPath)) {
    try {
      const stubBuffer = fs.readFileSync(effectiveStubPath);
      const payloadString = `\n###DEENORA_PAYLOAD_START###\n${pythonGuiScript}\n###DEENORA_PAYLOAD_END###\n`;
      const payloadBuffer = Buffer.from(payloadString, 'utf-8');
      const fullExeBuffer = Buffer.concat([stubBuffer, payloadBuffer]);

      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader('Content-Disposition', 'attachment; filename="DeenoraBiometricSetup.exe"');
      return res.status(200).send(fullExeBuffer);
    } catch (err: any) {
      console.error('[PC Agent] Failed to read or package stub.exe:', err);
    }
  }

  res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="DeenoraBiometricManager.pyw"');
  return res.status(200).send(pythonGuiScript);
}