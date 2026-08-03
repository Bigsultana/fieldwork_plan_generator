import pptxgen from "pptxgenjs";
import * as UTIF from "utif";
import { A1, fitContain, mm, normaliseHex, sanitizeFilename } from "./model.js";

const COLOURS = Object.freeze({
  black: "111827",
  white: "FFFFFF",
  navy: "17233B",
  darkGrey: "374151",
  midGrey: "6B7280",
  lightGrey: "E5E7EB",
  paleGrey: "F7F8FA",
  placeholder: "F3F4F6",
  placeholderLine: "C7CDD6",
  headerFill: "EAF0F6",
});

const SMALL_SCHEDULE_THRESHOLD = 8;
const PLANNING_DISCLAIMER =
  "Planning coordinates only. Verify survey control, datum and final set-out requirements before fieldwork.";

export const LAYOUT = Object.freeze({
  marginL: 6,
  marginR: 835,
  marginT: 7,
  marginB: 7,
  innerL: 12,
  innerR: 829,
  innerT: 13,
  innerB: 13,
  titleBlockH: 44,
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
    fill: options.fill
      ? { color: options.fill, transparency: options.transparency || 0 }
      : transparentFill(),
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
    fontSize: options.fontSize || 9,
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

function addField(slide, left, top, width, height, label, value, options = {}) {
  const labelHeight = Math.min(4.2, height * 0.34);
  addText(slide, label, left, top, width, labelHeight, {
    fontSize: options.labelSize || 5.8,
    color: options.labelColor || COLOURS.midGrey,
    valign: "top",
    align: options.align || "left",
    margin: 0.8,
  });
  addText(slide, value, left, top + labelHeight, width, height - labelHeight, {
    fontSize: options.valueSize || 8.5,
    bold: options.bold !== false,
    align: options.align || "left",
    margin: 0.8,
    color: options.valueColor || COLOURS.black,
  });
}

function hasRealCompanyName(value) {
  const name = String(value || "").trim();
  return Boolean(name) && name.toUpperCase() !== "COMPANY NAME";
}

function displayCompanyName(project) {
  return hasRealCompanyName(project.companyName) ? project.companyName.trim() : "FIELDWORK PLAN";
}

function drawTitleBlock(pptx, slide, project, sheet, logo) {
  const accent = normaliseHex(project.accentColor);
  addRect(
    pptx,
    slide,
    LAYOUT.marginL,
    LAYOUT.marginT,
    LAYOUT.marginR - LAYOUT.marginL,
    A1.heightMm - LAYOUT.marginT - LAYOUT.marginB,
    { lineWidth: 0.25, lineColor: COLOURS.darkGrey },
  );
  addRect(
    pptx,
    slide,
    LAYOUT.innerL,
    LAYOUT.innerT,
    LAYOUT.innerR - LAYOUT.innerL,
    A1.heightMm - LAYOUT.innerT - LAYOUT.innerB,
    { lineWidth: 0.7, lineColor: COLOURS.black },
  );

  const top = titleBlockTop;
  const height = LAYOUT.titleBlockH;
  const stripH = 4.5;
  addRect(pptx, slide, LAYOUT.innerL, top, LAYOUT.innerR - LAYOUT.innerL, height, {
    fill: COLOURS.white,
    lineWidth: 0.6,
  });
  addRect(pptx, slide, LAYOUT.innerL, top, LAYOUT.innerR - LAYOUT.innerL, stripH, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });

  const companyL = LAYOUT.innerL;
  const companyW = 150;
  const projectL = companyL + companyW;
  const projectW = 252;
  const drawingL = projectL + projectW;
  const drawingW = 242;
  const metaL = drawingL + drawingW;
  const metaW = LAYOUT.innerR - metaL;

  [projectL, drawingL, metaL].forEach((x) => {
    slide.addShape(pptx.ShapeType.line, {
      x: mm(x),
      y: mm(top + stripH),
      w: 0,
      h: mm(height - stripH),
      line: { color: COLOURS.lightGrey, width: 0.55 },
    });
  });

  addText(slide, displayCompanyName(project), companyL + 2, top, companyW - 4, stripH, {
    fontSize: 7.5,
    bold: true,
    color: COLOURS.white,
    margin: 0.5,
  });

  const bodyTop = top + stripH;
  const bodyH = height - stripH;
  const logoW = 36;
  let companyTextL = companyL + 3;
  if (logo?.data) {
    const fit = fitContain(logo.width, logo.height, {
      x: mm(companyL + 3),
      y: mm(bodyTop + 3),
      w: mm(logoW - 5),
      h: mm(bodyH - 6),
    });
    slide.addImage({ data: logo.data, ...fit });
    companyTextL = companyL + logoW;
  }
  const companyTextW = companyW - (companyTextL - companyL) - 3;
  addText(slide, displayCompanyName(project), companyTextL, bodyTop + 2, companyTextW, 10, {
    fontSize: 11.5,
    bold: true,
    color: accent,
    margin: 0.5,
  });
  addText(slide, project.companyAddress, companyTextL, bodyTop + 12, companyTextW, 10, {
    fontSize: 7,
    valign: "top",
    margin: 0.5,
    color: COLOURS.darkGrey,
  });
  const contact = [project.companyPhone, project.companyEmail, project.companyWebsite]
    .filter(Boolean)
    .join("  |  ");
  addText(slide, contact, companyTextL, bodyTop + 23, companyTextW, 11, {
    fontSize: 6.5,
    valign: "top",
    margin: 0.5,
    color: COLOURS.midGrey,
  });

  addText(slide, "PROJECT", projectL + 3, bodyTop + 1, projectW - 6, 4, {
    fontSize: 5.8,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.4,
  });
  addText(slide, project.projectTitle || "Project title", projectL + 3, bodyTop + 5, projectW - 6, 10, {
    fontSize: 11.5,
    bold: true,
    color: accent,
    margin: 0.5,
  });
  addField(slide, projectL + 3, bodyTop + 15, projectW * 0.58 - 3, 10, "CLIENT", project.clientName, {
    valueSize: 8.3,
  });
  addField(
    slide,
    projectL + projectW * 0.58,
    bodyTop + 15,
    projectW * 0.42 - 3,
    10,
    "PROJECT NO.",
    project.projectNumber,
    { align: "center", valueSize: 8.3 },
  );
  addField(slide, projectL + 3, bodyTop + 25, projectW - 6, 10, "SITE", project.projectAddress, {
    valueSize: 7.8,
  });

  addText(slide, "DRAWING", drawingL + 3, bodyTop + 1, drawingW - 6, 4, {
    fontSize: 5.8,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.4,
  });
  addText(slide, sheet.drawingTitle1 || "Drawing title", drawingL + 3, bodyTop + 5, drawingW - 6, 12, {
    fontSize: 13.5,
    bold: true,
    margin: 0.5,
  });
  addText(slide, sheet.drawingTitle2, drawingL + 3, bodyTop + 17, drawingW - 6, 8, {
    fontSize: 9,
    bold: true,
    color: COLOURS.darkGrey,
    margin: 0.5,
  });
  addText(slide, sheet.drawingTitle3, drawingL + 3, bodyTop + 25, drawingW - 6, 6, {
    fontSize: 7.5,
    color: COLOURS.midGrey,
    margin: 0.5,
  });
  addRect(pptx, slide, drawingL + 3, bodyTop + 32, drawingW - 6, 5, {
    fill: COLOURS.paleGrey,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.3,
  });
  addText(slide, project.drawingStatus || "FOR INFORMATION", drawingL + 3, bodyTop + 32, drawingW - 6, 5, {
    fontSize: 7.2,
    bold: true,
    align: "center",
    color: accent,
    margin: 0.3,
  });

  const rowH = bodyH / 3;
  const colW = metaW / 3;
  const metaFields = [
    ["DRAWN", project.drawnBy],
    ["DESIGNED", project.designedBy],
    ["APPROVED", project.approvedBy],
    ["DATE", project.date],
    ["SCALE @ A1", sheet.scale || "NTS"],
    ["FIGURE NO.", `${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`],
    ["REVISION", sheet.revision || "-"],
    ["STATUS", project.drawingStatus || "FOR INFORMATION"],
    ["SHEET", sheet.sheetNumber || "001"],
  ];
  metaFields.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const left = metaL + col * colW;
    const fieldTop = bodyTop + row * rowH;
    addRect(pptx, slide, left, fieldTop, colW, rowH, {
      lineWidth: 0.3,
      lineColor: COLOURS.lightGrey,
      fill: row % 2 === 0 ? COLOURS.white : COLOURS.paleGrey,
    });
    addField(slide, left + 1, fieldTop + 0.5, colW - 2, rowH - 1, label, value, {
      align: "center",
      valueSize: label === "STATUS" ? 6.8 : 8.2,
      labelSize: 5.4,
    });
  });

  const status = String(project.drawingStatus || "").toUpperCase();
  if (status.includes("DRAFT") || status.includes("NOT FOR CONSTRUCTION")) {
    addText(
      slide,
      "DRAFT",
      LAYOUT.innerL + (LAYOUT.innerR - LAYOUT.innerL) * 0.3,
      LAYOUT.innerT + (titleBlockTop - LAYOUT.innerT) * 0.4,
      (LAYOUT.innerR - LAYOUT.innerL) * 0.4,
      35,
      {
        fontSize: 64,
        bold: true,
        color: COLOURS.lightGrey,
        align: "center",
      },
    );
  }
}

function drawMissingPlaceholder(pptx, slide, sheet, reason) {
  slide.addShape(pptx.ShapeType.rect, {
    ...contentBox,
    fill: { color: COLOURS.placeholder },
    line: { color: COLOURS.placeholderLine, width: 0.8 },
  });
  slide.addText(`[ ${sheet.drawingTitle1 || "Image"} ]\n${reason}`, {
    ...contentBox,
    fontFace: "Arial",
    fontSize: 18,
    bold: true,
    color: COLOURS.midGrey,
    align: "center",
    valign: "middle",
    margin: 8,
    fit: "shrink",
  });
}

function addBlankSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOURS.white };
  return slide;
}

function drawDisclaimerBand(pptx, slide, left, top, width, text = PLANNING_DISCLAIMER) {
  addRect(pptx, slide, left, top, width, 6.5, {
    fill: COLOURS.white,
    transparency: 8,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.35,
  });
  addText(slide, text, left + 2, top + 0.5, width - 4, 5.5, {
    fontSize: 6.5,
    color: COLOURS.darkGrey,
    margin: 0.4,
  });
}

function drawMapCoordinateInset(pptx, slide, project, mapPlan) {
  const points = mapPlan.points || [];
  if (!points.length) {
    drawDisclaimerBand(pptx, slide, LAYOUT.innerL + 8, LAYOUT.innerT + 8, 300);
    return;
  }

  const accent = normaliseHex(project.accentColor);
  const columns = [
    ["ID", 30],
    ["TYPE", 62],
    ["ZONE", 42],
    ["EASTING", 55],
    ["NORTHING", 65],
    ["NOTES", 66],
  ];
  const width = columns.reduce((sum, [, columnWidth]) => sum + columnWidth, 0);
  const titleH = 7;
  const headerH = 7;
  const rowH = 8.5;
  const disclaimerH = 7;
  const height = titleH + headerH + points.length * rowH + disclaimerH;
  const left = LAYOUT.innerL + 8;
  const top = LAYOUT.innerT + 8;

  addRect(pptx, slide, left, top, width, height, {
    fill: COLOURS.white,
    transparency: 6,
    lineColor: accent,
    lineWidth: 0.8,
  });
  addRect(pptx, slide, left, top, width, titleH, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });
  addText(slide, "FIELDWORK COORDINATE SUMMARY", left + 2, top, width - 4, titleH, {
    fontSize: 7.5,
    bold: true,
    color: COLOURS.white,
    margin: 0.5,
  });

  let currentLeft = left;
  columns.forEach(([label, columnWidth]) => {
    addRect(pptx, slide, currentLeft, top + titleH, columnWidth, headerH, {
      fill: COLOURS.headerFill,
      lineColor: COLOURS.lightGrey,
      lineWidth: 0.3,
    });
    addText(slide, label, currentLeft, top + titleH, columnWidth, headerH, {
      fontSize: 6.2,
      bold: true,
      align: "center",
      margin: 0.4,
      color: COLOURS.darkGrey,
    });
    currentLeft += columnWidth;
  });

  points.forEach((point, rowIndex) => {
    const values = [
      point.label,
      point.typeName,
      `MGA ${point.zone}`,
      point.eastingText,
      point.northingText,
      point.notes || "",
    ];
    currentLeft = left;
    values.forEach((value, columnIndex) => {
      const columnWidth = columns[columnIndex][1];
      const rowTop = top + titleH + headerH + rowIndex * rowH;
      addRect(pptx, slide, currentLeft, rowTop, columnWidth, rowH, {
        fill: rowIndex % 2 === 0 ? COLOURS.white : COLOURS.paleGrey,
        transparency: 5,
        lineColor: COLOURS.lightGrey,
        lineWidth: 0.25,
      });
      addText(slide, value, currentLeft, rowTop, columnWidth, rowH, {
        fontSize: columnIndex === 5 ? 6.3 : 6.8,
        bold: columnIndex === 0,
        align: columnIndex >= 2 && columnIndex <= 4 ? "center" : "left",
        margin: 0.5,
      });
      currentLeft += columnWidth;
    });
  });

  addText(
    slide,
    PLANNING_DISCLAIMER,
    left + 2,
    top + height - disclaimerH,
    width - 4,
    disclaimerH,
    { fontSize: 5.8, color: COLOURS.darkGrey, margin: 0.4 },
  );
}

function drawMapPlan(pptx, project, mapPlan, logo) {
  const slide = addBlankSlide(pptx);
  slide.addImage({ data: mapPlan.image.data, ...contentBox });
  const points = mapPlan.points || [];
  if (points.length <= SMALL_SCHEDULE_THRESHOLD) {
    drawMapCoordinateInset(pptx, slide, project, mapPlan);
  } else {
    drawDisclaimerBand(pptx, slide, LAYOUT.innerL + 8, LAYOUT.innerT + 8, 320);
  }
  drawTitleBlock(pptx, slide, project, mapPlan.sheet, logo);
}

function drawCoordinateSchedule(pptx, project, mapPlan, logo) {
  const points = mapPlan.points || [];
  if (points.length <= SMALL_SCHEDULE_THRESHOLD) return;

  const rowsPerPage = 16;
  const pageCount = Math.ceil(points.length / rowsPerPage);
  const columns = [
    ["ID", 42],
    ["Type", 85],
    ["Latitude", 90],
    ["Longitude", 90],
    ["MGA Zone", 75],
    ["Easting (m)", 90],
    ["Northing (m)", 100],
    ["Notes", 245],
  ];
  const accent = normaliseHex(project.accentColor);
  const titleTop = LAYOUT.innerT + 2;
  const titleH = 12;
  const subtitleH = 7;
  const headerTop = titleTop + titleH + subtitleH + 4;
  const headerH = 12;
  const disclaimerTop = titleBlockTop - 10;

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
    addText(
      slide,
      "PROPOSED FIELDWORK LOCATION COORDINATES",
      LAYOUT.innerL,
      titleTop,
      LAYOUT.innerR - LAYOUT.innerL,
      titleH,
      { fontSize: 18, bold: true, color: accent, margin: 0.5 },
    );
    addText(
      slide,
      `${project.projectTitle || "Project"}  ·  ${project.projectAddress || "Site address not entered"}`,
      LAYOUT.innerL,
      titleTop + titleH,
      LAYOUT.innerR - LAYOUT.innerL,
      subtitleH,
      { fontSize: 8.5, color: COLOURS.midGrey, margin: 0.5 },
    );

    let left = LAYOUT.innerL;
    columns.forEach(([label, width]) => {
      addRect(pptx, slide, left, headerTop, width, headerH, {
        fill: COLOURS.headerFill,
        lineColor: COLOURS.lightGrey,
        lineWidth: 0.45,
      });
      addText(slide, label, left, headerTop, width, headerH, {
        fontSize: 8.5,
        bold: true,
        align: "center",
        margin: 0.8,
        color: COLOURS.darkGrey,
      });
      left += width;
    });

    const pageRows = points.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    const availableHeight = disclaimerTop - (headerTop + headerH) - 4;
    const rowH = Math.max(18, Math.min(28, availableHeight / Math.max(pageRows.length, 12)));
    pageRows.forEach((point, rowIndex) => {
      const values = [
        point.label,
        point.typeName,
        point.latitudeText,
        point.longitudeText,
        `MGA2020 / ${point.zone}`,
        point.eastingText,
        point.northingText,
        point.notes || "",
      ];
      let cellLeft = LAYOUT.innerL;
      const top = headerTop + headerH + rowIndex * rowH;
      values.forEach((value, columnIndex) => {
        const width = columns[columnIndex][1];
        addRect(pptx, slide, cellLeft, top, width, rowH, {
          fill: rowIndex % 2 === 0 ? COLOURS.white : COLOURS.paleGrey,
          lineColor: COLOURS.lightGrey,
          lineWidth: 0.3,
        });
        addText(slide, value, cellLeft, top, width, rowH, {
          fontSize: columnIndex === 7 ? 8.2 : 9.2,
          bold: columnIndex === 0,
          align: columnIndex >= 2 && columnIndex <= 6 ? "center" : "left",
          margin: 1.2,
        });
        cellLeft += width;
      });
    });

    drawDisclaimerBand(
      pptx,
      slide,
      LAYOUT.innerL,
      disclaimerTop,
      LAYOUT.innerR - LAYOUT.innerL,
    );
    drawTitleBlock(pptx, slide, project, scheduleSheet, logo);
  }
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const pptx = new pptxgen();
  pptx.defineLayout({
    name: "A1_LANDSCAPE",
    width: mm(A1.widthMm),
    height: mm(A1.heightMm),
  });
  pptx.layout = "A1_LANDSCAPE";
  pptx.author = project.drawnBy || project.companyName || "Fieldwork Plan Generator";
  pptx.company = hasRealCompanyName(project.companyName) ? project.companyName : "";
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
    addRect(
      pptx,
      slide,
      LAYOUT.innerL,
      LAYOUT.innerT,
      LAYOUT.innerR - LAYOUT.innerL,
      titleBlockTop - LAYOUT.innerT,
      { fill: COLOURS.paleGrey, lineColor: COLOURS.lightGrey, lineWidth: 0.35 },
    );
    if (sheet.image?.data && sheet.image.width > 0 && sheet.image.height > 0) {
      const fit = fitContain(sheet.image.width, sheet.image.height, contentBox);
      slide.addImage({ data: sheet.image.data, ...fit });
    } else {
      drawMissingPlaceholder(
        pptx,
        slide,
        sheet,
        sheet.imageError || "Unable to read image",
      );
    }
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
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
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
  context.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), frame.width, frame.height),
    0,
    0,
  );
  return {
    data: canvas.toDataURL("image/png"),
    width: frame.width,
    height: frame.height,
  };
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

export async function generatePresentation(
  project,
  sheets,
  logoFile,
  onProgress = () => {},
  mapPlan = null,
) {
  const preparedSheets = await prepareSheets(sheets, onProgress);
  const logo = await prepareLogo(logoFile);
  onProgress(
    Math.max(sheets.length, 1),
    Math.max(sheets.length, 1),
    "Building PowerPoint",
  );
  const pptx = createPresentation(project, preparedSheets, logo, mapPlan);
  const buffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return { buffer, missing: preparedSheets.filter((sheet) => !sheet.image) };
}

export function downloadPresentation(buffer, project) {
  const projectPart = sanitizeFilename(
    project.projectNumber || project.projectTitle || "fieldwork-plan",
  );
  const filename = `${projectPart}-fieldwork-plan.pptx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
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
