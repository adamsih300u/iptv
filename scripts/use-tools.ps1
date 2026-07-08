# Sets PATH to portable Node in .tools (created by scripts/bootstrap-node.cjs).
# Usage (PowerShell from repo root):
#   .\scripts\use-tools.ps1
#   npm test
#   npm run build:playlist

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $root '.tools\node-v22.22.0-win-x64'

if (-not (Test-Path (Join-Path $bin 'node.exe'))) {
  Write-Host 'Portable Node not found. Bootstrapping with Cursor node helper...'
  $cursorNode = Join-Path $env:LOCALAPPDATA 'Programs\cursor\resources\app\resources\helpers\node.exe'
  if (-not (Test-Path $cursorNode)) {
    throw "Need either $bin\node.exe or Cursor helper at $cursorNode"
  }
  & $cursorNode (Join-Path $root 'scripts\bootstrap-node.cjs')
}

$env:Path = "$bin;$env:Path"
Write-Host "Using Node from $bin"
node -v
npm -v
