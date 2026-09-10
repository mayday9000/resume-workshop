# Creates (or refreshes) the "Resume Workshop" shortcut on the Desktop.
# Run with: npm run shortcut

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Resume Workshop.lnk'
$target  = Join-Path $root 'scripts\launch.cmd'
$icon    = Join-Path $root 'app\icon.ico'

if (-not (Test-Path $target)) { throw "launcher not found: $target" }
if (-not (Test-Path $icon))   { Write-Warning "icon not found: $icon - run `npm run icon` first" }

$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath        = $target
$lnk.WorkingDirectory  = $root
$lnk.IconLocation      = "$icon,0"
$lnk.Description       = 'Open the Resume Workshop editor at http://localhost:4000'
$lnk.WindowStyle       = 7   # start the console minimized; the browser is the interface
$lnk.Save()

Write-Host "created $lnkPath"
