import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const supabase = getSupabaseAdmin();

// Common Bengali/Islamic Name Transliteration for ZKTeco LCD
const BN_TO_EN_NAME_MAP: Record<string, string> = {
  'মোঃ': 'MD.', 'মো:': 'MD.', 'মুহাম্মদ': 'MD.', 'মোহাম্মদ': 'MD.',
  'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
  'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
  'আলী': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
  'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
  'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
  'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
  'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH',
  'মারুফ': 'MARUF', 'রাব্বি': 'RABBI', 'ফাহিম': 'FAHIM', 'আলম': 'ALAM',
  'জান্নাত': 'JANNAT', 'ফাতেমা': 'FATEMA', 'আয়েশা': 'AYESHA', 'খাদিজা': 'KHADIJA'
};

function transliterateBnToEn(text?: string | null): string {
  if (!text || typeof text !== 'string') return 'STUDENT';
  let clean = text.trim();
  if (!clean) return 'STUDENT';

  for (const [bn, en] of Object.entries(BN_TO_EN_NAME_MAP)) {
    clean = clean.split(bn).join(en);
  }

  clean = clean.replace(/[^A-Za-z0-9\s._-]/g, '').replace(/\s+/g, ' ').trim();
  return clean ? clean.toUpperCase() : 'STUDENT';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const institutionId = (query.institution_id || query.institutionId || query.inst || '').toString().trim();
  const deviceIp = (query.device_ip || query.deviceIp || '192.168.0.201').toString().trim();
  const format = (query.format || '').toString().trim().toLowerCase();
  const action = (query.action || '').toString().trim().toLowerCase();

  const serverHost = req.headers.host || 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  // Fetch institution name & users (students + teachers)
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
        .select('id, student_name, name_en, roll, biometric_id, is_active')
        .eq('institution_id', institutionId)
        .order('roll', { ascending: true });

      const allocatedUids = new Set<number>();
      let autoUid = 1;
      const allocateUid = (desired?: number): number => {
        if (desired && desired > 0 && !allocatedUids.has(desired)) {
          allocatedUids.add(desired);
          return desired;
        }
        while (allocatedUids.has(autoUid)) {
          autoUid++;
        }
        allocatedUids.add(autoUid);
        return autoUid;
      };

      (students || []).forEach((st: any, idx: number) => {
        const bioId = (st.biometric_id || st.roll || String(idx + 1)).toString().trim();
        const numBioId = parseInt(bioId, 10);
        const uid = allocateUid(!isNaN(numBioId) && numBioId > 0 ? numBioId : undefined);
        const rawName = st.name_en || st.student_name || 'STUDENT';
        const cleanName = transliterateBnToEn(rawName).substring(0, 23);

        userList.push({
          uid,
          user_id: bioId || String(uid),
          name: cleanName,
          role: 'student'
        });
      });

      // Teachers with biometric id
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, teacher_name, name, biometric_id, permissions')
        .eq('institution_id', institutionId);

      (teachers || []).forEach((t: any) => {
        const perms = t.permissions || {};
        const bioId = (perms.biometric_id || t.biometric_id || perms.teacher_id_number || '').toString().trim();
        if (bioId) {
          const numBioId = parseInt(bioId, 10);
          const uid = allocateUid(!isNaN(numBioId) && numBioId > 0 ? numBioId : undefined);
          const rawName = t.name || t.teacher_name || 'TEACHER';
          const cleanName = transliterateBnToEn(rawName).substring(0, 23);
          userList.push({
            uid,
            user_id: bioId,
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
  // 0a. Dynamic PowerShell Script for Student Uploader (Pure UTF-8 text)
  // =========================================================================
  if (action === 'get_upload_script') {
    const embeddedUsersJson = JSON.stringify(userList);
    const safeInstName = institutionName.replace(/["`$\\]/g, '');

    const ps1UploadScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")

function Show-MsgBox([string]$msg, [string]$title, [string]$iconType) {
    try {
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($iconType -eq "Error") {
            $icon = [System.Windows.Forms.MessageBoxIcon]::Error
        } elseif ($iconType -eq "Warning") {
            $icon = [System.Windows.Forms.MessageBoxIcon]::Warning
        }
        [System.Windows.Forms.MessageBox]::Show($msg, $title, [System.Windows.Forms.MessageBoxButtons]::OK, $icon)
    } catch {
        Write-Host ($title + ": " + $msg)
    }
}

function Calculate-ZKChecksum([byte[]]$buf) {
    [uint32]$chk = 0
    $len = $buf.Length
    $i = 0
    while ($len -gt 1) {
        $chk += [uint32]($buf[$i] -bor ($buf[$i+1] -shl 8))
        $i += 2
        $len -= 2
    }
    if ($len -eq 1) {
        $chk += [uint32]$buf[$i]
    }
    $chk = ($chk -shr 16) + ($chk -band 0xFFFF)
    $chk = $chk + ($chk -shr 16)
    $inverted = -bnot ($chk -band 0xFFFF)
    return [uint16]($inverted -band 0xFFFF)
}

function Build-ZKPacket([uint16]$cmd, [uint16]$session, [uint16]$reply, [byte[]]$payload) {
    $pLen = if ($payload) { $payload.Length } else { 0 }
    $full = New-Object byte[] (8 + $pLen)
    $full[0] = [byte]($cmd -band 0xFF)
    $full[1] = [byte](($cmd -shr 8) -band 0xFF)
    $full[2] = 0
    $full[3] = 0
    $full[4] = [byte]($session -band 0xFF)
    $full[5] = [byte](($session -shr 8) -band 0xFF)
    $full[6] = [byte]($reply -band 0xFF)
    $full[7] = [byte](($reply -shr 8) -band 0xFF)
    if ($pLen -gt 0) {
        [System.Buffer]::BlockCopy($payload, 0, $full, 8, $pLen)
    }
    $chk = Calculate-ZKChecksum $full
    $full[2] = [byte]($chk -band 0xFF)
    $full[3] = [byte](($chk -shr 8) -band 0xFF)
    return $full
}

function Build-UserPayload([uint16]$uid, [string]$name, [string]$userId) {
    $bytes = New-Object byte[] 72
    $bytes[0] = [byte]($uid -band 0xFF)
    $bytes[1] = [byte](($uid -shr 8) -band 0xFF)
    $bytes[2] = 0
    $cleanName = ($name -replace '[^A-Za-z0-9\\s._-]', '').Trim().ToUpper()
    if ([string]::IsNullOrWhiteSpace($cleanName)) { $cleanName = "STUDENT" }
    $nameBytes = [System.Text.Encoding]::ASCII.GetBytes($cleanName)
    $maxName = [Math]::Min($nameBytes.Length, 24)
    [System.Buffer]::BlockCopy($nameBytes, 0, $bytes, 11, $maxName)
    $bytes[39] = 1
    $cleanId = ($userId -replace '[^A-Za-z0-9._-]', '').Trim()
    if ([string]::IsNullOrWhiteSpace($cleanId)) { $cleanId = "" + $uid }
    $idBytes = [System.Text.Encoding]::ASCII.GetBytes($cleanId)
    $maxId = [Math]::Min($idBytes.Length, 24)
    [System.Buffer]::BlockCopy($idBytes, 0, $bytes, 48, $maxId)
    return $bytes
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   DEENORA ZKTECO K40/K14 STUDENT UPLOADER (DEPENDENCY-FREE)    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Institution : ${safeInstName}" -ForegroundColor Yellow
Write-Host "Server URL  : ${serverUrl}" -ForegroundColor Gray
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

# Step 1: Automatically fetch active students
Write-Host "[1/4] শিক্ষার্থীদের তালিকা ফেচ করা হচ্ছে..." -ForegroundColor White
$users = @()
try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls11 -bor [System.Net.SecurityProtocolType]::Tls
    $apiUrl = "${serverUrl}/api/biometric-upload?institution_id=${institutionId}&format=json"
    $webReq = [System.Net.WebRequest]::Create($apiUrl)
    $webReq.Timeout = 10000
    $webResp = $webReq.GetResponse()
    $reader = New-Object System.IO.StreamReader($webResp.GetResponseStream())
    $rawJson = $reader.ReadToEnd()
    $reader.Close()
    $webResp.Close()
    
    $parsed = ConvertFrom-Json $rawJson
    if ($parsed.users -and $parsed.users.Count -gt 0) {
        $users = $parsed.users
        Write-Host ("  -> ক্লাউড সার্ভার থেকে " + $users.Count + " জন শিক্ষার্থীর তথ্য লোড হয়েছে।") -ForegroundColor Green
    }
} catch {
    Write-Host "  -> ক্লাউড সংযোগে বিলম্ব। অফলাইন প্রি-প্যাকড তালিকা যাচাই করা হচ্ছে..." -ForegroundColor Yellow
}

if ($users.Count -eq 0 -and $embeddedUsersJson.Trim().Length -gt 2) {
    try {
        $users = ConvertFrom-Json $embeddedUsersJson
        Write-Host ("  -> অফলাইন তালিকা থেকে " + $users.Count + " জন শিক্ষার্থীর তথ্য লোড হয়েছে।") -ForegroundColor Green
    } catch {}
}

if ($users.Count -eq 0) {
    Write-Host "❌ কোনো শিক্ষার্থী পাওয়া যায়নি।" -ForegroundColor Red
    Show-MsgBox "কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি। অনুগ্রহ করে নিশ্চিত করুন প্রতিষ্ঠানে শিক্ষার্থী যুক্ত আছে।" "Deenora Uploader" "Warning"
    Read-Host "উইন্ডো বন্ধ করতে Enter চাপুন..."
    exit 1
}

Write-Host ("সর্বমোট শিক্ষার্থী: " + $users.Count + " জন") -ForegroundColor Cyan

# Step 2: Auto IP Subnet Scan
Write-Host ""
Write-Host "[2/4] লোকাল নেটওয়ার্কে ZKTeco মেশিন স্ক্যান করা হচ্ছে..." -ForegroundColor White

$candidateIps = [System.Collections.Generic.List[string]]::new()
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
                    if (-not $ipStr.StartsWith("127.")) {
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
$activeSession = 0
$activeReply = 0
$udpClient = New-Object System.Net.Sockets.UdpClient
$udpClient.Client.ReceiveTimeout = 1200
$udpClient.Client.SendTimeout = 1200

foreach ($tip in $candidateIps) {
    Write-Host ("  -> আইপি টেস্ট: " + $tip + ":4370 ... ") -NoNewline -ForegroundColor Gray
    try {
        $targetEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($tip), $port)
        # CMD_CONNECT = 1000
        $pkt = Build-ZKPacket 1000 0 0 $null
        $udpClient.Send($pkt, $pkt.Length, $targetEp) | Out-Null
        $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $recv = $udpClient.Receive([ref]$remoteEp)
        if ($recv -and $recv.Length -ge 8) {
            $respCode = [uint16]($recv[0] -bor ($recv[1] -shl 8))
            $respSession = [uint16]($recv[4] -bor ($recv[5] -shl 8))
            $respReply = [uint16]($recv[6] -bor ($recv[7] -shl 8))
            if ($respCode -eq 2000 -or $respCode -eq 1000) {
                Write-Host "সংযুক্ত! [OK]" -ForegroundColor Green
                $activeIp = $tip
                $activeSession = $respSession
                $activeReply = [uint16](($respReply + 1) -band 0xFFFF)
                break
            }
        }
        Write-Host "না" -ForegroundColor DarkGray
    } catch {
        Write-Host "না" -ForegroundColor DarkGray
    }
}

# Step 5: Error Handling if machine cannot be reached
if (-not $activeIp) {
    Write-Host ""
    Write-Host "❌ কোনো ZKTeco মেশিনের সাথে সংযোগ পাওয়া যায়নি!" -ForegroundColor Red
    Write-Host "পরীক্ষা করা আইপিসমূহ:" -ForegroundColor DarkGray
    foreach ($cand in $candidateIps) {
        Write-Host ("  - " + $cand + ":4370") -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "অনুগ্রহ করে নিশ্চিত করুন:" -ForegroundColor Yellow
    Write-Host "  ১. ZKTeco মেশিনটি পাওয়ার অন (চালু) আছে।" -ForegroundColor Yellow
    Write-Host "  ২. মেশিনটি নেটওয়ার্ক ক্যাবল দিয়ে রাউটারের সাথে যুক্ত আছে।" -ForegroundColor Yellow
    Write-Host "  ৩. এই কম্পিউটারটি একই রাউটার নেটওয়ার্কে যুক্ত আছে।" -ForegroundColor Yellow
    
    Show-MsgBox "❌ হাজিরা মেশিনের সাথে সংযোগ পাওয়া যায়নি! অনুগ্রহ করে নিশ্চিত করুন মেশিনটি রাউটারের সাথে নেটওয়ার্ক ক্যাবলে যুক্ত আছে এবং চালু আছে।" "Deenora ZKTeco Uploader" "Error"
    Read-Host "উইন্ডো বন্ধ করতে Enter চাপুন..."
    exit 1
}

# Step 3: Push to Machine
Write-Host ""
Write-Host ("[3/4] ZKTeco মেশিনে (" + $activeIp + ") শিক্ষার্থী আপলোড শুরু হচ্ছে...") -ForegroundColor White
$machineEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($activeIp), $port)
$udpClient.Client.ReceiveTimeout = 2500

$successCount = 0
for ($i = 0; $i -lt $users.Count; $i++) {
    $u = $users[$i]
    $uidVal = [uint16]($u.uid)
    $cleanName = [string]($u.name)
    $userBioId = [string]($u.user_id)
    if ([string]::IsNullOrWhiteSpace($userBioId)) { $userBioId = "" + $uidVal }
    
    $payload = Build-UserPayload $uidVal $cleanName $userBioId
    # CMD_SET_USERINFO = 8
    $pkt = Build-ZKPacket 8 $activeSession $activeReply $payload
    $activeReply = [uint16](($activeReply + 1) -band 0xFFFF)
    
    for ($retry = 0; $retry -lt 2; $retry++) {
        try {
            $udpClient.Send($pkt, $pkt.Length, $machineEp) | Out-Null
            $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
            $recv = $udpClient.Receive([ref]$remoteEp)
            if ($recv -and $recv.Length -ge 8) {
                $code = [uint16]($recv[0] -bor ($recv[1] -shl 8))
                if ($code -eq 2000 -or $code -eq 8) {
                    break
                }
            }
        } catch {
            Start-Sleep -Milliseconds 40
        }
    }
    
    $successCount++
    Write-Host ("  [" + ($i+1) + "/" + $users.Count + "] [OK] রোল/আইডি: " + $userBioId.PadRight(6) + " | নাম: " + $cleanName) -ForegroundColor Green
    Start-Sleep -Milliseconds 25
}

# Refresh machine's internal buffer (CMD_REFRESHDATA = 1013)
Write-Host ""
Write-Host "[+] মেশিনের ইন্টারনাল মেমোরি রিফ্রেশ করা হচ্ছে (CMD_REFRESHDATA)..." -ForegroundColor White
try {
    $refreshPkt = Build-ZKPacket 1013 $activeSession $activeReply $null
    $activeReply = [uint16](($activeReply + 1) -band 0xFFFF)
    $udpClient.Send($refreshPkt, $refreshPkt.Length, $machineEp) | Out-Null
} catch {}

# Clean disconnect (CMD_EXIT = 1001)
try {
    $exitPkt = Build-ZKPacket 1001 $activeSession $activeReply $null
    $udpClient.Send($exitPkt, $exitPkt.Length, $machineEp) | Out-Null
} catch {}
$udpClient.Close()

# Step 4: Visible Windows Success Dialog
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "      🎉 শিক্ষার্থী আপলোড সফল ও সম্পন্ন!                         " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ("মোট আপলোড হয়েছে : " + $successCount + " জন") -ForegroundColor Cyan
Write-Host ("টার্গেট মেশিন IP : " + $activeIp) -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Green

$succMsg = "✅ সফল! সর্বমোট " + $successCount + " জন শিক্ষার্থীর নাম ও রোল নম্বর ZKTeco মেশিনে সফলভাবে আপলোড হয়েছে। এখন শিক্ষার্থীরা মেশিনে ফিঙ্গারপ্রিন্ট দিতে পারবে।"
Show-MsgBox $succMsg "Deenora ZKTeco Uploader - সফল" "Info"

Read-Host "কার্যক্রম শেষ হয়েছে। উইন্ডো বন্ধ করতে Enter চাপুন..."
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    return res.status(200).send(ps1UploadScript);
  }

  // =========================================================================
  // 0b. Lightweight Windows Batch Runner (.bat) - Under 600 characters
  //     (ZERO CMD character limit issues, ZERO base64 overflow)
  // =========================================================================
  if (action === 'upload_students' || format === 'upload' || format === 'upload_students') {
    const uploadBat = `@echo off
title Deenora ZKTeco Student Uploader
chcp 65001 >nul
cls

echo ================================================================
echo       DEENORA - ZKTECO K40/K14 STUDENT UPLOAD ENGINE
echo ================================================================
echo [*] Connecting to Deenora Cloud Server...
echo [*] Scanning local network for ZKTeco Biometric Machine...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls11 -bor [System.Net.SecurityProtocolType]::Tls; $u = '${serverUrl}/api/pc-agent?institution_id=${institutionId}&action=get_upload_script'; try { $wc = New-Object System.Net.WebClient; $wc.Encoding = [System.Text.Encoding]::UTF8; $code = $wc.DownloadString($u); Invoke-Expression $code; } catch { Write-Host '❌ ক্লাউড সার্ভারের সাথে সংযোগে ত্রুটি: ' $_.Exception.Message -ForegroundColor Red; [void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [void][System.Windows.Forms.MessageBox]::Show('সার্ভারের সাথে সংযোগ পাওয়া যায়নি। ইন্টারনেট কানেকশন চেক করুন।', 'Deenora Error', 0, 16); }; Write-Host ''; Write-Host 'উইন্ডো বন্ধ করতে যেকোনো কি চাপুন...' -ForegroundColor Gray; [void][Console]::ReadKey();"

exit /b 0
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Deenora_Upload_Students.bat"');
    return res.status(200).send(uploadBat);
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
        const pin = u.uid & 0xffff;
        const bioId = u.user_id.substring(0, 23);
        const cleanName = u.name.substring(0, 23);

        // 1. PIN (U16, 2 bytes, little-endian)
        buffer.writeUInt16LE(pin, offset + 0);
        // 2. Privilege (U8, 1 byte) = 0 (Normal User)
        buffer.writeUInt8(0, offset + 2);
        // 3. Password (char[8]) = 0 (offset 3 to 10)
        // 4. Name (char[24], offset 11 to 34)
        buffer.write(cleanName, offset + 11, cleanName.length, 'ascii');
        // 5. Card (U8[4], offset 35 to 38) = 0
        // 6. Group (U8, offset 39) = 1 (Default Group)
        buffer.writeUInt8(1, offset + 39);
        // 7. TimeZones (U16[4], offset 40 to 47) = 0
        // 8. PIN2 (char[24], offset 48 to 71) = Alphanumeric user_id/biometric_id
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
  //    WITH AUTOMATIC UPLOAD ON APPLICATION LAUNCH & DUAL-SUBNET IP SCANNING
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
            subprocess.run([sys.executable, "-m", "pip", "install", pkg, "--quiet"], check=True)
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
    'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
    'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
    'আলী': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
    'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
    'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
    'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
    'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH'
}

def clean_student_name(name):
    if not name:
        return 'STUDENT'
    s = str(name).strip()
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

        # 🚀 IMMEDIATE AUTO-START ON LAUNCH: Zero Manual Clicks Required!
        self.after(500, self.start_auto_sync_and_upload)

    def setup_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0F172A", foreground="#F8FAFC", font=("Segoe UI", 9))
        style.configure("TProgressbar", thickness=18, troughcolor="#1E293B", background="#10B981")

        # 1. Header Frame
        header = tk.Frame(self, bg="#1E1B4B", padx=20, pady=16)
        header.pack(fill=tk.X)

        title_box = tk.Frame(header, bg="#1E1B4B")
        title_box.pack(side=tk.LEFT, fill=tk.Y)

        lbl_logo = tk.Label(title_box, text="﷽  DEENORA BIOMETRIC SYNC", font=("Segoe UI", 11, "bold"), fg="#A5B4FC", bg="#1E1B4B")
        lbl_logo.pack(anchor="w")

        lbl_inst = tk.Label(title_box, text=INSTITUTION_NAME, font=("Segoe UI", 15, "bold"), fg="#FFFFFF", bg="#1E1B4B")
        lbl_inst.pack(anchor="w", pady=(2, 0))

        lbl_sub = tk.Label(title_box, text="ZKTeco K40/K14 Biometric Machine Management Platform", font=("Segoe UI", 9), fg="#94A3B8", bg="#1E1B4B")
        lbl_sub.pack(anchor="w")

        # 2. Status Pills Bar
        status_bar = tk.Frame(self, bg="#1E293B", padx=16, pady=10)
        status_bar.pack(fill=tk.X, padx=16, pady=(12, 0))

        self.pill_cloud = tk.Label(status_bar, text="🟢 ক্লাউড: সংযুক্ত হচ্ছে...", font=("Segoe UI", 9, "bold"), fg="#E2E8F0", bg="#334155", padx=10, pady=4)
        self.pill_cloud.pack(side=tk.LEFT, padx=(0, 10))

        self.pill_machine = tk.Label(status_bar, text="🟡 মেশিন: স্ক্যানিং...", font=("Segoe UI", 9, "bold"), fg="#FEF08A", bg="#854D0E", padx=10, pady=4)
        self.pill_machine.pack(side=tk.LEFT)

        # IP Settings inline on right
        ip_frame = tk.Frame(status_bar, bg="#1E293B")
        ip_frame.pack(side=tk.RIGHT)

        tk.Label(ip_frame, text="মেশিন IP:", fg="#CBD5E1", bg="#1E293B", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
        self.ent_ip = tk.Entry(ip_frame, width=15, font=("Consolas", 10, "bold"), bg="#0F172A", fg="#38BDF8", insertbackground="white", bd=1, relief="solid")
        self.ent_ip.insert(0, DEFAULT_IP)
        self.ent_ip.pack(side=tk.LEFT, padx=4)

        btn_test = tk.Button(ip_frame, text="🔌 রি-স্ক্যান", font=("Segoe UI", 9, "bold"), bg="#4F46E5", fg="white", activebackground="#4338CA", activeforeground="white", bd=0, padx=8, pady=2, cursor="hand2", command=self.start_auto_sync_and_upload)
        btn_test.pack(side=tk.LEFT, padx=4)

        # 3. Dedicated Bengali Error Banner (Initially Hidden)
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

        # 4. Automated Upload Progress Card
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

        # 5. Live Sync Controls Bar
        sync_bar = tk.Frame(self, bg="#0F172A", padx=16)
        sync_bar.pack(fill=tk.X, pady=(2, 6))

        self.btn_sync = tk.Button(sync_bar, text="▶️ লাইভ সিঙ্ক রানিং", font=("Segoe UI", 9, "bold"), bg="#059669", fg="white", activebackground="#047857", activeforeground="white", bd=0, padx=14, pady=6, cursor="hand2", command=self.toggle_sync)
        self.btn_sync.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_manual_upload = tk.Button(sync_bar, text="📥 পুনরায় শিক্ষার্থী আপলোড করুন", font=("Segoe UI", 9, "bold"), bg="#334155", fg="#E2E8F0", activebackground="#475569", activeforeground="white", bd=0, padx=12, pady=6, cursor="hand2", command=self.start_auto_sync_and_upload)
        self.btn_manual_upload.pack(side=tk.LEFT, padx=(0, 8))

        btn_min = tk.Button(sync_bar, text="🗕 উইন্ডো মিনিমাইজ", font=("Segoe UI", 9, "bold"), bg="#1E293B", fg="#94A3B8", activebackground="#334155", activeforeground="white", bd=0, padx=12, pady=6, cursor="hand2", command=self.iconify)
        btn_min.pack(side=tk.RIGHT)

        # 6. Live Activity Log Section
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
                # -------------------------------------------------------------
                # ধাপ ১: Cloud Fetch (with offline fallback to embedded users)
                # -------------------------------------------------------------
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

                # -------------------------------------------------------------
                # ধাপ ২: Smart Dual-Subnet & Candidate IP Scan
                # -------------------------------------------------------------
                self.lbl_sub_progress.config(text="লোকাল নেটওয়ার্কে ZKTeco K40 মেশিন খোঁজা হচ্ছে...")
                candidate_ips = []
                
                # Priority 1: User typed or default IP
                custom_ip = self.ent_ip.get().strip()
                if custom_ip and custom_ip not in candidate_ips:
                    candidate_ips.append(custom_ip)
                if DEFAULT_IP and DEFAULT_IP not in candidate_ips:
                    candidate_ips.append(DEFAULT_IP)

                # Priority 2: Standard Dual-Subnet candidates (192.168.0.x and 192.168.1.x)
                defaults = ["192.168.0.201", "192.168.1.201", "192.168.0.202", "192.168.1.202", "192.168.0.100", "192.168.1.100"]
                for tip in defaults:
                    if tip not in candidate_ips:
                        candidate_ips.append(tip)

                # Priority 3: Local adapter subnet auto-discovery
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
                    # 1. Quick TCP check
                    try:
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        sock.settimeout(1.2)
                        res = sock.connect_ex((tip, DEFAULT_PORT))
                        sock.close()
                        if res == 0:
                            zk = ZK(tip, port=DEFAULT_PORT, timeout=3, password=0, force_udp=False, ommit_ping=True)
                            conn = zk.connect()
                            active_ip = tip
                            is_udp = False
                            self.log(f"✅ মেশিন পাওয়া গেছে: {tip} (TCP মোড)!")
                            break
                    except Exception:
                        pass

                    # 2. Quick UDP check
                    try:
                        zk = ZK(tip, port=DEFAULT_PORT, timeout=3, password=0, force_udp=True, ommit_ping=True)
                        conn = zk.connect()
                        active_ip = tip
                        is_udp = True
                        self.log(f"✅ মেশিন পাওয়া গেছে: {tip} (UDP মোড)!")
                        break
                    except Exception:
                        pass

                # If connection failed across all candidate IPs:
                if not conn or not active_ip:
                    self.log("❌ মেশিনের সাথে সংযোগ করা যায়নি! ক্যাবল ও পাওয়ার নিশ্চিত করুন।")
                    self.pill_machine.config(text="🔴 মেশিন: পাওয়া যায়নি", bg="#991B1B", fg="#FECACA")
                    self.lbl_task_title.config(text="⚠️ মেশিনের সংযোগ ব্যর্থ", fg="#F87171")
                    self.lbl_counter.config(text="কানেকশন এরর")
                    self.lbl_sub_progress.config(text="মেশিনটি রাউটারের সাথে নেটওয়ার্ক ক্যাবলে যুক্ত আছে কিনা তা নিশ্চিত করুন।")
                    self.banner_error.pack(fill=tk.X, padx=16, pady=(0, 10))
                    self.upload_in_progress = False
                    return

                # Record active IP
                self.active_machine_ip = active_ip
                self.active_is_udp = is_udp
                self.ent_ip.delete(0, tk.END)
                self.ent_ip.insert(0, active_ip)
                self.pill_machine.config(text=f"🟢 মেশিন: সংযুক্ত ({active_ip})", bg="#065F46", fg="#A7F3D0")

                # -------------------------------------------------------------
                # ধাপ ৩: Auto Upload to Machine
                # -------------------------------------------------------------
                self.log(f"🚀 ZKTeco মেশিনে {total_users} জন শিক্ষার্থী স্বয়ংক্রিয়ভাবে আপলোড হচ্ছে...")
                self.lbl_task_title.config(text=f"📥 মেশিনে শিক্ষার্থী আপলোড হচ্ছে ({active_ip})...", fg="#38BDF8")
                
                success_count = 0
                for idx, u in enumerate(users, 1):
                    raw_name = u.get("name", "STUDENT")
                    clean_name = clean_student_name(raw_name)
                    uid_val = int(u.get("uid", idx))
                    user_id_val = str(u.get("user_id", uid_val))

                    try:
                        conn.set_user(uid=uid_val, name=clean_name, privilege=0, password='', group_id='', user_id=user_id_val, card=0)
                        success_count += 1
                        self.log(f"[{idx}/{total_users}] [OK] রোল/আইডি: {user_id_val:<5} | নাম: {clean_name}")
                    except Exception as u_err:
                        self.log(f"[{idx}/{total_users}] [ত্রুটি] আইডি: {user_id_val} -> {u_err}")

                    pct = int(20 + ((idx / total_users) * 75))
                    self.progress["value"] = pct
                    self.lbl_counter.config(text=f"আপলোড হচ্ছে: {idx}/{total_users}")
                    self.lbl_sub_progress.config(text=f"রোল: {user_id_val} - {clean_name} ({pct}%)")

                # Sync machine time with PC
                try:
                    conn.set_time(datetime.now())
                except Exception:
                    pass

                conn.disconnect()

                # -------------------------------------------------------------
                # ধাপ ৪: Success Notification
                # -------------------------------------------------------------
                self.progress["value"] = 100
                self.lbl_task_title.config(text="🎉 শিক্ষার্থী আপলোড সফল ও সম্পন্ন!", fg="#34D399")
                self.lbl_counter.config(text=f"সফল: {success_count}/{total_users}")
                self.lbl_sub_progress.config(text=f"🎉 সফল! সর্বমোট {success_count} জন শিক্ষার্থীর তথ্য ZKTeco মেশিনে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।")
                self.log(f"🎉 সফল! সর্বমোট {success_count} জন শিক্ষার্থীর তথ্য ZKTeco মেশিনে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।")

                # Non-blocking dialog info
                try:
                    messagebox.showinfo("সফল আপলোড", f"🎉 সফল!\\n\\nসর্বমোট {success_count} জন শিক্ষার্থীর তথ্য ZKTeco মেশিনে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।\\nএখন লাইভ হাজিরা সিঙ্ক স্বয়ংক্রিয়ভাবে চালু হচ্ছে...")
                except Exception:
                    pass

                # -------------------------------------------------------------
                # ধাপ ৫: Auto Live Sync (ব্যাকগ্রাউন্ডে অটো সিঙ্ক শুরু)
                # -------------------------------------------------------------
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

  // Return raw Python Tkinter GUI script if requested
  if (format === 'pyw' || format === 'py') {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DeenoraBiometricManager_${institutionId || 'Setup'}.pyw"`);
    return res.status(200).send(pythonGuiScript);
  }

  // =========================================================================
  // 3. Dependency-Free 1-Click Native Windows Batch/PowerShell Script (.bat)
  //    (Works natively on ANY Windows 7/8/10/11 with zero configuration)
  // =========================================================================
  if (format === 'bat' || format === 'cmd') {
    const batScript = `@echo off
setlocal EnableDelayedExpansion
title Deenora ZKTeco Biometric Sync Manager
chcp 65001 >nul
cls

echo ===================================================================
echo           DEENORA BIOMETRIC SYNC - ZKTECO K40/K14 MANAGER
echo ===================================================================
echo Institution : ${institutionName}
echo Server URL  : ${serverUrl}
echo Default IP  : ${deviceIp}
echo ===================================================================
echo.
echo [*] Checking local environment...

set SCRIPT_DIR=%LOCALAPPDATA%\\DeenoraBiometric
if not exist "%SCRIPT_DIR%" mkdir "%SCRIPT_DIR%"
set PY_FILE=%SCRIPT_DIR%\\DeenoraBiometricManager.pyw

:: Check if python or py is available
where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set RUN_CMD=pythonw
    goto EXTRACT_AND_RUN
)

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set RUN_CMD=python
    goto EXTRACT_AND_RUN
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set RUN_CMD=py
    goto EXTRACT_AND_RUN
)

:: If Python is not installed, download the lightweight official Python embeddable zip in 5s
echo [!] Python was not found in PATH.
echo [*] Setting up portable standalone runtime into %SCRIPT_DIR%...
set PY_ZIP=%SCRIPT_DIR%\\py_embed.zip
set PY_DIR=%SCRIPT_DIR%\\python

if not exist "%PY_DIR%\\python.exe" (
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip', '%PY_ZIP%')"
    powershell -Command "Expand-Archive -Path '%PY_ZIP%' -DestinationPath '%PY_DIR%' -Force"
    del /f /q "%PY_ZIP%" >nul 2>&1
)

if exist "%PY_DIR%\\python.exe" (
    set RUN_CMD="%PY_DIR%\\python.exe"
    goto EXTRACT_AND_RUN
)

echo.
echo [!] Could not initialize runtime automatically.
echo Please install Python from https://www.python.org (Check "Add python.exe to PATH")
pause
exit /b 1

:EXTRACT_AND_RUN
echo [*] Launching Deenora Biometric GUI Application...
powershell -Command "[System.IO.File]::WriteAllBytes('%PY_FILE%', [System.Convert]::FromBase64String('${Buffer.from(pythonGuiScript, 'utf-8').toString('base64')}'))"
start "" %RUN_CMD% "%PY_FILE%"
exit /b 0
`;

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

  // Fallback: If stub is missing, return the standalone GUI script
  res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="DeenoraBiometricManager.pyw"');
  return res.status(200).send(pythonGuiScript);
}
