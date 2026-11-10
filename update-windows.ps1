# 起動のたびに GitHub の最新版を確認し、新しければ自動で更新する（start-windows.bat から呼ばれる）。
# 合言葉（.local-token）、Claude Code の場所（.claude-path）、部品（node_modules）は残す。
$ErrorActionPreference = "Stop"
$App = $PSScriptRoot
$Repo = "dxdimix/nencho-helper"
$VerFile = Join-Path $App ".version"

try {
  $sha = (Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/main" -Headers @{ "User-Agent" = "nencho-helper" } -TimeoutSec 15).sha
} catch {
  Write-Host "更新を確認できませんでした（インターネットにつながっていない可能性があります）。今の版で起動します。"
  exit 0
}
$current = if (Test-Path $VerFile) { (Get-Content $VerFile -Raw).Trim() } else { "" }
if ($current -eq $sha) {
  Write-Host "最新版です。"
  exit 0
}

Write-Host "新しい版があります。更新しています…"
$Tmp = Join-Path $env:TEMP ("nencho-update-" + [guid]::NewGuid())
try {
  New-Item -ItemType Directory -Path $Tmp | Out-Null
  $Zip = Join-Path $Tmp "app.zip"
  Invoke-WebRequest -Uri "https://github.com/$Repo/archive/$sha.zip" -OutFile $Zip -UseBasicParsing
  Expand-Archive -Path $Zip -DestinationPath $Tmp
  $Src = Get-ChildItem $Tmp -Directory | Select-Object -First 1

  $lock = Join-Path $App "package-lock.json"
  $oldLock = if (Test-Path $lock) { (Get-FileHash $lock).Hash } else { "" }

  $keep = @("node_modules", ".local-token", ".claude-path", ".version")
  Get-ChildItem $App -Force | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force
  Get-ChildItem $Src.FullName -Force | Copy-Item -Destination $App -Recurse -Force

  if ((Get-FileHash $lock).Hash -ne $oldLock) {
    Write-Host "部品を更新しています…"
    Push-Location $App
    npm.cmd install --no-audit --no-fund
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { throw "npm install に失敗しました" }
  }
  [IO.File]::WriteAllText($VerFile, $sha)
  Write-Host "更新しました。"
} catch {
  Write-Host "更新に失敗しました。今の版で起動します。（$($_.Exception.Message)）" -ForegroundColor Yellow
} finally {
  Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}
exit 0
