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
  const deviceIp = (query.device_ip || query.deviceIp || '192.168.0.201').toString().trim();
  const format = (query.format || 'bat').toString().trim().toLowerCase();
  
  const serverHost = req.headers.host || 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  // Dedicated Python Sync Script for ZKTeco K40/K14 (Non-ADMS local network devices)
  // Supports dual-subnet auto-detection (both 192.168.0.x and 192.168.1.x)
  const pythonScript = `import time
import sys
import os

try:
    import requests
except ImportError:
    print("[INFO] Installing requests library...")
    os.system("pip install requests --quiet")
    import requests

try:
    from zk import ZK
except ImportError:
    print("[INFO] Installing pyzk library...")
    os.system("pip install pyzk --quiet")
    from zk import ZK

PRIMARY_IP = "${deviceIp}"
DEVICE_PORT = 4370
INSTITUTION_ID = "${institutionId}"
SERVER_URL = "${serverUrl}"

# Construct smart fallback candidate list for both 192.168.0.x and 192.168.1.x subnets
CANDIDATE_IPS = [PRIMARY_IP]
if PRIMARY_IP.startswith("192.168.0."):
    alt = PRIMARY_IP.replace("192.168.0.", "192.168.1.")
    if alt not in CANDIDATE_IPS: CANDIDATE_IPS.append(alt)
elif PRIMARY_IP.startswith("192.168.1."):
    alt = PRIMARY_IP.replace("192.168.1.", "192.168.0.")
    if alt not in CANDIDATE_IPS: CANDIDATE_IPS.append(alt)

for default_ip in ["192.168.0.201", "192.168.1.201", "192.168.0.202", "192.168.1.202", "192.168.0.100", "192.168.1.100"]:
    if default_ip not in CANDIDATE_IPS:
        CANDIDATE_IPS.append(default_ip)

print("================================================================")
print("   Deenora SaaS ZKTeco Biometric Machine Local Sync Engine")
print("================================================================")
print(f" Institution ID : {INSTITUTION_ID if INSTITUTION_ID else 'GLOBAL'}")
print(f" Target IP      : {PRIMARY_IP}:{DEVICE_PORT}")
print(f" Auto-Scan IPs  : {', '.join(CANDIDATE_IPS)}")
print(f" Server URL     : {SERVER_URL}")
print("================================================================")

while True:
    connected_ip = None
    conn = None

    for target_ip in CANDIDATE_IPS:
        try:
            print(f"[SCAN] Checking ZKTeco device at {target_ip}:{DEVICE_PORT}...")
            zk = ZK(target_ip, port=DEVICE_PORT, timeout=3)
            conn = zk.connect()
            connected_ip = target_ip
            print(f"\\n[SUCCESS] Connected to ZKTeco machine on local network at {target_ip}:{DEVICE_PORT}!")
            break
        except Exception as e:
            continue

    if not connected_ip or not conn:
        print(f"[NOTICE] Could not connect to ZKTeco device on candidate IPs: {CANDIDATE_IPS}.")
        print("         Please check Wi-Fi/Ethernet cable or machine power. Retrying in 5s...")
        time.sleep(5)
        continue

    # Active sync loop once connected
    try:
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
                    res = requests.post(f"{SERVER_URL}/api/iclock", json=payload, timeout=(10, 30))
                    if res.status_code == 200:
                        data = res.json()
                        msg = data.get('message', 'Punches synced') if isinstance(data, dict) else 'OK'
                        print(f"[DEENORA SYNC OK] Uploaded {len(logs)} punch records to server -> {msg}")
                    else:
                        print(f"[SERVER WARN] Status Code {res.status_code}")
                except requests.exceptions.Timeout:
                    print(f"[SERVER TIMEOUT] Server response timed out (>30s). Will retry on next cycle...")
                except Exception as http_err:
                    print(f"[SERVER SYNC ERROR] Failed to send to Deenora: {http_err}")
            else:
                print(f"[POLL] Checked {connected_ip} -> No new un-synced punches yet.")
            
            time.sleep(5)

    except Exception as run_err:
        print(f"[NOTICE] Device connection interrupted at {connected_ip} ({run_err}). Auto-reconnecting in 5s...")
        try:
            conn.disconnect()
        except:
            pass
        time.sleep(5)
`;

  if (format === 'py') {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deenora_sync_${institutionId || 'Setup'}.py"`);
    return res.status(200).send(pythonScript);
  }

  // Base64 encode the Python script to write seamlessly to %TEMP% without permission errors
  const encodedPy = Buffer.from(pythonScript, 'utf-8').toString('base64');

  if (format === 'vbs') {
    const vbsScript = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

startupFolder = WshShell.SpecialFolders("Startup")
tempFolder = fso.GetSpecialFolder(2)
targetPy = tempFolder & "\\deenora_zk_sync_${institutionId || 'GLOBAL'}.py"
encodedPy = "${encodedPy}"

cmdDecode = "powershell -NoProfile -ExecutionPolicy Bypass -Command ""[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('" & encodedPy & "')) | Out-File -FilePath '" & targetPy & "' -Encoding utf8"""
WshShell.Run cmdDecode, 0, True

vbsStartup = startupFolder & "\\DeenoraSyncSilent.vbs"
Set vbsFile = fso.CreateTextFile(vbsStartup, True)
vbsFile.WriteLine "Set WshShell = CreateObject(""WScript.Shell"")"
vbsFile.WriteLine "WshShell.Run ""cmd /c python """"" & targetPy & """"" >nul 2>&1"", 0, False"
vbsFile.Close

WshShell.Run "cmd /c python """ & targetPy & """ >nul 2>&1 || py """ & targetPy & """ >nul 2>&1", 0, False

MsgBox "Deenora Biometric Attendance Agent is now running continuously in the background!" & vbCrLf & vbCrLf & "ডিইনোরা বায়োমেট্রিক হাজিরা এজেন্ট এখন ব্যাকগ্রাউন্ডে সফলভাবে চালু হয়েছে।" & vbCrLf & "পিসি বন্ধ করে চালু করলেও এটি ব্যাকগ্রাউন্ডে অটোমেটিক চলবে।", 64, "Deenora Sync Agent Started"
`;
    res.setHeader('Content-Type', 'application/x-vbs; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DeenoraSyncSilent_${institutionId || 'Setup'}.vbs"`);
    return res.status(200).send(vbsScript);
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

  // Generate self-contained Windows One-Click Installer (.bat) script with AUTOMATIC BACKGROUND SILENT LAUNCH
  const batchScript = `@echo off
title Deenora Biometric Sync Agent (Background Service)

if "%~1"=="-silent" goto SILENT_SYNC_EXEC
if "%~1"=="-visible" goto STARTED_ALIVE

:: Default Double Click Behavior: Register Startup, Launch in Background, and Exit CMD immediately
cd /d "%~dp0"
set INSTITUTION_ID=${institutionId}
set SERVER_URL=${serverUrl}
set DEVICE_IP=${deviceIp}
set SCRIPT_PATH=%~f0
set LAUNCH_VBS=%TEMP%\\run_deenora_hidden_%INSTITUTION_ID%.vbs

set STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%" >nul 2>&1

:: Register silent launcher in Windows Startup folder for automatic boot sync
(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo WshShell.Run """%SCRIPT_PATH%"" -silent", 0, False
) > "%STARTUP_DIR%\\DeenoraSyncSilent.vbs" 2>nul

:: Launch hidden background process and display confirmation dialog
(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo WshShell.Run """%SCRIPT_PATH%"" -silent", 0, False
    echo MsgBox "Deenora Biometric Attendance Agent is now running continuously in the background!" ^& vbCrLf ^& vbCrLf ^& "ডিইনোরা বায়োমেট্রিক হাজিরা এজেন্ট এখন ব্যাকগ্রাউন্ডে সফলভাবে চালু হয়েছে। পিসি বন্ধ করে অন করলেও এটি ব্যাকগ্রাউন্ডে অটোমেটিক চলবে।", 64, "Deenora Sync Agent Started"
) > "%LAUNCH_VBS%"

start wscript "%LAUNCH_VBS%"
exit /b

:STARTED_ALIVE
cls

:: Ensure current working directory is the script folder
cd /d "%~dp0"

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
set TARGET_PY_FILE=%TEMP%\\deenora_zk_sync_%INSTITUTION_ID%.py

echo.
echo [1/3] Checking Deenora Cloud Server Readiness...
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedPs}

echo.
echo [2/3] Checking Network Connection to Biometric Device...
ping -n 2 %DEVICE_IP% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Connected to Biometric Device on Local Network at %DEVICE_IP%!
) else (
    echo [NOTICE] Primary IP %DEVICE_IP% not responding directly. Auto-scanning candidate IPs on local subnets...
)

echo.
echo ================================================================
echo [3/3] Preparing Local ZKTeco Machine Punch Fetcher Engine...
echo ================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPy}')) | Out-File -FilePath '%TARGET_PY_FILE%' -Encoding utf8"

:START_SYNC
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python Engine Detected! Starting ZKTeco Local Machine Sync...
    python "%TARGET_PY_FILE%"
    echo.
    echo [WARNING] Sync process paused. Restarting in 5 seconds...
    timeout /t 5 /nobreak >nul
    goto START_SYNC
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python Launcher py Detected! Starting ZKTeco Local Machine Sync...
    py "%TARGET_PY_FILE%"
    echo.
    echo [WARNING] Sync process paused. Restarting in 5 seconds...
    timeout /t 5 /nobreak >nul
    goto START_SYNC
)

echo.
echo ================================================================
echo [AUTO-SETUP] Python Environment Missing. Installing Automatically...
echo ================================================================
echo.

where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 goto INSTALL_WINGET
goto INSTALL_POWERSHELL

:INSTALL_WINGET
echo [AUTO-INSTALL] Installing Python 3.11 via Windows Package Manager...
winget install --id Python.Python.3.11 --exact --silent --accept-package-agreements --accept-source-agreements
goto RUN_INSTALL_CHECK

:INSTALL_POWERSHELL
echo [AUTO-INSTALL] Downloading Official Python Silent Installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$web = New-Object System.Net.WebClient; $web.DownloadFile('https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe', '$env:TEMP\\py_setup.exe'); Start-Process '$env:TEMP\\py_setup.exe' -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1' -Wait"

:RUN_INSTALL_CHECK
set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Python Environment Installed Automatically!
    python "%TARGET_PY_FILE%"
    goto START_SYNC
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Python Environment Installed Automatically!
    py "%TARGET_PY_FILE%"
    goto START_SYNC
)

echo [NOTICE] Retrying sync engine in 5 seconds...
timeout /t 5 /nobreak >nul
goto START_SYNC

:SILENT_SYNC_EXEC
cd /d "%~dp0"
set INSTITUTION_ID=${institutionId}
set SERVER_URL=${serverUrl}
set DEVICE_IP=${deviceIp}
set TARGET_PY_FILE=%TEMP%\\deenora_zk_sync_%INSTITUTION_ID%.py

powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPy}')) | Out-File -FilePath '%TARGET_PY_FILE%' -Encoding utf8" >nul 2>&1

:SILENT_LOOP
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python "%TARGET_PY_FILE%" >nul 2>&1
    timeout /t 5 /nobreak >nul
    goto SILENT_LOOP
)
where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    py "%TARGET_PY_FILE%" >nul 2>&1
    timeout /t 5 /nobreak >nul
    goto SILENT_LOOP
)

:: Auto install python silently in background if missing
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    winget install --id Python.Python.3.11 --exact --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$web = New-Object System.Net.WebClient; $web.DownloadFile('https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe', '$env:TEMP\\py_setup.exe'); Start-Process '$env:TEMP\\py_setup.exe' -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1' -Wait" >nul 2>&1
)

set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
timeout /t 5 /nobreak >nul
goto SILENT_LOOP
`;

  res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="DeenoraSyncAgent_${institutionId || 'Setup'}.bat"`);
  return res.status(200).send(batchScript);
}
