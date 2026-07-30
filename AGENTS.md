# AGENTS.md — Appendix Builder

This file defines the operating constraints for automated implementation work in this repository.

## Application identity

The source implements **Appendix Builder**. The current repository name is `fieldwork_plan_generator`; do not infer additional fieldwork-planning functionality unless the owner explicitly requests it.

## Repository scope

- Work only inside this repository.
- Use repository-relative paths.
- Develop changes on a branch and merge through a pull request.
- Do not introduce company-specific branding, contact details, templates or drawing assets into source defaults.

## Source of truth

Read these files before significant changes:

1. `docs/BASELINE.md`
2. `README.md`
3. `tool-info.json`
4. `CHANGELOG.md`
5. `docs/REVIEW.md`

## Setup and quality gates

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\test.ps1
```

Where a check cannot run, report the exact blocker and do not claim it passed.

## Change discipline

- Keep hardening changes separate from feature changes where practical.
- Add or update tests whenever behaviour changes.
- Keep all paths repository-relative.
- Keep the built-in title block neutral and configurable.
- Do not commit secrets, credentials, personal databases, virtual environments, caches, generated presentations or temporary output.
- Do not add a corporate logo, company name, company contact information or proprietary template without explicit owner approval.

## Versioning

When application code changes:

- update `tool-info.json`;
- update `CHANGELOG.md`;
- update user documentation where behaviour changes; and
- record significant design decisions in `docs/REVIEW.md`.

## Commit examples

```text
chore: remove generated files
fix: reject invalid sheet CSV
feat: add editable revision register
```
