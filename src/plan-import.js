import { fromArrayBuffer } from "geotiff";
import { prepareImageFile } from "./presentation.js";
import { projectionFromGeoKeys } from "./map-model.js";
import { parseWorldFile } from "./world-file-overlay.js";
import { matchingSidecar, geoTiffTransform, worldToPixelTransform } from "./model.js";

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

export { matchingSidecar, geoTiffTransform, rasterPlacement } from "./model.js";
