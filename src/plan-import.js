import { fromArrayBuffer } from "geotiff";
import proj4 from "proj4";
import { prepareImageFile } from "./presentation.js";
import { projectionFromGeoKeys } from "./map-model.js";
import { parseWorldFile } from "./world-file-overlay.js";
import { applyAffine, invertAffine, imageCorners, worldToPixelTransform } from "./georeferencing.js";
import "./projection-utils.js";

export function matchingSidecar(files, name, extensions) {
  const stem = name.replace(/\.[^.]+$/, "").toLowerCase();
  return [...files].find((file) => extensions.some((extension) => file.name.toLowerCase() === `${stem}${extension}`));
}

export function geoTiffTransform(directory) {
  const value = (name) => directory.getValue ? directory.getValue(name) : directory[name];
  const m = value("ModelTransformation");
  if (m?.length === 16) return { a: m[0], b: m[1], c: m[3], d: m[4], e: m[5], f: m[7] };
  const s = value("ModelPixelScale");
  const t = value("ModelTiepoint");
  if (!s || !t) return null;
  return { a: s[0], b: 0, c: t[3] - t[0] * s[0], d: 0, e: -s[1], f: t[4] + t[1] * s[1] };
}

export function rasterPlacement(entry, sourceCrs) {
  if (!entry.nativeTransform) throw new Error("This image needs manual reference points.");
  if (!sourceCrs || sourceCrs === "auto") throw new Error("Select the image's source coordinate system.");
  const inverse = invertAffine(entry.nativeTransform);
  const project = proj4(sourceCrs, "EPSG:3857");
  const toMercator = (pixel) => project.forward(applyAffine(entry.nativeTransform, pixel));
  const toPixel = (mercator) => applyAffine(inverse, project.inverse(mercator));
  const corners = imageCorners(entry.width, entry.height).map(toMercator);
  if (corners.flat().some((value) => !Number.isFinite(value) || Math.abs(value) > 20037508.35)) throw new Error("The selected coordinate system cannot place this image within the map. Check its CRS.");
  return { toMercator, toPixel, corners, sourceCrs };
}

export async function readPlanImage(file, files = []) {
  const prepared = await prepareImageFile(file);
  const image = new Image();
  image.src = prepared.data;
  await image.decode();
  const entry = { name: file.name, file, image, width: prepared.width, height: prepared.height,
    nativeTransform: null, detectedCrs: null };
  const world = matchingSidecar(files, file.name, [".jgw", ".jpgw", ".jpegw", ".pgw", ".pngw", ".tfw", ".tifw", ".tiffw", ".wld"]);
  const prj = matchingSidecar(files, file.name, [".prj"]);
  if (world) entry.nativeTransform = worldToPixelTransform(parseWorldFile(await world.text()));
  if (/\.tiff?$/i.test(file.name)) {
    const tiff = await fromArrayBuffer(await file.arrayBuffer());
    const raster = await tiff.getImage();
    const keys = raster.getGeoKeys() || {};
    entry.nativeTransform ||= geoTiffTransform(raster.getFileDirectory());
    // RasterPixelIsPoint locates the first pixel centre rather than its corner.
    if (!world && keys.GTRasterTypeGeoKey === 2 && entry.nativeTransform) {
      entry.nativeTransform = worldToPixelTransform(entry.nativeTransform);
    }
    entry.detectedCrs = projectionFromGeoKeys(keys, "auto");
  }
  if (prj) entry.detectedCrs = await prj.text();
  return entry;
}
