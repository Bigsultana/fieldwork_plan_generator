$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$BlackPath = Join-Path $RepoRoot ".venv\Scripts\black.exe"
$Flake8Path = Join-Path $RepoRoot ".venv\Scripts\flake8.exe"

if (-not (Test-Path $PythonPath)) {
    throw "Virtual environment not found. Run scripts\setup.ps1 first."
}

Push-Location $RepoRoot
try {
    & $PythonPath -m compileall -q source tests
    & $BlackPath --check source tests
    & $Flake8Path source tests --max-line-length=120 --jobs=1
    & $PythonPath -m unittest discover -s tests -p "test_*.py"
}
finally {
    Pop-Location
}
