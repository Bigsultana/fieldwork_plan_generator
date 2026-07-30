# AGENTS.md — Appendix Builder

This file defines the operating constraints for automated implementation work in this repository.

## Application identity

The source currently implements **Appendix Builder**, even though the repository is named `fieldwork_plan_generator`. Read `docs/BASELINE.md` before planning changes. Do not reinterpret the application as a fieldwork plan generator without an explicit owner decision.

## Repository scope

- Work only inside this repository.
- Use repository-relative paths.
- Do not rely on `E:\Home Folder`, external registries, or utilities that are not committed here.
- Preserve the original upload on `archive/github-upload-2026-07-30`.
- Develop changes on a branch and merge through a pull request.

## Source of truth

Before modifying the application, read:

1. `docs/BASELINE.md` — current identity, scope and unresolved decisions.
2. `README.md` — supported setup and user workflow.
3. `tool-info.json` — application metadata.
4. `CHANGELOG.md` — recorded changes.
5. `docs/REVIEW.md` — historical implementation notes.

## Setup

From the repository root on Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

## Quality gates

Run before reporting a code change complete:

```powershell
.\scripts\test.ps1
```

The quality gate must compile the Python source, verify formatting and linting, and run the automated tests.

Where a check cannot run, report the exact blocker and do not claim that it passed.

## Change discipline

- Keep repository-hardening changes separate from functional improvements.
- Avoid broad refactors unless they are required for the approved task.
- Add or update tests when behaviour changes.
- Keep bundled asset-path handling repository-relative.
- Do not silently change title-block geometry or company information.
- Do not modify or redistribute proprietary PTG assets without owner approval.
- Do not commit secrets, credentials, personal databases, virtual environments, Python caches, generated test presentations or temporary output.

Generated files already present in repository history may be removed from the active branch after confirming they can be recreated. Functional source files and intentional assets must not be deleted without an explicit reason recorded in the pull request.

## Versioning and records

When application code changes:

- update `tool-info.json`;
- update `CHANGELOG.md`;
- update user documentation where behaviour or setup changes; and
- record significant design decisions in `docs/REVIEW.md` or a dedicated design document.

## Commit convention

Use focused commit messages such as:

```text
chore: add repository ignore rules
fix: reject missing CSV configuration
feat: add editable revision register
```

## Sign-off boundaries

Do not proceed beyond the following decisions without explicit owner direction:

- final repository/application naming;
- publication or redistribution of PTG-branded assets;
- material title-block redesign;
- changes to engineering content or approval fields; and
- distribution to users outside the authorised internal group.
