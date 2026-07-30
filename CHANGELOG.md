# Changelog — Fieldwork Plan Generator

## [1.0.0] - 2026-07-30

### Added

- FastAPI browser application.
- Responsive project and title-block form.
- Multi-image upload and editable sheet register.
- Optional CSV metadata import.
- Optional company logo and PowerPoint template uploads.
- Direct browser download of generated PowerPoint files.
- Temporary-file cleanup after each request.
- Health endpoint and automatic API documentation.
- Dockerfile and Render deployment blueprint.
- GitHub Actions tests and Docker build checks.
- Browser/API and PowerPoint-builder automated tests.

### Changed

- Renamed the product to Fieldwork Plan Generator.
- Replaced the Tkinter desktop interface with a browser interface.
- Renamed the primary builder API to `build_fieldwork_plan` while retaining a compatibility alias.

### Removed

- Desktop-only application entry flow.
- PyInstaller packaging configuration.
