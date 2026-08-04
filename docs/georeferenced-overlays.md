# Georeferenced overlays

## Live basemaps

The map background can be switched between:

- Satellite imagery
- Street map
- None / uploaded imagery only

Live basemap tiles are proxied through the Cloudflare Worker so the browser can capture the map into the generated PowerPoint. Satellite imagery is a general-purpose Esri World Imagery layer and may not match the date or resolution of a licensed Nearmap or MetroMap export.

## GeoTIFF

Upload a georeferenced `.tif` or `.tiff` using the existing GeoTIFF control. The application can read an embedded CRS where supported, or the CRS can be selected manually.

## Image plus world file

Select the image and its matching world file in the same upload action.

Examples:

- `site.jpg` + `site.jgw`
- `site.png` + `site.pgw`
- `site.png` + `site.pngw`
- `site.jpg` + `site.wld`

A matching `.prj` can also be selected to define the source coordinate reference system. Otherwise choose the correct grid from the coordinate-system list.

The current release supports north-up world files. If the world file contains image rotation, export a north-up image before uploading.

## DXF

Select a `.dxf` file and choose its source coordinate system. A matching `.prj` can be selected with the DXF instead.

DXF normally stores drawing coordinates but does not reliably identify the CRS. The user must confirm whether the coordinates are GDA2020 / MGA, GDA94 / MGA, WGS84 or another supported system before relying on the overlay.

Supported first-release geometry includes:

- LINE
- LWPOLYLINE and POLYLINE
- ARC and CIRCLE
- ELLIPSE
- POINT
- TEXT and MTEXT
- SOLID and 3DFACE outlines
- common INSERT block transformations

Unsupported entities are skipped and reported after import.

## Accuracy

Map-clicked, image-derived and transformed DXF coordinates are planning coordinates. Verify the project datum, source imagery, CAD grid and survey control before using the outputs for field set-out.
