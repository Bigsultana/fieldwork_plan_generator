$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $RepoRoot ".venv"
$PythonPath = Join-Path $VenvPath "Scripts\python.exe"
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python launcher 'py' was not found." }
if (-not (Test-Path $PythonPath)) { py -3.13 -m venv $VenvPath }
& $PythonPath -m pip install --upgrade pip
& $PythonPath -m pip install -r (Join-Path $RepoRoot "requirements-dev.txt")
Write-Host "Setup complete. Run scripts\run.ps1 and open http://127.0.0.1:8000"
