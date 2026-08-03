import pptxgen from "pptxgenjs";
import * as UTIF from "utif";
import { A1, fitContain, mm, normaliseHex, sanitizeFilename } from "./model.js";

const COLOURS = Object.freeze({
  black: "000000",
  white: "FFFFFF",
  darkGrey: "404040",
  midGrey: "808080",
  lightGrey: "EEEEEE",
  placeholder: "F3F3F3",
  placeholderLine: "C8C8C8",
  headerFill: "E8EEF5",
});

export const LAYOUT = Object.freeze({
  marginL: 6,
  marginR: 835,
  marginT: 7,
  marginB: 7,
  innerL: 12,
  innerR: 829,
  innerT: 13,
  innerB: 13,
  titleBlockH: 52,
});

const titleBlockTop = A1.heightMm - LAYOUT.innerB - LAYOUT.titleBlockH;
export const contentBox = Object.freeze({
  x: mm(LAYOUT.innerL),
  y: mm(LAYOUT.innerT),
  w: mm(LAYOUT.innerR - LAYOUT.innerL),
  h: mm(titleBlockTop - LAYOUT.innerT),
});

function transparentFill() {
  return { color: COLOURS.white, transparency: 100 };
}

function addRect(pptx, slide, left, top, width, height, options = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x: mm(left),
    y: mm(top),
    w: mm(width),
    h: mm(height),
    fill: options.fill ? { color: options.fill, transparency: options.transparency || 0 } : transparentFill(),
    line: {
      color: options.lineColor || COLOURS.black,
      width: options.lineWidth ?? 0.5,
      transparency: options.lineTransparency ?? 0,
    },
  });
}

function addText(slide, text, left, top, width, height, options = {}) {
  slide.addText(String(text || ""), {
    x: mm(left),
    y: mm(top),
    w: mm(width),
    h: mm(height),
    fontFace: options.fontFace || "Arial",
    fontSize: options.fontSize || 8,
    bold: Boolean(options.bold),
    color: options.color || COLOURS.black,
    align: options.align || "left",
    valign: options.valign || "middle",
    margin: options.margin ?? 1.5,
    fit: options.fit || "shrink",
    breakLine: false,
    wrap: true,
    rotate: options.rotate || 0,
    transparency: options.transparency || 0,
  });
}

function addField(slide, left, top, width, height, label, value, align = "center") {
  const labelHeight = Math.min(4.5, height * 0.34);
  addText(slide, label, left, top, width, labelHeight, {
    fontSize: 6,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 1,
  });
  addText(slide, value, left, top + labelHeight, width, height - labelHeight, {
    fontSize: 9,
    bold: true,
    align,
    margin: 1,
  });
}

function drawTitleBlock(pptx, slide, project, sheet, logo) {
  const accent = normaliseHex(project.accentColor);
  addRect(pptx, slide, LAYOUT.marginL, LAYOUT.marginT, LAYOUT.marginR - LAYOUT.marginL, A1.heightMm - LAYOUT.marginT - LAYOUT.marginB, { lineWidth: 0.25 });
  addRect(pptx, slide, LAYOUT.innerL, LAYOUT.innerT, LAYOUT.innerR - LAYOUT.innerL, A1.heightMm - LAYOUT.innerT - LAYOUT.innerB, { lineWidth: 0.75 });

  const top = titleBlockTop;
  const height = LAYOUT.titleBlockH;
  addRect(pptx, slide, LAYOUT.innerL, top, LAYOUT.innerR - LAYOUT.innerL, height, { fill: COLOURS.white, lineWidth: 0.6 });

  const companyL = LAYOUT.innerL;
  const companyW = 158;
  const projectL = companyL + companyW;
  const projectW = 240;
  const drawingL = projectL + projectW;
  const drawingW = 230;
  const metaL = drawingL + drawingW;
  const metaW = LAYOUT.innerR - metaL;

  [projectL, drawingL, metaL].forEach((x) => {
    slide.addShape(pptx.ShapeType.line, {
      x: mm(x), y: mm(top), w: 0, h: mm(height), line: { color: COLOURS.black, width: 0.4 },
    });
  });

  const logoW = 46;
  let companyTextL = companyL + 2;
  if (logo?.data) {
    const fit = fitContain(logo.width, logo.height, { x: mm(companyL + 3), y: mm(top + 4), w: mm(logoW - 6), h: mm(height - 8) });
    slide.addImage({ data: logo.data, ...fit });
    companyTextL = companyL + logoW;
  }
  const companyTextW = companyW - (companyTextL - companyL) - 2;
  addText(slide, project.companyName || "COMPANY NAME", companyTextL, top + 3, companyTextW, 13, { fontSize: 13, bold: true, color: accent });
  addText(slide, project.companyAddress, companyTextL, top + 17, companyTextW, 15, { fontSize: 7.2, valign: "top" });
  const contact = [project.companyPhone, project.companyEmail, project.companyWebsite].filter(Boolean).join("  |  ");
  addText(slide, contact, companyTextL, top + 33, companyTextW, 12, { fontSize: 6.5 });

  addText(slide, "PROJECT", projectL + 1, top + 1, projectW - 2, 4, { fontSize: 6, color: COLOURS.midGrey, valign: "top" });
  addText(slide, project.projectTitle || "PROJECT TITLE", projectL + 1, top + 5, projectW - 2, 15, { fontSize: 12, bold: true, color: accent });
  addField(slide, projectL, top + 21, projectW * 0.56, 15, "Client", project.clientName, "left");
  addField(slide, projectL + projectW * 0.56, top + 21, projectW * 0.44, 15, "Project No.", project.projectNumber);
  addField(slide, projectL, top + 36, projectW, 16, "Address", project.projectAddress, "left");

  addText(slide, "DRAWING TITLE", drawingL + 1, top + 1, drawingW - 2, 4, { fontSize: 6, color: COLOURS.midGrey, valign: "top" });
  addText(slide, sheet.drawingTitle1 || "DRAWING TITLE", drawingL + 1, top + 5, drawingW - 2, 18, { fontSize: 14, bold: true });
  addText(slide, sheet.drawingTitle2, drawingL + 1, top + 23, drawingW - 2, 12, { fontSize: 9.5, bold: true });
  addText(slide, sheet.drawingTitle3, drawingL + 1, top + 35, drawingW - 2, 10, { fontSize: 8 });
  addField(slide, drawingL, top + 45, drawingW, 7, "Drawing Status", project.drawingStatus);

  const rowH = height / 3;
  const colW = metaW / 3;
  const metaFields = [
    ["Drawn", project.drawnBy], ["Designed", project.designedBy], ["Approved", project.approvedBy],
    ["Date", project.date], ["Scale @ A1", sheet.scale || "NTS"], ["Figure No.", `${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`],
    ["Revision", sheet.revision || "-"], ["Status", project.drawingStatus || "FOR INFORMATION"], ["Sheet", sheet.sheetNumber || "001"],
  ];
  metaFields.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const left = metaL + col * colW;
    const fieldTop = top + row * rowH;
    addRect(pptx, slide, left, fieldTop, colW, rowH, { lineWidth: 0.35 });
    addField(slide, left, fieldTop, colW, rowH, label, value);
  });

  const status = String(project.drawingStatus || "").toUpperCase();
  if (status.includes("DRAFT") || status.includes("NOT FOR CONSTRUCTION")) {
    addText(slide, "DRAFT", LAYOUT.innerL + (LAYOUT.innerR - LAYOUT.innerL) * 0.3, LAYOUT.innerT + (titleBlockTop - LAYOUT.innerT) * 0.4, (LAYOUT.innerR - LAYOUT.innerL) * 0.4, 35, {
      fontSize: 64, bold: true, color: COLOURS.lightGrey, align: "center",
    });
  }
}

function drawMissingPlaceholder(pptx, slide, sheet, reason) {
  slide.addShape(pptx.ShapeType.rect, { ...contentBox, fill: { color: COLOURS.placeholder }, line: { color: COLOURS.placeholderLine, width: 0.8 } });
  slide.addText(`[ ${sheet.drawingTitle1 || "Image"} ]\n${reason}`, { ...contentBox, fontFace: "Arial", fontSize: 18, bold: true, color: COLOURS.midGrey, align: "center", valign: "middle", margin: 8, fit: "shrink" });
}

function addBlankSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOURS.white };
  return slide;
}

function drawMapPlan(pptx, project, mapPlan, logo) {
  const slide = addBlankSlide(pptx);
  slide.addImage({ data: mapPlan.image.data, ...contentBox });
  drawTitleBlock(pptx, slide, project, mapPlan.sheet, logo);
}

function drawCoordinateSchedule(pptx, project, mapPlan, logo) {
  const rowsPerPage = 25;
  const points = mapPlan.points || [];
  if (!points.length) return;
  const pageCount = Math.ceil(points.length / rowsPerPage);
  const columns = [
    ["ID", 48], ["Type", 100], ["Latitude", 92], ["Longitude", 92], ["MGA Zone", 62], ["Easting (m)", 102], ["Northing (m)", 112], ["Notes", 209],
  ];
  const headerTop = LAYOUT.innerT + 16;
  const headerH = 14;
  const rowH = 18;

  for (let page = 0; page < pageCount; page += 1) {
    const scheduleSheet = {
      sheetNumber: `${mapPlan.sheet.sheetNumber}-S${page + 1}`,
      drawingTitle1: "Fieldwork Location Schedule",
      drawingTitle2: mapPlan.sheet.drawingTitle1,
      drawingTitle3: `Page ${page + 1} of ${pageCount}`,
      scale: "NTS",
      revision: mapPlan.sheet.revision || "-",
    };
    const slide = addBlankSlide(pptx);
    addText(slide, "PROPOSED FIELDWORK LOCATION COORDINATES", LAYOUT.innerL, LAYOUT.innerT, LAYOUT.innerR - LAYOUT.innerL, 12, { fontSize: 16, bold: true, color: normaliseHex(project.accentColor) });
    let left = LAYOUT.innerL;
    columns.forEach(([label, width]) => {
      addRect(pptx, slide, left, headerTop, width, headerH, { fill: COLOURS.headerFill, lineWidth: 0.5 });
      addText(slide, label, left, headerTop, width, headerH, { fontSize: 8, bold: true, align: "center", margin: 1 });
      left += width;
    });

    const pageRows = points.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    pageRows.forEach((point, rowIndex) => {
      const values = [point.label, point.typeName, point.latitudeText, point.longitudeText, `MGA2020 / ${point.zone}`, point.eastingText, point.northingText, point.notes || ""];
      let cellLeft = LAYOUT.innerL;
      const top = headerTop + headerH + rowIndex * rowH;
      values.forEach((value, columnIndex) => {
        const width = columns[columnIndex][1];
        addRect(pptx, slide, cellLeft, top, width, rowH, { lineWidth: 0.35 });
        addText(slide, value, cellLeft, top, width, rowH, { fontSize: columnIndex === 7 ? 7.2 : 8, align: columnIndex >= 2 && columnIndex <= 6 ? "center" : "left", margin: 1.2 });
        cellLeft += width;
      });
    });
    addText(slide, "Coordinates are planning coordinates derived from map placement. Verify survey control, datum and final set-out requirements before fieldwork.", LAYOUT.innerL, titleBlockTop - 11, LAYOUT.innerR - LAYOUT.innerL, 9, { fontSize: 7, color: COLOURS.midGrey, align: "left" });
    drawTitleBlock(pptx, slide, project, scheduleSheet, logo);
  }
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "A1_LANDSCAPE", width: mm(A1.widthMm), height: mm(A1.heightMm) });
  pptx.layout = "A1_LANDSCAPE";
  pptx.author = project.drawnBy || project.companyName || "Fieldwork Plan Generator";
  pptx.company = project.companyName || "";
  pptx.subject = "Fieldwork plan";
  pptx.title = project.projectTitle || "Fieldwork Plan";
  pptx.lang = "en-AU";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-AU" };

  if (mapPlan?.image?.data) {
    drawMapPlan(pptx, project, mapPlan, logo);
    drawCoordinateSchedule(pptx, project, mapPlan, logo);
  }

  preparedSheets.forEach((sheet) => {
    const slide = addBlankSlide(pptx);
    if (sheet.image?.data && sheet.image.width > 0 && sheet.image.height > 0) {
      const fit = fitContain(sheet.image.width, sheet.image.height, contentBox);
      slide.addImage({ data: sheet.image.data, ...fit });
    } else drawMissingPlaceholder(pptx, slide, sheet, sheet.imageError || "Unable to read image");
    drawTitleBlock(pptx, slide, project, sheet, logo);
  });
  return pptx;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("The browser could not decode this image."));
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = dataUrl;
  });
}

async function decodeTiff(file) {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error("No TIFF image frame was found.");
  const frame = ifds[0];
  UTIF.decodeImage(buffer, frame);
  const rgba = UTIF.toRGBA8(frame);
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas image conversion is unavailable.");
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), frame.width, frame.height), 0, 0);
  return { data: canvas.toDataURL("image/png"), width: frame.width, height: frame.height };
}

export async function prepareImageFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return decodeTiff(file);
  const data = await fileToDataUrl(file);
  const dimensions = await loadImageDimensions(data);
  return { data, ...dimensions };
}

export async function prepareSheets(sheets, onProgress = () => {}) {
  const prepared = [];
  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index];
    onProgress(index + 1, sheets.length, `Reading ${sheet.filename}`);
    try {
      const image = await prepareImageFile(sheet.file);
      prepared.push({ ...sheet, image });
    } catch (error) {
      prepared.push({ ...sheet, image: null, imageError: error.message });
    }
  }
  return prepared;
}

export async function prepareLogo(file) {
  if (!file) return null;
  return prepareImageFile(file);
}

export async function generatePresentation(project, sheets, logoFile, onProgress = () => {}, mapPlan = null) {
  const preparedSheets = await prepareSheets(sheets, onProgress);
  const logo = await prepareLogo(logoFile);
  onProgress(Math.max(sheets.length, 1), Math.max(sheets.length, 1), "Building PowerPoint");
  const pptx = createPresentation(project, preparedSheets, logo, mapPlan);
  const buffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return { buffer, missing: preparedSheets.filter((sheet) => !sheet.image) };
}

export function downloadPresentation(buffer, project) {
  const projectPart = sanitizeFilename(project.projectNumber || project.projectTitle || "fieldwork-plan");
  const filename = `${projectPart}-fieldwork-plan.pptx`;
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
