$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$EntryPoint = Join-Path $RepoRoot "source\main.py"

if (-not (Test-Path $PythonPath)) {
    throw "Virtual environment not found. Run scripts\setup.ps1 first."
}

& $PythonPath $EntryPoint
