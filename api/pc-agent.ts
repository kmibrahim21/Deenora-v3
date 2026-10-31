import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const institutionId = (query.institution_id || query.institutionId || query.inst || '').toString().trim();
  const deviceIp = (query.device_ip || query.deviceIp || '192.168.1.201').toString().trim();
  const format = (query.format || 'bat').toString().trim().toLowerCase();
  
  const serverHost = req.headers.host || 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  // Dedicated Python Sync Script for ZKTeco K40/K14 (Non-ADMS local network devices)
  const pythonScript = `import time
import sys
import os

try:
    import requests
except ImportError:
    os.system("pip install requests --quiet")
    import requests

try:
    from zk import ZK
except ImportError:
    os.system("pip install pyzk --quiet")
    from zk import ZK

DEVICE_IP = "${deviceIp}"
DEVICE_PORT = 4370
INSTITUTION_ID = "${institutionId}"
SERVER_URL = "${serverUrl}"

print("================================================================")
print("   Deenora SaaS ZKTeco Biometric Machine Local Sync Engine")
print("================================================================")
print(f" Institution ID : {INSTITUTION_ID if INSTITUTION_ID else 'GLOBAL'}")
print(f" Target Device  : {DEVICE_IP}:{DEVICE_PORT}")
print(f" Server URL     : {SERVER_URL}")
print("================================================================")
print("\\n[1/2] Connecting to local ZKTeco machine at " + DEVICE_IP + "...")

while True:
    try:
        zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5)
        conn = zk.connect()
        print(f"\\n[SUCCESS] Connected to ZKTeco machine at {DEVICE_IP}:{DEVICE_PORT}!")
        
        while True:
            attendances = conn.get_attendance()
            if attendances:
                logs = []
                for att in attendances:
                    logs.append({
                        "userId": str(att.user_id),
                        "checkTime": str(att.timestamp)
                    })
                
                payload = {
                    "institution_id": INSTITUTION_ID,
                    "sn": f"PC_AGENT_{INSTITUTION_ID}",
                    "logs": logs
                }
                
                try:
                    res = requests.post(f"{SERVER_URL}/api/iclock", json=payload, timeout=10)
                    if res.status_code == 200:
                        data = res.json()
                        msg = data.get('message', 'Punches synced') if isinstance(data, dict) else 'OK'
                        print(f"[DEENORA SYNC OK] Uploaded {len(logs)} punch records to server -> {msg}")
                    else:
                        print(f"[SERVER WARN] Status Code {res.status_code}")
                except Exception as http_err:
                    print(f"[SERVER SYNC ERROR] Failed to send to Deenora: {http_err}")
            else:
                print(f"[POLL] Checked {DEVICE_IP} -> No new un-synced punches yet.")
            
            time.sleep(5)

    except Exception as err:
        print(f"[NOTICE] Waiting for machine at {DEVICE_IP}:{DEVICE_PORT} ({err}). Retrying in 5s...")
        time.sleep(5)
`;

  if (format === 'py') {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deenora_sync_${institutionId || 'Setup'}.py"`);
    return res.status(200).send(pythonScript);
  }

  // Raw PowerShell script for checking server readiness
  const psScript = `$instId = '${institutionId}';
$serverUrl = '${serverUrl}';
$ip = '${deviceIp}';
try {
  $response = Invoke-RestMethod -Uri "$serverUrl/api/iclock?sn=PC_AGENT_$instId&institution_id=$instId" -Method Get -TimeoutSec 10;
  Write-Host '[DEENORA SERVER READINESS OK]' $response.message;
} catch {
  Write-Host '[DEENORA SERVER NOTICE]' $_.Exception.Message;
}
`;
  const encodedPs = Buffer.from(psScript, 'utf16le').toString('base64');

  // Generate self-contained Windows One-Click Installer (.bat) script
  const batchScript = `@echo off
title Deenora Biometric Sync Agent (One-Click Windows Service)
color 0A
cls

echo ================================================================
echo    Deenora SaaS Biometric Attendance Sync Agent for Windows
echo ================================================================
echo Institution ID : ${institutionId || 'GLOBAL'}
echo Server Target  : ${serverUrl}
echo Default Device : ${deviceIp}
echo ================================================================
echo.

set INSTITUTION_ID=${institutionId}
set SERVER_URL=${serverUrl}
set DEVICE_IP=${deviceIp}

:: Auto-add to Windows Startup folder for seamless background operation
set STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
set SCRIPT_PATH=%~f0

if exist "%STARTUP_DIR%\\DeenoraSyncAgent.bat" (
    echo [OK] Deenora Sync Agent is registered in Windows Startup.
) else (
    echo [INFO] Registering Deenora Sync Agent to auto-run on Windows startup...
    copy "%SCRIPT_PATH%" "%STARTUP_DIR%\\DeenoraSyncAgent.bat" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Auto-run on Startup registered successfully!
    ) else (
        echo [INFO] Running in session mode.
    )
)

echo.
echo [1/3] Checking Deenora Cloud Server Readiness...
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedPs}

echo.
echo [2/3] Checking Network Connection to Biometric Device at %DEVICE_IP%...
ping -n 2 %DEVICE_IP% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Connected to Biometric Device on Local Network at %DEVICE_IP%!
) else (
    echo [NOTICE] Device at %DEVICE_IP% not responding to ping. Auto-retrying connection...
)

echo.
echo ================================================================
echo [3/3] Starting Local ZKTeco Machine Punch Fetcher Engine...
echo Please leave this window minimized while the school/madrasah is open.
echo ================================================================
echo.

:: Auto-create Python script locally
(
echo import time, sys, os
echo try:
echo     import requests
echo except ImportError:
echo     os.system("pip install requests --quiet"^)
echo     import requests
echo try:
echo     from zk import ZK
echo except ImportError:
echo     os.system("pip install pyzk --quiet"^)
echo     from zk import ZK
echo DEVICE_IP = "%DEVICE_IP%"
echo DEVICE_PORT = 4370
echo INSTITUTION_ID = "%INSTITUTION_ID%"
echo SERVER_URL = "%SERVER_URL%"
echo print("[1/2] Connecting to local ZKTeco machine at " + DEVICE_IP + "..."^)
echo while True:
echo     try:
echo         zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5^)
echo         conn = zk.connect(^)
echo         print("[SUCCESS] Connected to ZKTeco machine at " + DEVICE_IP + "!"^)
echo         while True:
echo             attendances = conn.get_attendance(^)
echo             if attendances:
echo                 logs = [{"userId": str(att.user_id^), "checkTime": str(att.timestamp^)} for att in attendances]
echo                 payload = {"institution_id": INSTITUTION_ID, "sn": "PC_AGENT_" + INSTITUTION_ID, "logs": logs}
echo                 try:
echo                     res = requests.post(SERVER_URL + "/api/iclock", json=payload, timeout=10^)
echo                     if res.status_code == 200:
echo                         data = res.json(^)
echo                         msg = data.get('message', 'Punches synced'^) if isinstance(data, dict^) else 'OK'
echo                         print("[DEENORA SYNC OK] Uploaded " + str(len(logs^)^) + " punch records -> " + str(msg^)^)
echo                     else:
echo                         print("[SERVER WARN] Status Code " + str(res.status_code^)^)
echo                 except Exception as http_err:
echo                     print("[SERVER ERROR] " + str(http_err^)^)
echo             else:
echo                 print("[POLL] Checked " + DEVICE_IP + " -> No new un-synced punches."^)
echo             time.sleep(5^)
echo     except Exception as err:
echo         print("[NOTICE] Retrying machine connection at " + DEVICE_IP + " (" + str(err^) + ")..."^)
echo         time.sleep(5^)
) > deenora_zk_sync.py

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python Engine Detected! Starting ZKTeco Local Machine Sync...
    python deenora_zk_sync.py
) else (
    echo [NOTICE] Python is not installed on this PC.
    echo [INSTRUCTION] Please install Python from https://www.python.org or run 'winget install Python.Python.3.11'
    echo Retrying in 10 seconds...
    timeout /t 10 /nobreak >nul
    goto SYNC_LOOP
)

:SYNC_LOOP
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python deenora_zk_sync.py
)
timeout /t 10 /nobreak >nul
goto SYNC_LOOP
`;

  res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="DeenoraSyncAgent_${institutionId || 'Setup'}.bat"`);
  return res.status(200).send(batchScript);
}
