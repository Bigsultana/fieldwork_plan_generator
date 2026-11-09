# Fieldwork Plan Generator

Fieldwork Plan Generator is a privacy-first browser application for planning field investigations and producing formatted A1 landscape PowerPoint fieldwork plans.

**Version:** 2.3.0<br>
**Runtime:** Cloudflare Worker + static browser application  
**Owner:** Matthew Raison

## What it does

### Map workspace

- Open **Map workspace** to find a site by address or latitude/longitude. Use the toolbar to place fieldwork points or change zoom.
- Select **Add plans**, or drop JPG, PNG, TIFF and DXF files onto the map. Multiple files become separate layers. Include matching world files (`.jgw`, `.pgw`, `.tfw`, `.wld`, etc.) and `.prj` files in the same selection when available.
- Select a layer in **Contents** to change its opacity, visibility or stacking order, or zoom to it. Choose a source CRS for DXF/world-file images when no matching PRJ is supplied. GeoTIFF metadata is detected automatically when supported.
- For an unreferenced image, select **Georeference image**. Zoom/pan the source-image picker, click a detail, then click the matching main-map location or enter its known coordinates. WGS84 inputs use longitude then latitude; site search continues to accept latitude, longitude.
- Use at least three non-collinear points spread across the image, then **Preview alignment** and **Apply**. Four or more points provide redundant observations for the displayed fit RMS. The RMS measures agreement with selected controls, not absolute survey accuracy. **Cancel** restores the previous alignment. Applied alignments are locked; uncheck **Lock alignment** to edit.
- Uploaded raster layers use the original image resolution and render visible tiles up to zoom 26. Background tiles are enlarged beyond their native zoom; zoom cannot add source detail. Browser memory still limits very large images.
- Existing precision, crop, grid, coordinate-import and GIS export controls remain under **More tools**. The coordinate register expands below the map. Project information, supporting sheets and PowerPoint export have their own tabs.
- Visible unplaced layers and unfinished georeferencing must be resolved or hidden before a mapped PowerPoint can be exported. Plans remain in browser memory for the current session.

### Interactive map planning

- searches Australian addresses and places, or accepts direct latitude/longitude input;
- displays a fixed blue map outline with the exact aspect ratio of the usable A1 PowerPoint content area;
- lets the user pan and zoom the map beneath that outline to define the exported map extent;
- places independently numbered Borehole, Test Pit, CPT, DCP, Monitoring Well and Survey Point symbols;
- creates a live coordinate register with WGS84 latitude/longitude and calculated GDA2020 / MGA coordinates;
- estimates the A1 map scale from the selected map extent;
- exports the proposed locations and PowerPoint extent as KML, KMZ or CSV; and
- imports a georeferenced GeoTIFF as an adjustable map overlay.

### PowerPoint generation

- captures the selected map extent directly from the interactive map;
- generates a map sheet and paginated coordinate-schedule sheets;
- accepts additional PNG, JPEG, WebP, BMP and TIFF supporting plans;
- creates an editable supporting-sheet register and imports optional CSV metadata;
- collects project, client, approval and company information;
- accepts an optional company logo;
- preserves image aspect ratio inside the A1 drawing frame;
- creates a neutral, editable title block on every slide;
- generates and downloads the `.pptx` in the browser; and
- imports and exports reusable title-block profiles as JSON.

Selected drawings, GeoTIFFs, map captures and the generated PowerPoint remain in the user's browser. They are not uploaded to an application server.

## Map data and site search

The browser map is rendered with Leaflet, with selectable Esri satellite imagery, a CARTO/OpenStreetMap street map, or no online background. Address search is submitted only when the user presses Search. The Cloudflare Worker proxies and caches search and basemap requests.

Map and search data require visible OpenStreetMap attribution. Do not add bulk geocoding, autocomplete, tile prefetching or offline-map download features without first reviewing the applicable provider policies.

## Coordinate and survey warning

The coordinate schedule is generated from locations clicked on a web map. MGA2020 coordinates are calculated from WGS84 map coordinates and are suitable for planning and communication, not as a substitute for surveyed set-out coordinates or project survey control. Datum, grid zone and final field locations must be verified for the project.

## Georeferenced-plan support

GeoTIFF overlays support automatic CRS detection where the TIFF contains a supported EPSG code. Manual selections are available for:

- GDA2020 / MGA Zones 55 and 56;
- GDA94 / MGA Zones 55 and 56;
- WGS84 latitude/longitude; and
- Web Mercator.

JPG, PNG and TIFF images support matching world/PRJ files or manual image georeferencing. Georeferenced DXF linework supports a selected CRS or matching PRJ. Unsupported DXF entities are reported as skipped; this is a planning viewer, not a full CAD renderer. PDF/GeoPDF import is not included.

## Cloudflare deployment

The repository is configured for Cloudflare Workers. Static application files are published from `dist/`, while `src/worker.js` handles the cached `/api/geocode` endpoint.

```text
Production deploy command: npx wrangler deploy
```

Cloudflare's connected GitHub integration builds feature branches as previews and deploys `main` to production.

## Local setup

Requirements:

- Node.js 22.12 or newer
- npm

```powershell
.\scripts\setup.ps1
.\scripts\run.ps1
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Tests and production build

```powershell
.\scripts\test.ps1
```

Or directly:

```bash
npm install
npm test
npm run build
npx wrangler deploy --dry-run
```

Automated tests cover model helpers, fieldwork numbering, MGA coordinate conversion, map-scale rounding, KML/KMZ export and real PowerPoint generation with map and schedule slides.

## Supporting-sheet CSV format

CSV rows are applied to supporting images by register order.

```csv
sheet_number,drawing_title_1,drawing_title_2,drawing_title_3,scale,revision
002,Site Layout Plan,Existing site features,,NTS,A
003,Site Access Plan,Access and exclusion zones,,1:500,A
```

## Privacy and limits

- Map tiles and submitted address-search terms are requested from third-party map services.
- Uploaded engineering drawings and GeoTIFF contents remain in browser memory.
- Up to 60 supporting images can be held in one browser session.
- Large GeoTIFFs and source images can use significant browser memory.
- The main workspace preserves original raster resolution; the older GeoTIFF/cropping tools under More tools use reduced-resolution previews where necessary.
- Project defaults saved in the browser use local storage on the current device.
- No application database or file-upload API is used.

## Licence

Proprietary and confidential. See [`LICENSE`](LICENSE). Third-party packages and map data remain subject to their own licences and attribution requirements.
