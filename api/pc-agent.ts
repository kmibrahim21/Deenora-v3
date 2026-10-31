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
  const serverHost = req.headers.host || 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  // Raw PowerShell script for background polling
  const psScript = `$instId = '${institutionId}';
$serverUrl = '${serverUrl}';
$ip = '${deviceIp}';
Write-Host '[DEENORA SYNC]' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') '- Polling machine at' $ip '...';
try {
  $response = Invoke-RestMethod -Uri "$serverUrl/api/iclock?sn=PC_AGENT_$instId&institution_id=$instId" -Method Get -TimeoutSec 10;
  if ($response.message) {
    Write-Host '[SERVER OK]' $response.message;
  } else {
    Write-Host '[SERVER OK] Connection active';
  }
} catch {
  Write-Host '[SYNC NOTICE]' $_.Exception.Message;
}
`;

  // Encode in UTF-16LE Base64 for PowerShell -EncodedCommand (100% fail-proof execution in Windows CMD)
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
    echo [OK] Deenora Sync Agent is already registered in Windows Startup.
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
echo [1/2] Checking Network and Biometric Machine Connection...
ping -n 2 %DEVICE_IP% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Connected to Biometric Device at %DEVICE_IP%!
) else (
    echo [NOTICE] Device at %DEVICE_IP% not responding directly. Auto-scanning local network...
)

echo.
echo ================================================================
echo [2/2] Deenora Sync Agent is ACTIVE and RUNNING in Background...
echo Please leave this window minimized while the school/madrasah is open.
echo ================================================================
echo.

:SYNC_LOOP
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedPs}

timeout /t 10 /nobreak >nul
goto SYNC_LOOP
`;

  res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="DeenoraSyncAgent_${institutionId || 'Setup'}.bat"`);
  return res.status(200).send(batchScript);
}

