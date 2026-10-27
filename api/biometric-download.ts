import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('OK');
    }

    const { query } = req;
    const format = (query.format || query.type || 'bat').toString().toLowerCase();
    const sn = (query.sn || query.device_sn || 'PAS4254900230').toString().trim().toUpperCase();
    const ip = (query.ip || query.machine_ip || '172.31.6.208').toString().trim();
    const port = (query.port || '4370').toString().trim();
    const name = (query.name || query.institution || 'Deenora Madrasah').toString().trim();

    // Dynamically detect server API host (supports dev, preview, or production domain)
    const hostHeader = (req.headers['x-forwarded-host'] || req.headers['host'] || 'deenora.app').toString().split(',')[0].trim();
    const protocol = (req.headers['x-forwarded-proto'] || (hostHeader.includes('localhost') ? 'http' : 'https')).toString().split(',')[0].trim();
    const autoApiUrl = `${protocol}://${hostHeader}/api/iclock`;
    const deenoraApi = (query.api_url || query.apiUrl || autoApiUrl).toString().trim();

    // Generate standalone Python Worker script
    const pyContent = `from zk import ZK
import requests
import time
import sys
from datetime import datetime

MACHINE_IP = '${ip}'
MACHINE_PORT = ${port}
DEVICE_SN = '${sn}'
DEENORA_API = '${deenoraApi}'

print("=" * 64)
print("DEENORA ZKTECO K40 AUTO-SYNC AGENT")
print(f"Device SN  : {DEVICE_SN}")
print(f"Machine IP : {MACHINE_IP}:{MACHINE_PORT}")
print(f"Deenora API: {DEENORA_API}")
print("=" * 64)

def connect_zk():
    try:
        zk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=8, password=0, force_udp=False)
        return zk.connect()
    except Exception:
        zk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=8, password=0, force_udp=True)
        return zk.connect()

synced_records = set()

while True:
    try:
        print(f"[+] Connecting to ZK K40 Machine at {MACHINE_IP}:{MACHINE_PORT}...")
        conn = connect_zk()
        print("[✓] SUCCESSFULLY CONNECTED TO ZK K40 MACHINE!")
        print("[+] Waiting for live punches... (Keep this running in background)")
        
        while True:
            try:
                today_str = datetime.now().strftime('%Y-%m-%d')
                attendances = conn.get_attendance()
                if attendances:
                    today_logs = []
                    for att in attendances:
                        key = f"{att.user_id}_{att.timestamp}"
                        att_time_str = str(att.timestamp)
                        if att_time_str.startswith(today_str) or today_str in att_time_str:
                            if key not in synced_records:
                                today_logs.append({'userId': str(att.user_id), 'checkTime': att_time_str})
                        synced_records.add(key)
                    
                    if today_logs:
                        print(f"\\n[⚡ NEW PUNCH] Found {len(today_logs)} attendance logs. Syncing to Deenora...")
                        res = requests.post(DEENORA_API, json={"sn": DEVICE_SN, "logs": today_logs}, timeout=10)
                        if res.status_code == 200:
                            for log in today_logs:
                                print(f"  ✓ ID: {log['userId']} | Time: {log['checkTime']} -> Synced successfully!")
                        else:
                            print(f"  [!] Server responded with status {res.status_code}")
                time.sleep(1.5)
            except Exception as poll_err:
                print(f"[!] Read Notice: {poll_err}. Reconnecting...")
                break
    except Exception as e:
        print(f"[!] Connection Notice: {e}. Retrying in 5 seconds...")
        time.sleep(5)
`;

    if (format === 'py') {
      res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="deenora_sync_${ip.replace(/\./g, '_')}.py"`);
      return res.status(200).send(pyContent);
    }

    // Base64 encode the Python script to embed safely in the Windows Batch launcher without any character escaping issues
    const base64Py = Buffer.from(pyContent, 'utf-8').toString('base64');

    // 1. Windows 1-Click Executable Batch Launcher (.bat)
    const batContent = `@echo off
title Deenora ZKTeco K40 Auto-Sync Agent (%DEVICE_SN%)
color 0B
chcp 65001 >nul 2>&1
cls

echo ===================================================================
echo               DEENORA ZKTECO K40 1-CLICK SYNC AGENT
echo ===================================================================
echo Institution : ${name}
echo Device SN   : ${sn}
echo Default IP  : ${ip}
echo Port        : ${port}
echo Deenora API : ${deenoraApi}
echo ===================================================================
echo.

set MACHINE_IP=${ip}
set MACHINE_PORT=${port}
set DEVICE_SN=${sn}
set DEENORA_API=${deenoraApi}

echo [1/3] K40 মেশিন আইপি সেটিংস:
echo বর্তমান ডিফল্ট আইপি: %MACHINE_IP%
echo যদি K40 মেশিনে ভিন্ন আইপি থাকে, নিচে তা লিখুন (যেমন 172.31.6.208 বা 192.168.0.201)
echo (ডিফল্ট আইপি ব্যবহার করতে সরাসরি কিবোর্ডের Enter চাপুন)
set /p USER_IP="মেশিন IP অ্যাড্রেস [%MACHINE_IP%]: "
if not "%USER_IP%"=="" set MACHINE_IP=%USER_IP%

echo.
echo [✓] নির্বাচিত মেশিন আইপি: %MACHINE_IP%:%MACHINE_PORT%
echo.

:CHECK_PYTHON
echo [2/3] Checking Python installation on Windows...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [!] আপনার পিসিতে Python ইনস্টল পাওয়া যায়নি।
    echo.
    echo স্বয়ংক্রিয়ভাবে ১-ক্লিকে Python ইনস্টল করতে চান?
    set /p AUTO_PY="Python ইনস্টল করবেন? (Y/N) [ডিফল্ট Y]: "
    if "%AUTO_PY%"=="" set AUTO_PY=Y
    if /i "%AUTO_PY%"=="Y" (
        echo.
        echo [+] Python ইনস্টলার ডাউনলোড হচ্ছে (অনুগ্রহ করে অপেক্ষা করুন)...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe', 'python_setup.exe')"
        if exist python_setup.exe (
            echo [+] Python ইনস্টল হচ্ছে...
            start /wait python_setup.exe /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1
            del python_setup.exe >nul 2>&1
            echo [✓] Python ইনস্টলেশন সম্পন্ন হয়েছে!
            timeout /t 3 >nul
            goto CHECK_PYTHON
        ) else (
            echo [!] ডাউনলোড ব্যর্থ হয়েছে। ম্যানুয়ালি ইনস্টল করুন: https://www.python.org/downloads/
            pause
            exit /b 1
        )
    ) else (
        echo [!] Python ছাড়া K40 মেশিন সিঙ্ক চালানো সম্ভব নয়।
        pause
        exit /b 1
    )
)

echo [✓] Python পাওয়া গেছে! প্রয়োজনীয় লাইব্রেরি (zk, requests) চেক করা হচ্ছে...
pip install zk requests --quiet >nul 2>&1

echo [3/3] লোকাল নেটওয়ার্কে মেশিন টেস্ট করা হচ্ছে...
ping -n 1 -w 1500 %MACHINE_IP% >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] সতর্কতা: পিসি থেকে K40 মেশিনের আইপি %MACHINE_IP% এ পিং রেসপন্স আসেনি।
    echo     অনুগ্রহ করে নিশ্চিত করুন K40 মেশিনটি চালু এবং পিসির সাথে একই রাউটারে যুক্ত।
) else (
    echo [✓] K40 মেশিনের নেটওয়ার্ক পিং সফল!
)

rem Extract standalone python script safely from Base64
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('deenora_sync_worker.py', [System.Convert]::FromBase64String('${base64Py}'))"

python deenora_sync_worker.py

echo.
echo ===================================================================
echo এজেন্ট প্রসেস সমাপ্ত হয়েছে। উইন্ডো বন্ধ করতে যেকোনো কী চাপুন...
echo ===================================================================
pause
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Deenora-K40-Sync-${ip.replace(/\./g, '_')}.bat"`);
    return res.status(200).send(batContent);

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
