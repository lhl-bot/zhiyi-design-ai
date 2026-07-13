# =====================================================================
#  AI 服装定向设计工作台 — 一键启动脚本
#  作用：释放端口 -> 启动 ERP 只读后端 -> 等待就绪 -> 启动前端 -> 打开浏览器
#  前端固定 http://localhost:5173/ ，后端 http://localhost:8787/
# =====================================================================

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "==== AI 服装定向设计工作台 · 一键启动 ====" -ForegroundColor Cyan

# 1) 释放可能被占用的端口（8787 后端 / 5173 前端），避免端口漂移
function Free-Port([int]$port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      Write-Host "释放端口 $port（结束遗留进程 PID $($c.OwningProcess)）..." -ForegroundColor Yellow
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}
Free-Port 8787
Free-Port 5173
Start-Sleep -Milliseconds 500

# 2) 首次运行自动安装依赖
if (-not (Test-Path ".\node_modules")) {
  Write-Host "首次运行，正在安装依赖（npm install），请稍候..." -ForegroundColor Yellow
  npm install
}

# 3) 启动 ERP 只读后端（新窗口，保持常开）
Write-Host "启动 ERP 只读后端（端口 8787）..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev:api"

# 4) 等待后端就绪（最多 25 秒）
Write-Host "等待后端连接数据库并就绪..." -ForegroundColor Green
$ready = $false
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:8787/api/erp/status" -TimeoutSec 3
    if ($r.ok) { $ready = $true; break }
  } catch { }
}
if ($ready) {
  Write-Host "后端已就绪 ✔（数据库：$($r.database)）" -ForegroundColor Green
} else {
  Write-Host "后端未在 25 秒内就绪，请查看后端窗口日志排查。" -ForegroundColor Yellow
}

# 5) 启动前端（新窗口，固定 5173）
Write-Host "启动前端工作台（端口 5173）..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev"

# 6) 等前端编译后自动打开浏览器
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173/"

Write-Host "" 
Write-Host "==== 启动完成 ====" -ForegroundColor Cyan
Write-Host "前端工作台：http://localhost:5173/" -ForegroundColor Cyan
Write-Host "ERP  后端 ：http://localhost:8787/" -ForegroundColor Cyan
Write-Host "提示：关闭新弹出的两个窗口即可停止服务。" -ForegroundColor Cyan
