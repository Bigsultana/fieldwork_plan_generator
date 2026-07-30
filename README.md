# Appendix Builder

Appendix Builder is a neutral Windows desktop application for assembling exported engineering images into an A1 landscape PowerPoint appendix.

**Version:** 2.1.0  
**Status:** Baseline hardening  
**Owner:** Matthew Raison

> The repository is currently named `fieldwork_plan_generator`, while the application contained within it is Appendix Builder. This naming decision remains separate from application branding.

## What it does

The application:

- collects project, client, drawing and company details;
- creates a sheet register from selected images, a folder, or a CSV file;
- places each image on an A1 landscape PowerPoint slide;
- draws a neutral, editable title block;
- accepts an optional company logo and optional PowerPoint template;
- preserves image aspect ratio inside the drawing area;
- inserts a labelled placeholder where an image is missing or unreadable; and
- saves the completed appendix as a `.pptx` file.

No company identity, contact details, logo, drawing template, or corporate asset is bundled or assumed by default.

## Repository structure

```text
source/                  Application source
source/main.py           Desktop application entry point
source/utils/            Presentation, configuration and title-block logic
tests/                   Automated tests
dist/                    PyInstaller specification
scripts/                 Setup, run and quality-gate scripts
docs/                    Baseline and review documentation
requirements.txt         Runtime dependencies
requirements-dev.txt     Development dependencies
```

## Supported environment

- Windows 10 or Windows 11
- Python 3.13
- Windows PowerShell
- Microsoft PowerPoint or another compatible application for reviewing output

## Setup

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

## Run

```powershell
.\scripts\run.ps1
```

## Test

```powershell
.\scripts\test.ps1
```

The quality-gate script performs Python compilation, formatting verification, linting and automated tests.

## Application workflow

1. Enter project and title-block information.
2. Optionally provide a logo or PowerPoint template.
3. Select the sheet source:
   - **Selected Images** for an editable in-application register.
   - **Folder Order** to use supported image files sorted by filename.
   - **CSV** to use a saved register.
4. Choose an output `.pptx` path.
5. Select **Build Appendix PPTX**.
6. Review the output and any missing-image warnings.

## Default title block

The built-in title block is deliberately neutral. Company fields are blank except for the placeholder `COMPANY NAME`. Users can save their own project configuration or provide their own logo and template without modifying source code.

## Licence

Proprietary and confidential. See [`LICENSE`](LICENSE).
