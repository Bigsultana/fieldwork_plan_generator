# Appendix Builder

> Generates formatted PowerPoint appendix documents from engineering data using a PTG template.

**Version:** 2.0.3 | **Status:** Active | **Owner:** Matthew Raison

---

## What it does
This tool builds appendix-style PowerPoint deliverables from engineering inputs
using a PTG presentation template and title-block assets. The migrated source
includes the Python application entry points, support utilities, build spec, and
the core template assets needed for output generation.

## Requirements
- Python 3.13 in the local workspace venv
- `python-pptx`
- PyInstaller only if packaged later

## How to run
```powershell
& "E:\Home Folder\_local\python-venv\Scripts\python.exe" "E:\Home Folder\tools\appendix-builder\source\main.py"
```

Core assets preserved in:
- `assets\PTG_Appendix_Template.pptx`
- `assets\A1 HORIZONTAL - PTG CONSULTING_COMMERCIAL - Sheet - A1 - PTG - Horizontal.dxf`

Bundled `assets/...` paths are now resolved from the tool directory, so the app can still find its template assets after workspace moves or when launched from another current working directory.

## Changelog
See [CHANGELOG.md](./CHANGELOG.md)

## Verification
Run the lightweight smoke test with:

```powershell
& "E:\Home Folder\_local\python-venv\Scripts\python.exe" -m unittest discover -s "E:\Home Folder\tools\appendix-builder\tests" -p "test_build_smoke.py"
```

Lint the active source with:

```powershell
& "E:\Home Folder\_local\python-venv\Scripts\flake8.exe" "E:\Home Folder\tools\appendix-builder\source" --max-line-length=120 --jobs 1
```
