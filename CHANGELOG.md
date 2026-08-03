# Changelog

## 2.1.0 - 2026-08-03

- Added an interactive MapLibre site-planning interface.
- Added a fixed A1-content outline so the selected map extent matches the PowerPoint map area.
- Added address/place search and direct latitude/longitude navigation through a cached Cloudflare Worker endpoint.
- Added independently numbered Borehole, Test Pit, CPT, DCP, Monitoring Well and Survey Point tools.
- Added a live WGS84 and GDA2020 / MGA coordinate register with notes.
- Added automatic map-scale estimation at A1.
- Added GeoTIFF overlay import with automatic or manual CRS selection and opacity control.
- Added KML, KMZ and coordinate CSV export.
- Added map capture, map title-block output and paginated coordinate-schedule slides to the PowerPoint.
- Added tests for point numbering, coordinate conversion, map-scale rounding, KML/KMZ and map-based PPTX generation.

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
