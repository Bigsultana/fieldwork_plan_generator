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
    sourceCrs: selectedCrs === "auto" ? "PRJ-defined CRS" : selectedCrs,
    width: size.width,
    height: size.height,
    worldFileName: worldFile.name,
  };
}
