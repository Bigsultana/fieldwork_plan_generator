# Repository Baseline

**Baseline date:** 30 July 2026  
**Application identified in the repository:** Appendix Builder  
**Repository name at review:** `fieldwork_plan_generator`

## Current intent

Appendix Builder is a Windows desktop application that converts selected engineering images into an A1 landscape PowerPoint appendix. It collects project and title-block information, builds a sheet register from selected images, a folder, or CSV, and creates PTG-formatted slides with missing-image placeholders where necessary.

## Identity decision still required

The repository name does not match the application contained within it. Before feature development, the owner should complete one of the following:

1. Rename the repository to `appendix-builder` or another Appendix Builder name.
2. Confirm that Appendix Builder is only a component of a future Fieldwork Plan Generator and restructure the repository accordingly.
3. Replace the repository contents with the actual Fieldwork Plan Generator source if the current upload was unintended.

Until that decision is completed, source code and documentation in this branch use the application's existing identity: **Appendix Builder**.

## Preservation

The original GitHub upload is preserved on branch:

```text
archive/github-upload-2026-07-30
```

Baseline-hardening changes are developed on:

```text
agent/baseline-hardening
```

## Stable-baseline scope

This hardening pass is intentionally limited to repository-level changes:

- repository ignore rules;
- proprietary-use notice;
- self-contained setup, run, and test scripts;
- accurate repository documentation;
- removal of dependence on external workspace paths in operating instructions;
- a documented path for later generated-file cleanup.

No application feature or PowerPoint-generation behaviour is intentionally changed in this pass.

## Known follow-up work

- Decide and apply the final repository name.
- Confirm repository visibility and authorisation to host PTG-branded assets.
- Remove already tracked caches and generated smoke-test artefacts from the active branch.
- Add continuous integration and branch protection.
- Replace startup-time dependency installation with a controlled environment or packaged executable.
- verify the PyInstaller build from a fresh clone.
- Expand automated tests beyond the current one-slide smoke test.
