$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
    if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
        throw "Dependencies not found. Run scripts\setup.ps1 first."
    }
    npm test
    npm run build
    npx wrangler deploy --dry-run
}
finally {
    Pop-Location
}
