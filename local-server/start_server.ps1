[CmdletBinding()]
param([int]$Port = 8090)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $Root "server"
$CaddyExe = Join-Path $ServerDir "caddy.exe"
$CaddyZip = Join-Path $ServerDir "caddy.zip"

New-Item -ItemType Directory -Force -Path $ServerDir | Out-Null

function Get-LanIPs {
  try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notmatch "^169\." } |
      Select-Object -ExpandProperty IPAddress -Unique
    if (-not $ips -or $ips.Count -eq 0) {
      $ips = @((ipconfig | Select-String "IPv4").ToString().Split(':')[-1].Trim())
    }
    return $ips | Where-Object { $_ -and $_ -ne "" }
  } catch { return @() }
}

function Show-Links {
  param([int]$Port)
  $localUrl = "http://localhost:{0}/materials/parksense-web-debug-clean.html" -f $Port
  Start-Process $localUrl
  Write-Host ""
  Write-Host "Open this link on this PC:" -ForegroundColor Green
  Write-Host "  $localUrl"
  $lanIps = Get-LanIPs
  if ($lanIps.Count -gt 0) {
    Write-Host "Open on other devices in the same LAN:" -ForegroundColor Green
    foreach ($ip in $lanIps) {
      Write-Host ("  http://{0}:{1}/materials/parksense-web-debug-clean.html" -f $ip, $Port)
    }
  } else {
    Write-Host "Tip: Could not detect LAN IP automatically. Run 'ipconfig' and use your IPv4." -ForegroundColor Yellow
  }
  Write-Host ""
}

function Start-Caddy {
  param([int]$Port)
  try {
    if (-not (Test-Path $CaddyExe)) {
      Write-Host "Downloading Caddy web server..." -ForegroundColor Cyan
      $url = "https://caddyserver.com/api/download?os=windows&arch=amd64&id=caddy"
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $CaddyZip
      Expand-Archive -Path $CaddyZip -DestinationPath $ServerDir -Force
      $exe = Get-ChildItem -Path $ServerDir -Recurse -Filter "caddy.exe" | Select-Object -First 1
      if ($exe) { Copy-Item $exe.FullName $CaddyExe -Force }
      if (Test-Path $CaddyZip) { Remove-Item $CaddyZip -Force -ErrorAction SilentlyContinue }
      if (Test-Path $CaddyExe) { Unblock-File -Path $CaddyExe -ErrorAction SilentlyContinue }
    }
    if (-not (Test-Path $CaddyExe)) {
      Write-Host "Caddy not available (download failed)." -ForegroundColor Yellow
      return $null
    }
    Write-Host "Starting Caddy..." -ForegroundColor Cyan
    $proc = Start-Process -FilePath $CaddyExe -ArgumentList @("file-server","--root","$Root","--listen",":$Port") -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 1
    if ($proc -and ($proc -is [System.Diagnostics.Process]) -and -not $proc.HasExited -and $proc.Id) {
      return $proc
    } else {
      Write-Host "Caddy started but exited immediately." -ForegroundColor Yellow
      return $null
    }
  } catch {
    Write-Host "Caddy start failed: $($_.Exception.Message)" -ForegroundColor Yellow
    return $null
  }
}

function Start-DotNetServer {
  param([int]$Port)
  Write-Host "Falling back to built-in static server (local only)..." -ForegroundColor Yellow
  try { Add-Type -AssemblyName System.Net.HttpListener } catch {}
  $listener = New-Object System.Net.HttpListener
  # 本机访问（无需管理员权限）；局域网请使用 Caddy
  $listener.Prefixes.Add("http://localhost:$Port/")
  try {
    $listener.Start()
  } catch {
    Write-Host "Failed to start built-in server: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
  }

  Write-Host "Built-in server started on http://localhost:$Port/" -ForegroundColor Cyan
  Show-Links -Port $Port
  Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

  $mime = @{
    ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
    ".css"="text/css"; ".js"="application/javascript"; ".json"="application/json"
    ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
    ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".txt"="text/plain"; ".map"="application/json"
  }

  while ($true) {
    $ctx = $listener.GetContext()
    try {
      $raw = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($raw -eq "/") { $raw = "/materials/parksense-web-debug-clean.html" }
      $rel = $raw.TrimStart("/")
      $reqPath = Join-Path $Root $rel

      # 兼容 PS5：不用 ?.Path
      $rp = $null
      try { $rp = Resolve-Path -LiteralPath $reqPath -ErrorAction SilentlyContinue } catch {}
      if ($rp) { $reqFull = $rp.Path } else { $reqFull = $null }

      if (-not $reqFull) {
        $ctx.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
        $ctx.Response.Close()
        continue
      }
      if (-not $reqFull.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        $ctx.Response.StatusCode = 403
        $bytes = [Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
        $ctx.Response.Close()
        continue
      }
      $ext = [IO.Path]::GetExtension($reqFull).ToLower()
      $ctx.Response.ContentType = $mime[$ext]
      if (-not $ctx.Response.ContentType) { $ctx.Response.ContentType = "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($reqFull)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
      $ctx.Response.Close()
    } catch {
      try {
        $ctx.Response.StatusCode = 500
        $msg = [Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
        $ctx.Response.OutputStream.Write($msg,0,$msg.Length)
        $ctx.Response.Close()
      } catch {}
    }
  }
}

Write-Host "Site root: $Root" -ForegroundColor DarkCyan
$proc = Start-Caddy -Port $Port

# 更严格的进程判定，失败则回退
if ($proc -is [System.Diagnostics.Process] -and -not $proc.HasExited -and $proc.Id) {
  Show-Links -Port $Port
  Write-Host ("Caddy is running (PID={0}). Close the Caddy window to stop." -f $proc.Id) -ForegroundColor Yellow
  try { Wait-Process -Id $proc.Id } catch { Start-DotNetServer -Port $Port }
} else {
  Start-DotNetServer -Port $Port
}