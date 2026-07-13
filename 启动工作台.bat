@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 AI 服装定向设计工作台...
where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
)
pause
