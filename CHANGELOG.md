# Changelog

## 2.4.0 - 2026-11-09

- Removed the scrolling right sidebar and duplicate single-file import and precision-zoom interfaces.
- Integrated selected-layer settings above the map, Locations/View/GIS export controls in the workspace toolbar, and coordinate schedules/drawing checks below the map.
- Added drag-to-reorder, direct Up/Down/Delete controls, per-row delete buttons and focused Delete-key removal in Contents.
- Integrated non-destructive raster cropping and temporary source-image georeferencing into the workspace; retained coordinate import, MGA grid, fine nudging and DXF line styles.
- Prevented fieldwork-editor saves from submitting the PowerPoint generation form, and ensured each DXF in a batch loads its own file.
- Imported coordinate batches directly with their IDs and notes, and kept point editors open during map auto-panning.

- Fixed survey DXF imports failing on empty trailing 3DFACE vertices emitted by the DXF parser; valid face coordinates and other drawing entities are preserved.

## 2.3.0 - 2026-11-09

- Added a map-first workspace with a toolbar, Contents layer list, Properties inspector and separate project, supporting-sheet and export tabs.
- Added multi-layer JPG, PNG, TIFF/GeoTIFF and DXF imports by file selection or map drag-and-drop, with individual visibility, ordering and opacity controls.
- Added full-resolution image tile rendering, rotated world-file support and deep zoom to level 26; online basemaps retain their native tile limits.
- Added manual image georeferencing using three or more control points, map clicks or known coordinates, preview/apply/cancel, fit residuals and alignment locking.
- Preserved the existing fieldwork editor, coordinate imports/schedules, MGA grid, image-cropping tools and GIS/A1 PowerPoint outputs.
- Added geometry, projection, sidecar-matching and GeoTIFF metadata regression tests.

## 2.2.0 - 2026-08-03

- Added selectable satellite imagery, street-map and imagery-only backgrounds.
- Added a same-origin Cloudflare proxy for Esri World Imagery tiles so the map remains browser-capturable for PowerPoint output.
- Added georeferenced JPG, PNG and WebP upload using matching world files such as `.jgw`, `.pgw`, `.pngw`, `.jpgw` and `.wld`.
- Added optional `.prj` sidecar support for uploaded raster and DXF coordinate systems.
- Added browser-side georeferenced DXF overlays with CRS transformation, fit, colour, opacity and line-weight controls.
- Added support for common 2D DXF geometry including lines, polylines, arcs, circles, points, text and common block inserts.
- Added world-file, DXF and street/satellite Worker-route tests.

## 2.1.0 - 2026-08-03

- Added an interactive Leaflet site-planning interface.
- Added a fixed A1-content outline so the selected map extent matches the PowerPoint map area.
- Added address/place search and direct latitude/longitude navigation through a cached Cloudflare Worker endpoint.
- Added independently numbered Borehole, Test Pit, CPT, DCP, Monitoring Well and Survey Point tools.
- Added a live WGS84 and GDA2020 / MGA coordinate register with notes.
- Added automatic map-scale estimation at A1.
- Added GeoTIFF overlay import with automatic or manual CRS selection and opacity control.
- Added KML, KMZ and coordinate CSV export.
- Added map capture, map title-block output and paginated coordinate-schedule slides to the PowerPoint.
- Added tests for point numbering, coordinate conversion, map-scale rounding, KML/KMZ and map-based PPTX generation.
- Added a resilient raster base layer and automatic best-match address centring.

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
