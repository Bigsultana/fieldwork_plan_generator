$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $RepoRoot ".venv"
$PythonPath = Join-Path $VenvPath "Scripts\python.exe"

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3.13, then rerun this script."
}

if (-not (Test-Path $PythonPath)) {
    Write-Host "Creating virtual environment at $VenvPath"
    py -3.13 -m venv $VenvPath
}

& $PythonPath -m pip install --upgrade pip
& $PythonPath -m pip install -r (Join-Path $RepoRoot "requirements-dev.txt")

Write-Host "Setup complete. Run scripts\run.ps1 to start Appendix Builder."
