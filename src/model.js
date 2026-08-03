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

export function renumberSheets(sheets) {
  return sheets.map((sheet, index) => ({
    ...sheet,
    sheetNumber: String(index + 1).padStart(3, "0"),
  }));
}

export function fitContain(imageWidth, imageHeight, box) {
  const width = Number(imageWidth);
  const height = Number(imageHeight);
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Image dimensions must be positive.");
  }
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
  const cleaned = String(value || "")
    .replace(/^#/, "")
    .trim()
    .toUpperCase();
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
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
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
      if (row[csvKey] !== undefined && row[csvKey] !== "") {
        updated[modelKey] = row[csvKey];
      }
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
  return {
    ...DEFAULT_PROJECT,
    ...project,
    accentColor: normaliseHex(project.accentColor),
  };
}
