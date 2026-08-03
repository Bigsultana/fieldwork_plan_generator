$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
    if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
        throw "Dependencies not found. Run scripts\setup.ps1 first."
    }
    npm run dev
}
finally {
    Pop-Location
}
