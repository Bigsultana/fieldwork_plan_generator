$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) { throw "Virtual environment not found. Run scripts\setup.ps1 first." }
Push-Location $RepoRoot
try {
    & $PythonPath -m compileall -q source tests
    & $PythonPath -m unittest discover -s tests -p "test_*.py"
}
finally { Pop-Location }
