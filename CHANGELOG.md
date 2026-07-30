# Changelog - Appendix Builder

## [Unreleased]

### Repository
- Preserved the original GitHub upload on `archive/github-upload-2026-07-30`.
- Added repository ignore rules for Python caches, virtual environments, generated test output and packaging artefacts.
- Added a proprietary-use notice for the source, documentation and bundled PTG assets.
- Added repository-local PowerShell scripts for setup, launch and quality checks.
- Replaced machine-specific `E:\Home Folder` operating instructions with fresh-clone guidance.
- Documented the mismatch between the `fieldwork_plan_generator` repository name and the Appendix Builder application.

### Added
- Added an automated smoke test for `build_appendix` that generates a one-slide PowerPoint using the migrated tool assets.

### Fixed
- Resolved default `assets/...` template and logo paths against the tool root so the builder still finds its bundled assets after folder moves or launches from another working directory.
- Cleared the appendix builder `flake8` gate by replacing the wildcard titleblock constant import, fixing nested callback style issues, removing unused imports, and wrapping remaining long UI/status strings.

### Verified
- Ran a runtime smoke test from the migrated workspace and confirmed the builder generated a PowerPoint successfully from the new tool location.
- Re-ran `flake8` successfully against `source/`.

## [2.0.0] - 2026-04-14
### Changed
- Migrated Version 2 appendix builder into the home-tools harness.
- Archived Version 1 copy to `_retired/appendix-builder-legacy/`.
- Preserved build spec in `dist/AppendixBuilder.spec`.
- Archived trial and preview image assets to `_retired/appendix-builder-legacy/test-assets/`.
