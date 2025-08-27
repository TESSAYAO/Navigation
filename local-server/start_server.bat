@echo off
setlocal
REM 保持窗口打开以查看错误信息
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start_server.ps1" -Port 8090
endlocal