import { matchingPrjFile, resolveSourceProjection, toWgs84 } from "./projection-utils.js";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const WORLD_EXTENSIONS = [".jgw", ".jpgw", ".jpegw", ".pgw", ".pngw", ".wld"];

function extension(name) {
  const lower = String(name || "").toLowerCase();
  const index = lower.lastIndexOf(".");
  return index >= 0 ? lower.slice(index) : "";
}

function stem(name) {
  const lower = String(name || "").toLowerCase();
  const index = lower.lastIndexOf(".");
  return index >= 0 ? lower.slice(0, index) : lower;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to read the dimensions of ${file.name}.`));
    };
    image.src = url;
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode the uploaded georeferenced image."));
    image.src = dataUrl;
  });
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function parseWorldFile(text) {
  const values = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(Number);
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("The world file must contain six numeric lines.");
  }
  const [a, d, b, e, c, f] = values;
  return { a, d, b, e, c, f };
}

export function worldFileNativeCorners(transform, width, height) {
  const { a, d, b, e, c, f } = transform;
  const pixelCorner = (column, row) => [
    a * column + b * row + c,
    d * column + e * row + f,
  ];
  return [
    pixelCorner(-0.5, -0.5),
    pixelCorner(width - 0.5, -0.5),
    pixelCorner(width - 0.5, height - 0.5),
    pixelCorner(-0.5, height - 0.5),
  ];
}

export function worldFileCoordinates(transform, width, height, sourceProjection) {
  if (Math.abs(transform.b) > 1e-10 || Math.abs(transform.d) > 1e-10) {
    throw new Error("Rotated world files are not supported yet. Export a north-up image and world file.");
  }
  return worldFileNativeCorners(transform, width, height).map((coordinate) =>
    toWgs84(sourceProjection, coordinate),
  );
}

export function detectVisiblePixelBounds(
  pixelData,
  width,
  height,
  { whiteThreshold = 248, alphaThreshold = 8, margin = 0 } = {},
) {
  const data = pixelData?.data || pixelData;
  if (!data || data.length < width * height * 4) {
    throw new Error("Pixel data is incomplete for white-margin detection.");
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      const visible = alpha > alphaThreshold && (
        red < whiteThreshold || green < whiteThreshold || blue < whiteThreshold
      );
      if (!visible) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, right: width, bottom: height, width, height, trimmed: false };
  }

  const padding = Math.max(0, Math.round(Number(margin) || 0));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + 1 + padding);
  const bottom = Math.min(height, maxY + 1 + padding);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    trimmed: left > 0 || top > 0 || right < width || bottom < height,
  };
}

export function croppedWorldFileTransform(transform, left, top) {
  return {
    ...transform,
    c: transform.a * left + transform.b * top + transform.c,
    f: transform.d * left + transform.e * top + transform.f,
  };
}

function applyManualCrop(bounds, manualCrop = {}) {
  const baseWidth = bounds.width;
  const baseHeight = bounds.height;
  const leftInset = Math.round(baseWidth * clamp(manualCrop.left || 0, 0, 45) / 100);
  const rightInset = Math.round(baseWidth * clamp(manualCrop.right || 0, 0, 45) / 100);
  const topInset = Math.round(baseHeight * clamp(manualCrop.top || 0, 0, 45) / 100);
  const bottomInset = Math.round(baseHeight * clamp(manualCrop.bottom || 0, 0, 45) / 100);
  const left = bounds.left + leftInset;
  const right = bounds.right - rightInset;
  const top = bounds.top + topInset;
  const bottom = bounds.bottom - bottomInset;
  if (right - left < 2 || bottom - top < 2) {
    throw new Error("The manual crop removes the whole image. Reduce the crop percentages.");
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    trimmed: true,
  };
}

export async function trimWorldFileOverlay(
  overlay,
  {
    autoTrim = true,
    whiteThreshold = 248,
    detectionMaxDimension = 1600,
    outputMaxDimension = 4096,
    marginPixels = 8,
    manualCrop = {},
  } = {},
) {
  const image = await loadImage(overlay.dataUrl);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  let bounds = {
    left: 0,
    top: 0,
    right: sourceWidth,
    bottom: sourceHeight,
    width: sourceWidth,
    height: sourceHeight,
    trimmed: false,
  };

  if (autoTrim) {
    const detectionScale = Math.min(1, detectionMaxDimension / Math.max(sourceWidth, sourceHeight));
    const detectionWidth = Math.max(1, Math.round(sourceWidth * detectionScale));
    const detectionHeight = Math.max(1, Math.round(sourceHeight * detectionScale));
    const detectionCanvas = document.createElement("canvas");
    detectionCanvas.width = detectionWidth;
    detectionCanvas.height = detectionHeight;
    const detectionContext = detectionCanvas.getContext("2d", { willReadFrequently: true });
    detectionContext.drawImage(image, 0, 0, detectionWidth, detectionHeight);
    const detected = detectVisiblePixelBounds(
      detectionContext.getImageData(0, 0, detectionWidth, detectionHeight),
      detectionWidth,
      detectionHeight,
      { whiteThreshold, margin: Math.max(1, Math.round(marginPixels * detectionScale)) },
    );
    const scaleX = sourceWidth / detectionWidth;
    const scaleY = sourceHeight / detectionHeight;
    bounds = {
      left: Math.max(0, Math.floor(detected.left * scaleX)),
      top: Math.max(0, Math.floor(detected.top * scaleY)),
      right: Math.min(sourceWidth, Math.ceil(detected.right * scaleX)),
      bottom: Math.min(sourceHeight, Math.ceil(detected.bottom * scaleY)),
    };
    bounds.width = bounds.right - bounds.left;
    bounds.height = bounds.bottom - bounds.top;
    bounds.trimmed = bounds.left > 0 || bounds.top > 0 || bounds.right < sourceWidth || bounds.bottom < sourceHeight;
  }

  bounds = applyManualCrop(bounds, manualCrop);
  const outputScale = Math.min(1, outputMaxDimension / Math.max(bounds.width, bounds.height));
  const outputWidth = Math.max(1, Math.round(bounds.width * outputScale));
  const outputHeight = Math.max(1, Math.round(bounds.height * outputScale));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext("2d", { alpha: true });
  outputContext.drawImage(
    image,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const croppedTransform = croppedWorldFileTransform(overlay.transform, bounds.left, bounds.top);
  const coordinates = worldFileCoordinates(
    croppedTransform,
    bounds.width,
    bounds.height,
    overlay.sourceProjection,
  );
  const retainedArea = (bounds.width * bounds.height) / (sourceWidth * sourceHeight);

  return {
    ...overlay,
    dataUrl: outputCanvas.toDataURL("image/png"),
    coordinates,
    visibleCoordinates: coordinates,
    fullCoordinates: overlay.fullCoordinates || overlay.coordinates,
    cropBounds: bounds,
    retainedArea,
    trimmed: bounds.trimmed,
    displayWidth: outputWidth,
    displayHeight: outputHeight,
  };
}

function selectWorldFile(files, imageStem) {
  const list = [...files];
  return (
    list.find((file) => WORLD_EXTENSIONS.includes(extension(file.name)) && stem(file.name) === imageStem) ||
    list.find((file) => WORLD_EXTENSIONS.includes(extension(file.name))) ||
    null
  );
}

export async function readWorldFileOverlay(files, selectedCrs = "auto") {
  const list = [...(files || [])];
  const imageFile = list.find((file) => IMAGE_EXTENSIONS.includes(extension(file.name)));
  if (!imageFile) throw new Error("Select a JPG, PNG or WebP image.");
  const imageStem = stem(imageFile.name);
  const worldFile = selectWorldFile(list, imageStem);
  if (!worldFile) {
    throw new Error("Select the matching world file (.jgw, .pgw, .pngw, .jpgw or .wld) with the image.");
  }
  const prjFile = matchingPrjFile(list, imageStem);
  const prjText = prjFile ? await prjFile.text() : "";
  const sourceProjection = resolveSourceProjection(selectedCrs, prjText);
  const transform = parseWorldFile(await worldFile.text());
  const size = await readImageSize(imageFile);
  const coordinates = worldFileCoordinates(transform, size.width, size.height, sourceProjection);
  return {
    name: imageFile.name,
    dataUrl: await readAsDataUrl(imageFile),
    coordinates,
    fullCoordinates: coordinates,
    visibleCoordinates: coordinates,
    sourceCrs: selectedCrs === "auto" ? "PRJ-defined CRS" : selectedCrs,
    sourceProjection,
    transform,
    width: size.width,
    height: size.height,
    worldFileName: worldFile.name,
  };
}
