# Appendix Builder

> Creates A1 landscape PowerPoint appendices from exported engineering images using a PTG Consulting title block.

**Version:** 2.0.3  
**Status:** Baseline hardening  
**Owner:** Matthew Raison

> [!IMPORTANT]
> The GitHub repository is currently named `fieldwork_plan_generator`, but the uploaded application is Appendix Builder. See [`docs/BASELINE.md`](docs/BASELINE.md) before beginning feature development.

## What the application does

Appendix Builder is a Python/Tkinter desktop application that:

- collects project, client, drawing and company information;
- creates a sheet register from selected images, a folder, or a CSV file;
- places each image on an A1 landscape PowerPoint slide;
- draws a PTG-formatted title block using DXF-derived geometry;
- preserves image aspect ratio inside the drawing area;
- inserts a labelled placeholder when an image cannot be found or read; and
- saves the completed appendix as a `.pptx` file.

Typical source images include test-location plans, cross-sections and other figures prepared for engineering reports.

## Repository structure

```text
assets/                  Bundled PowerPoint template and title-block DXF
source/                  Application source
source/main.py           Desktop application entry point
source/utils/            PowerPoint, configuration and title-block logic
tests/                   Automated smoke tests
dist/                    PyInstaller specification
scripts/                 Fresh-clone setup, run and test commands
docs/                    Baseline and review documentation
requirements.txt         Runtime dependencies
requirements-dev.txt     Runtime and development dependencies
```

## Supported environment

The current supported development environment is:

- Windows 10 or Windows 11;
- Python 3.13;
- Windows PowerShell; and
- Microsoft PowerPoint or another compatible application for reviewing output.

## Fresh-clone setup

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

This creates `.venv` and installs the pinned runtime and development dependencies.

## Run the application

```powershell
.\scripts\run.ps1
```

The direct equivalent is:

```powershell
.\.venv\Scripts\python.exe .\source\main.py
```

## Run the quality gates

```powershell
.\scripts\test.ps1
```

The script runs:

1. Python bytecode compilation;
2. Black formatting verification;
3. Flake8 linting; and
4. the unittest suite.

## Application workflow

1. Enter the project and title-block information.
2. Select the exported figures using one of the following modes:
   - **Selected images** — choose and edit individual sheets in the application.
   - **Folder order** — build sheets from supported images sorted by filename.
   - **CSV** — load a saved sheet register.
3. Choose the output `.pptx` path.
4. Select **Build Appendix PPTX**.
5. Review the build log and any missing-image warnings.

## Bundled assets

- `assets/PTG_Appendix_Template.pptx`
- `assets/A1 HORIZONTAL - PTG CONSULTING_COMMERCIAL - Sheet - A1 - PTG - Horizontal.dxf`

These assets are proprietary project assets and should not be redistributed without authorisation.

## Current limitations

The repository is undergoing baseline hardening. Known follow-up work includes:

- resolving the repository/application naming mismatch;
- confirming appropriate repository visibility for PTG-branded assets;
- removing already tracked generated test artefacts and Python caches;
- adding continuous integration and branch protection;
- replacing startup-time package installation with controlled deployment; and
- validating the packaged executable from a fresh clone.

See [`docs/BASELINE.md`](docs/BASELINE.md) and [`CHANGELOG.md`](CHANGELOG.md) for the current status.

## Licence

Proprietary and confidential. See [`LICENSE`](LICENSE).
