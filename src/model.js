import proj4 from "proj4";
import "./projection-utils.js";

export const A1 = Object.freeze({ widthMm: 841, heightMm: 594 });

export const DEFAULT_PROJECT = Object.freeze({
  projectTitle: "",
  projectAddress: "",
  projectNumber: "",
  clientName: "",
  drawnBy: "",
  designedBy: "",
  approvedBy: "",
  date: new Intl.DateTimeFormat("en-AU").format(new Date()),
  drawingStatus: "FOR INFORMATION",
  sheetPrefix: "A",
  companyName: "COMPANY NAME",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  accentColor: "245B8A",
});

export const ACCEPTED_IMAGE_EXTENSIONS = Object.freeze([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
]);

export function mm(value) {
  return Number(value) / 25.4;
}

export function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

export function titleFromFilename(filename) {
  const stem = stripExtension(filename)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem) return "Image";
  return stem.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sheetFromFile(file, index) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`,
    file,
    filename: file.name,
    sheetNumber: String(index).padStart(3, "0"),
    drawingTitle1: titleFromFilename(file.name),
    drawingTitle2: "",
    drawingTitle3: "",
    scale: "NTS",
    revision: "-",
  };
}

export function renumberSheets(sheets, startAt = 1) {
  return sheets.map((sheet, index) => ({
    ...sheet,
    sheetNumber: String(index + Number(startAt)).padStart(3, "0"),
  }));
}

export function fitContain(imageWidth, imageHeight, box) {
  const width = Number(imageWidth);
  const height = Number(imageHeight);
  if (!(width > 0) || !(height > 0)) throw new Error("Image dimensions must be positive.");
  const imageRatio = width / height;
  const boxRatio = box.w / box.h;
  let fittedWidth;
  let fittedHeight;
  if (imageRatio > boxRatio) {
    fittedWidth = box.w;
    fittedHeight = fittedWidth / imageRatio;
  } else {
    fittedHeight = box.h;
    fittedWidth = fittedHeight * imageRatio;
  }
  return {
    x: box.x + (box.w - fittedWidth) / 2,
    y: box.y + (box.h - fittedHeight) / 2,
    w: fittedWidth,
    h: fittedHeight,
  };
}

export function sanitizeFilename(value, fallback = "fieldwork-plan") {
  const safe = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return safe || fallback;
}

export function normaliseHex(value, fallback = "245B8A") {
  const cleaned = String(value || "").replace(/^#/, "").trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : fallback;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])),
  );
}

export function applyCsvRows(sheets, rows) {
  const map = {
    sheet_number: "sheetNumber",
    drawing_title_1: "drawingTitle1",
    drawing_title_2: "drawingTitle2",
    drawing_title_3: "drawingTitle3",
    scale: "scale",
    revision: "revision",
  };
  return sheets.map((sheet, index) => {
    const row = rows[index];
    if (!row) return sheet;
    const updated = { ...sheet };
    for (const [csvKey, modelKey] of Object.entries(map)) {
      if (row[csvKey] !== undefined && row[csvKey] !== "") updated[modelKey] = row[csvKey];
    }
    return updated;
  });
}

export function validateSheets(sheets) {
  const errors = [];
  const usedNumbers = new Set();
  sheets.forEach((sheet, index) => {
    const row = index + 1;
    const number = String(sheet.sheetNumber || "").trim();
    const title = String(sheet.drawingTitle1 || "").trim();
    if (!sheet.file) errors.push(`Row ${row}: an image file is required.`);
    if (!number) errors.push(`Row ${row}: sheet number is required.`);
    else if (usedNumbers.has(number)) errors.push(`Row ${row}: duplicate sheet number '${number}'.`);
    else usedNumbers.add(number);
    if (!title) errors.push(`Row ${row}: primary drawing title is required.`);
  });
  return errors;
}

export function serialisableProject(project) {
  return { ...DEFAULT_PROJECT, ...project, accentColor: normaliseHex(project.accentColor) };
}

// Source image pixels -> projected coordinates. Pixel (0,0) is the outer corner.
export function applyAffine(t, [x, y]) {
  return [t.a * x + t.b * y + t.c, t.d * x + t.e * y + t.f];
}

export function invertAffine(t) {
  const determinant = t.a * t.e - t.b * t.d;
  const scale = Math.max(Math.abs(t.a), Math.abs(t.b), Math.abs(t.d), Math.abs(t.e));
  if (!scale || Math.abs(determinant) < scale * scale * 1e-12) {
    throw new Error("The reference points produce a collapsed image. Spread the points across the plan.");
  }
  const inverse = { a: t.e / determinant, b: -t.b / determinant, d: -t.d / determinant, e: t.a / determinant };
  inverse.c = -inverse.a * t.c - inverse.b * t.f;
  inverse.f = -inverse.d * t.c - inverse.e * t.f;
  return inverse;
}

function solve(matrix, vector) {
  const rows = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let i = column + 1; i < 3; i++) if (Math.abs(rows[i][column]) > Math.abs(rows[pivot][column])) pivot = i;
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error("Reference points must not lie on one line.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let i = 0; i < 3; i++) {
      if (i === column) continue;
      const factor = rows[i][column];
      rows[i] = rows[i].map((value, j) => value - factor * rows[column][j]);
    }
  }
  return rows.map((row) => row[3]);
}

export function fitReferencePoints(controls) {
  if (controls.length < 3) throw new Error("Add at least three matching reference points.");
  if (controls.some((point) => [...point.source, ...point.target].some((value) => !Number.isFinite(value)))) {
    throw new Error("Reference coordinates must be finite numbers.");
  }
  // Centre and scale before least squares: MGA northings and large scans otherwise
  // make the normal equations poorly conditioned.
  const mean = [0, 1].map((axis) => controls.reduce((sum, p) => sum + p.source[axis], 0) / controls.length);
  const scale = Math.max(...controls.flatMap((p) => p.source.map((v, i) => Math.abs(v - mean[i]))));
  if (!scale) throw new Error("Choose distinct reference points.");
  const rows = controls.map((p) => [(p.source[0] - mean[0]) / scale, (p.source[1] - mean[1]) / scale, 1]);
  const normal = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const coefficients = [0, 1].map((axis) => solve(normal, [0, 1, 2].map((i) => rows.reduce((sum, row, j) => sum + row[i] * controls[j].target[axis], 0))));
  const [[a, b, c], [d, e, f]] = coefficients;
  const transform = { a: a / scale, b: b / scale, c: c - (a * mean[0] + b * mean[1]) / scale,
    d: d / scale, e: e / scale, f: f - (d * mean[0] + e * mean[1]) / scale };
  invertAffine(transform);
  const residuals = controls.map((p) => {
    const predicted = applyAffine(transform, p.source);
    return Math.hypot(predicted[0] - p.target[0], predicted[1] - p.target[1]);
  });
  return { transform, residuals, rms: Math.sqrt(residuals.reduce((sum, v) => sum + v * v, 0) / controls.length) };
}

export function imageCorners(width, height) {
  return [[0, 0], [width, 0], [width, height], [0, height]];
}

export function worldToPixelTransform(world) {
  const { a, b, c, d, e, f } = world;
  return { a, b, c: c - (a + b) / 2, d, e, f: f - (d + e) / 2 };
}

export function matchingSidecar(files, name, extensions) {
  const stem = name.replace(/\.[^.]+$/, "").toLowerCase();
  return [...files].find((file) => extensions.some((extension) => file.name.toLowerCase() === `${stem}${extension}`));
}

export function dxfFaceVertices(vertices = []) {
  const points = [...vertices];
  // dxf-parser 1.1.2 can append an empty fifth record to 3DFACE entities.
  // Remove only those placeholders; incomplete real coordinates still fail validation.
  while (points.length && points.at(-1) && Object.keys(points.at(-1)).length === 0) points.pop();
  return points;
}

// Contents order is top to bottom. Move relative to the target after removal,
// so dragging from either direction preserves the other layers' order.
export function reorderLayerStack(layers, movingId, targetId, after = false) {
  if (movingId === targetId) return [...layers];
  const moving = layers.find((layer) => layer.id === movingId);
  if (!moving || !layers.some((layer) => layer.id === targetId)) return [...layers];
  const result = layers.filter((layer) => layer.id !== movingId);
  const index = result.findIndex((layer) => layer.id === targetId) + (after ? 1 : 0);
  result.splice(index, 0, moving);
  return result;
}

// Stable parser paths distinguish repeated block instances. Keep edits when
// coordinates are regenerated for another source CRS.
export function dxfComponents(parsed, previous = []) {
  const edits = new Map(previous.map((item) => [item.id, item]));
  return [[parsed.features, "geometry"], [parsed.labels, "text"]].flatMap(([items, category]) =>
    items.map((item) => {
      const old = edits.get(item.id);
      return { ...item, category, visible: old?.visible ?? true, deleted: old?.deleted ?? false, style: { ...old?.style } };
    }));
}

export function dxfScopeMatches(item, scope = {}) {
  return (scope.ids == null || scope.ids.has(item.id))
    && (scope.id == null || item.id === scope.id) && (scope.layer == null || item.layer === scope.layer)
    && (scope.category == null || item.category === scope.category);
}

export function dxfComponentMatchesFilter(item, { objectType = "all", query = "" } = {}) {
  if (item.deleted) return false;
  const matchesType = objectType === "all" || (objectType === "text" ? item.category === "text"
    : objectType === "polylines" ? ["LWPOLYLINE", "POLYLINE"].includes(item.entityType)
    : item.entityType === objectType);
  const term = query.trim().toLowerCase();
  return matchesType && (!term || `${item.layer} ${item.entityType} ${item.handle} ${item.id} ${item.text || ""}`.toLowerCase().includes(term));
}

export function dxfComponentAppearance(item, settings) {
  const layer = settings.layerStyles?.get(item.layer) || {};
  const category = layer[item.category] || {};
  return {
    visible: settings.visible !== false && !item.deleted && item.visible !== false && layer.visible !== false
      && category.visible !== false && (item.category !== "text" || settings.textVisible !== false),
    color: item.style?.color ?? category.color ?? layer.color ?? settings.color ?? "#e11d48",
    weight: item.style?.weight ?? category.weight ?? layer.weight ?? settings.weight ?? 1.5,
    textSize: item.style?.textSize ?? category.textSize ?? layer.textSize ?? settings.textSize ?? 11,
  };
}

export function importedMapLocations(locations, definitions) {
  return locations.map((location) => {
    const definition = definitions[location.type];
    const longitude = Number(location.longitude), latitude = Number(location.latitude);
    if (!definition) throw new Error(`Unsupported fieldwork type '${location.type}'.`);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) throw new Error("Imported locations must have valid latitude and longitude.");
    return { id: globalThis.crypto.randomUUID(), type: location.type, longitude, latitude,
      customLabel: String(location.customLabel || "").trim(), notes: String(location.notes || ""), locked: false,
      symbol: definition.symbol, color: definition.color };
  });
}

export function rasterCropBounds(width, height, crop = {}, detected = null) {
  const bounds = detected || { left: 0, top: 0, right: width, bottom: height };
  const percent = (side) => {
    const value = Number(crop[side] || 0);
    if (!Number.isFinite(value) || value < 0 || value > 45) throw new Error("Crop percentages must be between 0 and 45.");
    return value / 100;
  };
  const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
  const left = Math.round(bounds.left + w * percent("left"));
  const top = Math.round(bounds.top + h * percent("top"));
  const right = Math.round(bounds.right - w * percent("right"));
  const bottom = Math.round(bounds.bottom - h * percent("bottom"));
  if (right - left < 2 || bottom - top < 2) throw new Error("The crop removes the whole image. Reduce the crop percentages.");
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function frameFitPadding(mapRect, frameRect, buffer = 18) {
  return {
    paddingTopLeft: [Math.max(buffer, frameRect.left - mapRect.left + buffer), Math.max(buffer, frameRect.top - mapRect.top + buffer)],
    paddingBottomRight: [Math.max(buffer, mapRect.right - frameRect.right + buffer), Math.max(buffer, mapRect.bottom - frameRect.bottom + buffer)],
  };
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
