import { fromArrayBuffer } from "geotiff";
import { overlayCornerCoordinates, projectionFromGeoKeys } from "./map-model.js";

function sampleScale(bits = 8) {
  const numeric = Number(bits) || 8;
  return numeric <= 8 ? 1 : 255 / (2 ** numeric - 1);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rasterToCanvas(image, rasters, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas image conversion is unavailable.");

  const fileDirectory = image.getFileDirectory();
  const bits = fileDirectory.BitsPerSample || [8];
  const scales = bits.map(sampleScale);
  const samples = rasters?.length && ArrayBuffer.isView(rasters[0]) ? Array.from(rasters) : [rasters];
  const red = samples[0];
  const green = samples[1] || red;
  const blue = samples[2] || red;
  const alpha = samples[3];
  const photometric = Number(fileDirectory.PhotometricInterpretation || 1);
  const imageData = context.createImageData(width, height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    let r = clampByte(Number(red[index]) * (scales[0] || 1));
    let g = clampByte(Number(green[index]) * (scales[1] || scales[0] || 1));
    let b = clampByte(Number(blue[index]) * (scales[2] || scales[0] || 1));
    if (photometric === 0 && samples.length === 1) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    imageData.data[offset] = r;
    imageData.data[offset + 1] = g;
    imageData.data[offset + 2] = b;
    imageData.data[offset + 3] = alpha
      ? clampByte(Number(alpha[index]) * (scales[3] || 1))
      : 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function fitRasterSize(width, height, maxDimension = 2400) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function readGeoTiffOverlay(file, selectedCrs = "auto") {
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const image = await tiff.getImage();
  const bbox = image.getBoundingBox();
  if (!bbox || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(Number(value)))) {
    throw new Error("The TIFF does not contain a readable georeferenced bounding box.");
  }

  const geoKeys = image.getGeoKeys?.() || {};
  const sourceCrs = projectionFromGeoKeys(geoKeys, selectedCrs);
  if (!sourceCrs) {
    throw new Error("The GeoTIFF coordinate system could not be identified. Select its CRS and try again.");
  }

  const nativeWidth = image.getWidth();
  const nativeHeight = image.getHeight();
  const size = fitRasterSize(nativeWidth, nativeHeight);
  const rasters = await image.readRasters({ width: size.width, height: size.height });
  const canvas = rasterToCanvas(image, rasters, size.width, size.height);
  const coordinates = overlayCornerCoordinates(bbox, sourceCrs);

  return {
    name: file.name,
    dataUrl: canvas.toDataURL("image/png"),
    coordinates,
    sourceCrs,
    nativeWidth,
    nativeHeight,
    renderedWidth: size.width,
    renderedHeight: size.height,
  };
}
