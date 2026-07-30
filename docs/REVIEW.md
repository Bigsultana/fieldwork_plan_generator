# Tool Review - APPENDIX BUILDER v2.0.0

**Date:** 2026-04-14
**Build session:** Codex migration session - Phase 2 Tool 04 harness migration

---

## 1. What was built
Migrated the canonical Version 2 appendix builder source into the harness,
preserved the active PTG template assets, copied the PyInstaller spec into
`dist/`, and archived Version 1 plus test/preview image assets into `_retired`.

## 2. What worked well
The active application files, utility modules, build spec, and required assets
were easy to separate from trial image outputs. This allowed a clean migration
without mixing runtime previews into the active tool package.

## 3. What didn't work / problems encountered
The source folder includes additional stray files and an odd brace-named folder
pattern similar to the map tools. These were left in place in the originals and
not carried into the active harness during the migration-first pass.

## 4. What would be done differently
During the later cleanup pass, review whether any non-migrated local files in
the source root were meaningful artifacts or just development leftovers.

## 5. AI collaboration notes
Claude defined the asset split, especially the requirement to archive the trial
and preview image files. Codex executed the migration and preserved the active
template assets separately from those test artifacts.

## 6. Quality check results
Black: would reformat 8 files and has not yet been applied during this
migration-first pass.
Flake8: failed due to inherited legacy lint and line-length issues in the
original source.
Registry rebuild: passed, and the tool list now includes `appendix-builder`.

## 7. Next priorities
- Confirm runtime dependencies for the PowerPoint generation workflow
- Audit any hardcoded paths in the title-block/template code
- Review stray non-migrated root files during the cleanup pass

---

# Tool Review - APPENDIX BUILDER v2.0.1

**Date:** 2026-04-29
**Build session:** Codex runtime verification after folder transfer and organisation

---

## 1. What was built
Verified the migrated appendix builder by running a smoke test that generated a PowerPoint from the new harness location. Updated path resolution so bundled `assets/...` references point back to the tool root after relocation.

## 2. What worked well
The core PowerPoint generation pipeline still worked with the local venv and bundled template asset. Imports, dependencies, and output creation all succeeded without requiring source restructuring.

## 3. What didn't work / problems encountered
The app's default template path depended on the current working directory. That meant a normal launch from `E:\Home Folder` could silently miss `assets/PTG_Appendix_Template.pptx` after the migration.

## 4. What would be done differently
Bundled asset paths should have been normalized to tool-root-relative during the initial migration pass, alongside the runtime smoke verification.

## 5. AI collaboration notes
This session focused on runtime validation rather than architecture work. The fix stayed narrowly scoped to path resolution so the transferred tool behavior matched the pre-move intent.

## 6. Quality check results
Runtime smoke test: passed and produced `tests/runtime-smoke/smoke-output.pptx`.
Bundled asset path resolution: fixed for default `assets/...` references.
Formatting/lint/manifest checks: pending rerun for this session.

## 7. Next priorities
- Add a lightweight automated smoke test for `build_appendix`
- Audit whether any saved external configs rely on project-relative asset paths
- Review the remaining migrated source for non-ASCII comment cleanup

---

# Tool Review - APPENDIX BUILDER v2.0.2

**Date:** 2026-04-29
**Build session:** Codex follow-up automation of transfer verification

---

## 1. What was built
Added a lightweight automated smoke test that exercises the core `build_appendix` flow with a workspace-local test image and the bundled PTG template.

## 2. What worked well
The builder already had a clean enough functional seam at `build_appendix` to support direct testing without launching the GUI.

## 3. What didn't work / problems encountered
The repository still carries substantial inherited lint debt in `source/`, so passing the full flake8 gate remains separate from this verification work.

## 4. What would be done differently
Add smoke coverage during migration, not after, so transfer regressions are caught immediately.

## 5. AI collaboration notes
This was a narrow follow-up to make the manual runtime check repeatable and cheap for future sessions.

## 6. Quality check results
Automated smoke test: passed after switching the test workspace from OS temp to `tests/_runtime-smoke-auto/` for harness compatibility.
Manifest validation: passed after rerun.
Flake8: expected to continue failing on inherited issues outside this small change.

## 7. Next priorities
- Decide whether to pay down the inherited flake8 backlog or relax the legacy rule set
- Add a second smoke test covering missing-image placeholder generation
- Consider a non-GUI launch check for `source/main.py`

---

# Tool Review - APPENDIX BUILDER v2.0.3

**Date:** 2026-04-29
**Build session:** Codex lint gate remediation

---

## 1. What was built
Removed the active `flake8` failures in the appendix builder source and kept the earlier smoke-test coverage intact.

## 2. What worked well
Most of the lint issues were shallow style and import hygiene problems rather than behavioral defects, so they could be corrected without changing the tool's functional shape.

## 3. What didn't work / problems encountered
`pycodestyle` was fussy about the exact nested-function spacing in `app.py`, and the titleblock renderer needed a broader cleanup because the wildcard constant import generated a large cascade of lint noise.

## 4. What would be done differently
Treat inherited lint cleanup as part of migration hardening so the quality gate is green before follow-up verification work begins.

## 5. AI collaboration notes
This session stayed focused on getting the repo's documented quality gate to pass rather than widening into UI refactors or titleblock behavior changes.

## 6. Quality check results
Black: passed on active source and smoke test file.
Flake8: passed on `source/` with `--max-line-length=120 --jobs 1`.
Automated smoke test: passed.

## 7. Next priorities
- Add a missing-image placeholder smoke test
- Consider reducing the remaining non-ASCII comment noise in legacy file headers
- Add a small non-GUI import/launch sanity check for `main.py`
