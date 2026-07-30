# Changelog — Appendix Builder

## [2.1.0] — 2026-07-30

### Changed

- Replaced company-specific presentation formatting with a neutral A1 title block.
- Removed bundled corporate templates, drawings, names, contact details and colour identifiers.
- Changed application and executable labels to `Appendix Builder`.
- Changed default company fields to neutral placeholders or blank values.
- Replaced startup-time package installation with a setup-script workflow.
- Updated the smoke test to use temporary output and generic sample data.

### Repository

- Added repository ignore rules.
- Removed tracked caches and generated test output.
- Added repository-local setup, run and test scripts.
- Added baseline and review documentation.

## [2.0.3] — 2026-04-29

### Changed

- Stabilised formatting and lint compliance in the migrated source.
- Added a basic presentation-generation smoke test.
- Corrected bundled-path handling used by the earlier internal version.

## [2.0.0] — 2026-04-14

### Changed

- Migrated the second-generation appendix-building workflow into a structured Python application.
