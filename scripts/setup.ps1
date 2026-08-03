$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js was not found. Install Node.js 22.12 or newer, then rerun this script."
    }
    npm install
    Write-Host "Setup complete. Run scripts\run.ps1 to start Fieldwork Plan Generator."
}
finally {
    Pop-Location
}
