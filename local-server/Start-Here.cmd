@echo off
setlocal
title ParkSense Local Server
echo ========= ParkSense Launcher =========
echo Working dir: %~dp0
echo Checking PowerShell...

REM 优先使用 PowerShell 7 (pwsh)，否则退回 Windows PowerShell (powershell)
where pwsh >nul 2>&1 && set "PS=pwsh"
if "%PS%"=="" (
  where powershell >nul 2>&1 && set "PS=powershell"
)

if "%PS%"=="" (
  echo Error: PowerShell not found. Please install PowerShell or enable Windows PowerShell.
  echo 打不开? 在此窗口输入:  powershell
  pause
  exit /b 1
)

echo Using: %PS%
echo Starting server...
"%PS%" -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start_server.ps1" -Port 8090

echo.
echo Script finished or exited. Press any key to close.
pause
endlocal