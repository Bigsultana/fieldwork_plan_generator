# CLAUDE.md — Appendix Builder

## Tool identity

- **ID:** appendix-builder
- **Name:** Appendix Builder
- **Version:** 2.1.0
- **Status:** baseline-hardening
- **Category:** document

## Purpose

Appendix Builder creates A1 landscape PowerPoint appendices from exported engineering images. It provides a Tkinter interface, sheet-register utilities, a neutral title-block renderer and a presentation build pipeline.

## Stack

- Python 3.13
- Tkinter
- Pillow
- python-pptx
- PyInstaller-oriented packaging

## Entry point

```text
python source/main.py
```

## Design decisions

1. The built-in title block must remain neutral and configurable.
2. Company details are user inputs, not hard-coded application identity.
3. No corporate template, logo, drawing or contact information is bundled.
4. Presentation-building logic remains callable independently of the GUI.
5. Tests write to temporary directories rather than tracked repository folders.

## Known follow-up work

- Add continuous integration.
- Verify the packaged executable on a clean Windows workstation.
- Expand validation and automated coverage.
- Resolve the final repository name.
