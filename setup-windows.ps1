# 年末調整 記入お手本：Windows 用の自動セットアップ
# PowerShell で次の1行を実行すると、必要なものを確認・インストールして起動する。
#   irm https://raw.githubusercontent.com/dxdimix/nencho-helper/main/setup-windows.ps1 | iex
# 何度実行しても問題ない（入っているものはそのまま使い、アプリは最新版に更新する）。

$ErrorActionPreference = "Stop"
$AppDir = Join-Path $HOME "nencho-helper"
$ZipUrl = "https://github.com/dxdimix/nencho-helper/archive/refs/heads/main.zip"

function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "   OK: $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host ""; Write-Host "!! $msg" -ForegroundColor Red; Read-Host "Enter キーで終了します"; exit 1 }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
              (Join-Path $HOME ".local\bin")
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
# npm で入れた claude.ps1 は実行ポリシーで止まることがあるため、.exe / .cmd を優先して使う。
function Claude-Path {
  $c = Get-Command claude.exe, claude.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { $c.Source } else { $null }
}
function Test-Claude {
  # 古い PowerShell は日本語をパイプで渡すと文字化けするため、確認の文は英語にする。
  $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  $out = "Reply with OK only" | & (Claude-Path) -p --no-session-persistence --tools Read 2>&1
  $code = $LASTEXITCODE; $ErrorActionPreference = $prev
  return @{ Ok = ($code -eq 0); Out = ($out | Out-String) }
}

Refresh-Path

# 1. Node.js
Step "Node.js を確認しています"
if (Has "node") {
  Ok "インストール済み（$(node --version)）"
} else {
  if (-not (Has "winget")) {
    Fail "Node.js が入っていません。https://nodejs.org/ja から LTS 版を入れてから、もう一度この1行を実行してください。"
  }
  Write-Host "   Node.js をインストールします（数分かかります。確認画面が出たら「はい」を押してください）"
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if (-not (Has "node")) { Fail "Node.js のインストールを確認できませんでした。PC を再起動してから、もう一度この1行を実行してください。" }
  Ok "インストールしました（$(node --version)）"
}

# 2. Claude Code
Step "Claude Code を確認しています"
if (Claude-Path) {
  Ok "インストール済み（$(& (Claude-Path) --version)）"
} else {
  Write-Host "   Claude Code をインストールします"
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  Refresh-Path
  if (-not (Claude-Path)) { Fail "Claude Code のインストールを確認できませんでした。PowerShell を開き直して、もう一度この1行を実行してください。" }
  Ok "インストールしました"
}

# 2-2. Tailscale（外出先から家の PC につなぐための無料サービス）
Step "Tailscale を確認しています（外出先から使うため）"
$TsExe = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
if (Test-Path $TsExe) {
  Ok "インストール済み"
} elseif (Has "winget") {
  Write-Host "   Tailscale をインストールします（確認画面が出たら「はい」を押してください）"
  winget install -e --id Tailscale.Tailscale --accept-source-agreements --accept-package-agreements
  if (Test-Path $TsExe) { Ok "インストールしました" } else { Write-Host "   Tailscale を入れられませんでした。家の Wi-Fi でだけ使えます。" -ForegroundColor Yellow }
} else {
  Write-Host "   Tailscale を自動で入れられませんでした。https://tailscale.com/download から入れると外出先でも使えます。" -ForegroundColor Yellow
}
if (Test-Path $TsExe) {
  $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  & $TsExe ip -4 2>&1 | Out-Null
  $tsOk = ($LASTEXITCODE -eq 0); $ErrorActionPreference = $prev
  if ($tsOk) {
    Ok "ログイン済み"
  } else {
    Write-Host "   Tailscale にまだログインしていません。これからブラウザでログイン画面を開きます。" -ForegroundColor Yellow
    Write-Host "   Google などのアカウントでログインしてください。スマホの Tailscale アプリでも同じアカウントでログインします。" -ForegroundColor Yellow
    Read-Host "   準備ができたら Enter キーを押してください"
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    & $TsExe up 2>&1 | Out-Host
    $ErrorActionPreference = $prev
  }
}

# 3. アプリ本体（最新版をダウンロード。合言葉ファイルは引き継ぐ）
Step "アプリをダウンロードしています"
$Tmp = Join-Path $env:TEMP ("nencho-setup-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
$Zip = Join-Path $Tmp "app.zip"
Invoke-WebRequest -Uri $ZipUrl -OutFile $Zip -UseBasicParsing
Expand-Archive -Path $Zip -DestinationPath $Tmp
$Src = Join-Path $Tmp "nencho-helper-main"
$Token = Join-Path $AppDir ".local-token"
$SavedToken = if (Test-Path $Token) { Get-Content $Token -Raw } else { $null }
if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
Move-Item $Src $AppDir
if ($SavedToken) { Set-Content -Path $Token -Value $SavedToken.Trim() -NoNewline }
# 起動時の自動更新が、今入れた版を最新と判断できるよう記録する
try {
  $sha = (Invoke-RestMethod -Uri "https://api.github.com/repos/dxdimix/nencho-helper/commits/main" -Headers @{ "User-Agent" = "nencho-helper" } -TimeoutSec 15).sha
  [IO.File]::WriteAllText((Join-Path $AppDir ".version"), $sha)
} catch { }
Remove-Item $Tmp -Recurse -Force
Ok "保存先: $AppDir"

Step "必要な部品を準備しています（初回は数分かかります）"
Push-Location $AppDir
npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "部品の準備に失敗しました。上に表示されたエラーを確認してください。" }
Pop-Location
Ok "準備できました"

# アプリが Claude Code を確実に見つけられるよう、場所を記録しておく。
[IO.File]::WriteAllText((Join-Path $AppDir ".claude-path"), (Claude-Path))

# 4. デスクトップにショートカットを作る
Step "デスクトップにショートカットを作っています"
$Desktop = [Environment]::GetFolderPath("Desktop")
$Shell = New-Object -ComObject WScript.Shell
$Link = $Shell.CreateShortcut((Join-Path $Desktop "年末調整お手本.lnk"))
$Link.TargetPath = Join-Path $AppDir "start-windows.bat"
$Link.WorkingDirectory = $AppDir
$Link.Save()
Ok "デスクトップの「年末調整お手本」から起動できます"

# 5. Claude Code にログインしているか確認する
Step "Claude Code のログインを確認しています"
$check = Test-Claude
if (-not $check.Ok) {
  Write-Host "   まだログインしていないようです。これから Claude Code の画面が開きます。" -ForegroundColor Yellow
  Write-Host "   画面の案内に従って Claude のアカウントでログインし、終わったら /exit と入力してください。" -ForegroundColor Yellow
  Read-Host "   準備ができたら Enter キーを押してください"
  & (Claude-Path)
  $check = Test-Claude
  if (-not $check.Ok) { Fail "ログインを確認できませんでした。もう一度この1行を実行してください。`n$($check.Out)" }
}
Ok "ログイン済みです"

# 6. 起動
Step "アプリを起動します"
Write-Host "   「Windows セキュリティの重要な警告」が出たら、「プライベート ネットワーク」にチェックを入れて「アクセスを許可」を押してください。" -ForegroundColor Yellow
Start-Process -FilePath (Join-Path $AppDir "start-windows.bat") -WorkingDirectory $AppDir
Write-Host ""
Write-Host "新しく開いた黒い画面に QR コードが出ます。スマホのカメラで読み取ってください。" -ForegroundColor Green
Write-Host "次回からは、デスクトップの「年末調整お手本」をダブルクリックするだけで起動できます。" -ForegroundColor Green
