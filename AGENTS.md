# AGENTS.md — Fieldwork Plan Generator

## Product identity

This repository contains **Fieldwork Plan Generator**, a FastAPI browser application that generates A1 landscape PowerPoint fieldwork plans from uploaded engineering images.

Do not reintroduce the previous desktop Appendix Builder identity or company-specific branding.

## Source of truth

Read before modifying the application:

1. `README.md`
2. `tool-info.json`
3. `CHANGELOG.md`
4. `docs/BASELINE.md`

## Architecture

- `source/web_app.py` owns HTTP routes, validation, temporary uploads and file responses.
- `source/templates/` and `source/static/` own the browser interface.
- `source/utils/` owns PowerPoint generation and must remain usable without the HTTP layer.
- Uploaded files must remain temporary and must be deleted after the response.
- Never trust client-provided filesystem paths.

## Quality gates

Run:

```powershell
.\scripts\test.ps1
```

At minimum, compile all Python files and run all automated tests. Any behaviour change requires a corresponding test.

## Security constraints

- Validate extensions and file counts before generation.
- Enforce upload-size limits.
- Use generated temporary filenames rather than uploaded paths.
- Do not persist user uploads or project data without an explicit product decision.
- Do not commit credentials or deployment secrets.

## Publishing

Develop on a branch, open a pull request, ensure GitHub Actions passes, then squash merge to `main`.
