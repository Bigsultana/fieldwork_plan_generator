$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) { throw "Virtual environment not found. Run scripts\setup.ps1 first." }
Push-Location $RepoRoot
try { & $PythonPath .\source\main.py }
finally { Pop-Location }
