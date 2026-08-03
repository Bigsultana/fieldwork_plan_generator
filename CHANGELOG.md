# Changelog

## 2.0.0 - 2026-08-03

- Replaced the FastAPI/Docker runtime with a fully client-side browser application.
- Added Cloudflare static-assets deployment through `wrangler.jsonc`.
- Moved PowerPoint generation from `python-pptx` to PptxGenJS.
- Added in-browser TIFF decoding.
- Retained multi-image upload, editable sheet registers, CSV import, logo support, A1 output, title blocks, aspect-ratio fitting and missing-image placeholders.
- Added reusable JSON title-block profiles and browser-saved defaults.
- Removed server uploads, temporary request directories, Python dependencies and container hosting requirements.
- Replaced Python tests with Vitest model and real PPTX-generation checks.

## 1.0.0 - 2026-07-30

- Introduced the browser-based FastAPI baseline and Docker deployment.
