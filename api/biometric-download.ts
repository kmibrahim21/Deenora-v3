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
    const isPreviewHost = hostHeader.includes('run.app') || hostHeader.includes('localhost') || hostHeader.includes('aistudio');
    const autoApiUrl = isPreviewHost ? 'https://deenora.app/api/iclock' : `https://${hostHeader}/api/iclock`;
    const deenoraApi = (query.api_url || query.apiUrl || autoApiUrl).toString().trim();

    // Generate standalone Python Worker script
    const pyContent = `import sys
import time
from datetime import datetime

# Read arguments passed from batch launcher or fallback to defaults
MACHINE_IP = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else '${ip}'
MACHINE_PORT = int(sys.argv[2].strip()) if len(sys.argv) > 2 and sys.argv[2].strip() else ${port}
DEVICE_SN = sys.argv[3].strip() if len(sys.argv) > 3 and sys.argv[3].strip() else '${sn}'
DEENORA_API = sys.argv[4].strip() if len(sys.argv) > 4 and sys.argv[4].strip() else '${deenoraApi}'

print("=" * 64)
print("DEENORA ZKTECO K40 AUTO-SYNC AGENT")
print(f"Device SN  : {DEVICE_SN}")
print(f"Machine IP : {MACHINE_IP}:{MACHINE_PORT}")
print(f"Server API : {DEENORA_API}")
print("=" * 64)

# Ensure dependencies exist
try:
    from zk import ZK
except ImportError:
    print("[!] Installing pyzk library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk", "requests"])
    from zk import ZK

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

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
        print(f"[+] Connecting to ZKTeco K40 at {MACHINE_IP}:{MACHINE_PORT}...")
        conn = connect_zk()
        print("[OK] SUCCESSFULLY CONNECTED TO ZKTECO K40 MACHINE!")
        print("[+] Live Punch Listening Active. (Keep this window open in background)")
        
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
                        print(f"\\n[NEW PUNCH] Detected {len(today_logs)} attendance logs. Syncing to Deenora...")
                        res = requests.post(DEENORA_API, json={"sn": DEVICE_SN, "logs": today_logs}, timeout=10)
                        if res.status_code == 200:
                            for log in today_logs:
                                print(f"  [OK] Biometric ID: {log['userId']} | Time: {log['checkTime']} -> Synced!")
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

    // Base64 encode the Python script to embed safely in the Windows Batch launcher
    const base64Py = Buffer.from(pyContent, 'utf-8').toString('base64');

    // 1. Windows 1-Click Executable Batch Launcher (.bat)
    // NOTE: Windows CMD does not support UTF-8 multibyte characters (Bengali) or unescaped nested parentheses in scripts.
    // We use pure standard ASCII with clean labels and goto jumps for 100% reliability on all Windows versions.
    const batContent = `@echo off
setlocal EnableDelayedExpansion
title Deenora ZKTeco K40 Auto-Sync Agent
color 0B
cls

echo ===================================================================
echo               DEENORA ZKTECO K40 1-CLICK SYNC AGENT
echo ===================================================================
echo Institution  : ${name}
echo Device SN    : ${sn}
echo Default IP   : ${ip}
echo Port         : ${port}
echo Deenora API  : ${deenoraApi}
echo ===================================================================
echo.

set MACHINE_IP=${ip}
set MACHINE_PORT=${port}
set DEVICE_SN=${sn}
set DEENORA_API=${deenoraApi}

echo [1/3] K40 Machine IP Configuration
echo Default IP is: !MACHINE_IP!
echo (Press ENTER to keep !MACHINE_IP!, or type custom IP e.g. 192.168.1.201)
set /p USER_INPUT="Machine IP [!MACHINE_IP!]: "
if not "!USER_INPUT!"=="" set MACHINE_IP=!USER_INPUT!

echo.
echo [*] Target Machine: !MACHINE_IP!:!MACHINE_PORT!
echo.

:CHECK_PYTHON
echo [2/3] Checking Python on Windows...
set PY_CMD=
python --version >nul 2>&1
if !errorlevel! equ 0 (
    set PY_CMD=python
    goto PYTHON_READY
)
py --version >nul 2>&1
if !errorlevel! equ 0 (
    set PY_CMD=py
    goto PYTHON_READY
)

echo [!] Python is not installed on this PC.
echo.
set /p DO_INSTALL="Would you like to install Python 3.11 automatically? [Y/n]: "
if "!DO_INSTALL!"=="" set DO_INSTALL=Y
if /i not "!DO_INSTALL!"=="Y" goto NO_PYTHON

echo [+] Downloading official Python 3.11 installer... Please wait...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe', 'python_setup.exe')"

if not exist python_setup.exe goto DOWNLOAD_FAIL

echo [+] Installing Python quietly (adding to PATH)... Please wait 1 minute...
start /wait python_setup.exe /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_launcher=1
del /f /q python_setup.exe >nul 2>&1
echo [OK] Python installer completed!
timeout /t 3 >nul
goto CHECK_PYTHON

:DOWNLOAD_FAIL
echo [!] Automatic download failed.
echo Please manually download and install Python from: https://www.python.org/downloads/
echo Note: Make sure to check the box 'Add python.exe to PATH' during installation!
pause
exit /b 1

:NO_PYTHON
echo [!] Python is required to communicate with ZKTeco K40 biometric machine.
pause
exit /b 1

:PYTHON_READY
echo [OK] Python detected: !PY_CMD!
echo [+] Checking required libraries (pyzk, requests)...
!PY_CMD! -m pip install pyzk requests --quiet >nul 2>&1

echo [3/3] Testing local network ping to K40 machine at !MACHINE_IP!...
ping -n 1 -w 1500 !MACHINE_IP! >nul 2>&1
if !errorlevel! neq 0 (
    echo [!] WARNING: Ping to !MACHINE_IP! timed out.
    echo     Please make sure K40 machine is powered ON and on same router.
) else (
    echo [OK] K40 Machine ping response received!
)
echo.

rem Extract Python sync worker from embedded Base64
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('deenora_sync_worker.py', [System.Convert]::FromBase64String('${base64Py}'))"

echo ===================================================================
echo Starting Live Attendance Synchronization...
echo (Keep this window open in background during madrasah/school)
echo ===================================================================
echo.

!PY_CMD! deenora_sync_worker.py "!MACHINE_IP!" "!MACHINE_PORT!" "!DEVICE_SN!" "!DEENORA_API!"

echo.
echo ===================================================================
echo Sync Agent terminated. Press any key to exit...
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
