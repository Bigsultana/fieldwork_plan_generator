import { fitContain, mm, normaliseHex } from "./model.js";
import {
  createPresentation as createEnhancedPresentation,
  downloadPresentation,
  prepareImageFile,
  prepareLogo,
  prepareSheets,
} from "./presentation-enhanced.js";

const A1_HEIGHT = 594;
const INNER_L = 12;
const INNER_R = 829;
const INNER_B = 13;
const TITLE_BLOCK_H = 58;
const TITLE_BLOCK_TOP = A1_HEIGHT - INNER_B - TITLE_BLOCK_H;
const ACCENT_H = 5;
const BODY_TOP = TITLE_BLOCK_TOP + ACCENT_H;
const BODY_H = TITLE_BLOCK_H - ACCENT_H;
const SMALL_SCHEDULE_THRESHOLD = 8;
const SCHEDULE_ROWS_PER_PAGE = 16;

const COLOURS = Object.freeze({
  black: "111827",
  white: "FFFFFF",
  darkGrey: "374151",
  midGrey: "6B7280",
  lightGrey: "D8DEE7",
  paleGrey: "F4F6F8",
});

function removeObsoleteProjectFields() {
  for (const name of ["drawingStatus", "designedBy"]) {
    document.querySelector(`[name="${name}"]`)?.closest("label")?.remove();
  }
}

if (typeof document !== "undefined") removeObsoleteProjectFields();

function cleanProject(project = {}) {
  const { drawingStatus: _drawingStatus, designedBy: _designedBy, ...cleaned } = project;
  return cleaned;
}

function addRect(pptx, slide, left, top, width, height, options = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x: mm(left),
    y: mm(top),
    w: mm(width),
    h: mm(height),
    fill: {
      color: options.fill || COLOURS.white,
      transparency: options.transparency || 0,
    },
    line: {
      color: options.lineColor || COLOURS.lightGrey,
      width: options.lineWidth ?? 0.35,
    },
  });
}

function addText(slide, text, left, top, width, height, options = {}) {
  slide.addText(String(text || ""), {
    x: mm(left),
    y: mm(top),
    w: mm(width),
    h: mm(height),
    fontFace: "Arial",
    fontSize: options.fontSize || 10,
    bold: Boolean(options.bold),
    color: options.color || COLOURS.black,
    align: options.align || "left",
    valign: options.valign || "middle",
    margin: options.margin ?? 0.8,
    fit: "shrink",
    wrap: true,
  });
}

function addField(slide, left, top, width, height, label, value, options = {}) {
  const labelH = Math.min(5.2, height * 0.38);
  addText(slide, label, left, top, width, labelH, {
    fontSize: options.labelSize || 7.2,
    bold: true,
    color: COLOURS.midGrey,
    align: options.align || "left",
    valign: "top",
    margin: 0.4,
  });
  addText(slide, value, left, top + labelH, width, height - labelH, {
    fontSize: options.valueSize || 10.2,
    bold: options.bold !== false,
    color: options.valueColor || COLOURS.black,
    align: options.align || "left",
    margin: 0.5,
  });
}

function companyName(project) {
  const value = String(project.companyName || "").trim();
  return value && value.toUpperCase() !== "COMPANY NAME" ? value : "FIELDWORK PLAN";
}

function revisionRecord(project, sheet = {}) {
  return {
    revision: String(sheet.revision || project.revision || "-").trim() || "-",
    description: String(project.revisionDescription || "").trim(),
    date: String(project.revisionDate || project.date || "").trim(),
    by: String(project.revisionBy || project.drawnBy || "").trim(),
    sheet: String(sheet.sheetNumber || "").trim(),
    status: String(project.revisionStatus || "ISSUED").trim(),
  };
}

function slideSheetRecords(project, preparedSheets, mapPlan) {
  const records = [];
  if (mapPlan?.image?.data) {
    records.push({ sheet: mapPlan.sheet, revision: revisionRecord(project, mapPlan.sheet) });
    const pointCount = mapPlan.points?.length || 0;
    if (pointCount > SMALL_SCHEDULE_THRESHOLD) {
      const pageCount = Math.ceil(pointCount / SCHEDULE_ROWS_PER_PAGE);
      for (let page = 0; page < pageCount; page += 1) {
        const sheet = {
          sheetNumber: `${mapPlan.sheet.sheetNumber}-S${page + 1}`,
          drawingTitle1: "Fieldwork Location Schedule",
          drawingTitle2: mapPlan.sheet.drawingTitle1,
          drawingTitle3: `Page ${page + 1} of ${pageCount}`,
          scale: "NTS",
          revision: mapPlan.sheet.revision || project.revision || "-",
        };
        records.push({ sheet, revision: revisionRecord(project, sheet) });
      }
    }
  }
  preparedSheets.forEach((sheet) => records.push({ sheet, revision: revisionRecord(project, sheet) }));
  return records;
}

function drawRevisionStrip(pptx, slide, project, record, left, top, width, height) {
  const accent = normaliseHex(project.accentColor);
  const widths = [20, 82, 34, 20, width - 156];
  const values = [
    ["REV", record.revision],
    ["DESCRIPTION", record.description || record.status, { align: "left", fill: COLOURS.paleGrey }],
    ["DATE", record.date],
    ["BY", record.by],
    ["SHEET", record.sheet],
  ];
  let current = left;
  values.forEach(([label, value, options = {}], index) => {
    const cellW = widths[index];
    addRect(pptx, slide, current, top, cellW, height, {
      fill: options.fill || COLOURS.white,
      lineColor: index === 0 ? accent : COLOURS.lightGrey,
      lineWidth: 0.35,
    });
    addText(slide, label, current + 0.8, top + 0.5, cellW - 1.6, 4.6, {
      fontSize: 6.8,
      bold: true,
      color: COLOURS.midGrey,
      align: options.align || "center",
      valign: "top",
      margin: 0.2,
    });
    addText(slide, value, current + 0.8, top + 4.7, cellW - 1.6, height - 5.2, {
      fontSize: index === 1 ? 8.6 : 9.2,
      bold: true,
      align: options.align || "center",
      margin: 0.3,
    });
    current += cellW;
  });
}

function drawMetadataCell(pptx, slide, left, top, width, height, label, value, fill) {
  addRect(pptx, slide, left, top, width, height, {
    fill,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.3,
  });
  addField(slide, left + 0.8, top + 0.5, width - 1.6, height - 1, label, value, {
    align: "center",
    labelSize: 6.7,
    valueSize: 9.4,
  });
}

function drawFinalTitleBlock(pptx, slide, project, sheet, record, logo) {
  const accent = normaliseHex(project.accentColor);
  const totalW = INNER_R - INNER_L;
  const companyW = 145;
  const projectW = 245;
  const drawingW = 245;
  const metaW = totalW - companyW - projectW - drawingW;
  const companyL = INNER_L;
  const projectL = companyL + companyW;
  const drawingL = projectL + projectW;
  const metaL = drawingL + drawingW;

  addRect(pptx, slide, INNER_L, TITLE_BLOCK_TOP, totalW, TITLE_BLOCK_H, {
    fill: COLOURS.white,
    lineColor: COLOURS.black,
    lineWidth: 0.65,
  });
  addRect(pptx, slide, INNER_L, TITLE_BLOCK_TOP, totalW, ACCENT_H, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });

  for (const x of [projectL, drawingL, metaL]) {
    slide.addShape(pptx.ShapeType.line, {
      x: mm(x),
      y: mm(BODY_TOP),
      w: 0,
      h: mm(BODY_H),
      line: { color: COLOURS.lightGrey, width: 0.55 },
    });
  }

  addText(slide, companyName(project), companyL + 2, TITLE_BLOCK_TOP, companyW - 4, ACCENT_H, {
    fontSize: 8.5,
    bold: true,
    color: COLOURS.white,
    margin: 0.35,
  });

  const logoW = logo?.data ? 38 : 0;
  let companyTextL = companyL + 4;
  if (logo?.data) {
    const fit = fitContain(logo.width, logo.height, {
      x: mm(companyL + 3),
      y: mm(BODY_TOP + 4),
      w: mm(logoW - 5),
      h: mm(BODY_H - 8),
    });
    slide.addImage({ data: logo.data, ...fit });
    companyTextL = companyL + logoW;
  }
  const companyTextW = companyW - (companyTextL - companyL) - 4;
  addText(slide, companyName(project), companyTextL, BODY_TOP + 3, companyTextW, 13, {
    fontSize: 15,
    bold: true,
    color: accent,
    margin: 0.4,
  });
  addText(slide, project.companyAddress, companyTextL, BODY_TOP + 16, companyTextW, 12, {
    fontSize: 9.3,
    color: COLOURS.darkGrey,
    valign: "top",
    margin: 0.4,
  });
  const contact = [project.companyPhone, project.companyEmail, project.companyWebsite]
    .filter(Boolean)
    .join("  |  ");
  addText(slide, contact, companyTextL, BODY_TOP + 29, companyTextW, 18, {
    fontSize: 8.2,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.4,
  });

  addText(slide, "PROJECT", projectL + 4, BODY_TOP + 2, projectW - 8, 5, {
    fontSize: 7.3,
    bold: true,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.3,
  });
  addText(slide, project.projectTitle || "Project title", projectL + 4, BODY_TOP + 7, projectW - 8, 14, {
    fontSize: 16,
    bold: true,
    color: accent,
    margin: 0.4,
  });
  addField(slide, projectL + 4, BODY_TOP + 22, 142, 13, "CLIENT", project.clientName, {
    valueSize: 10.5,
  });
  addField(slide, projectL + 150, BODY_TOP + 22, projectW - 154, 13, "PROJECT NO.", project.projectNumber, {
    align: "center",
    valueSize: 10.5,
  });
  addField(slide, projectL + 4, BODY_TOP + 36, projectW - 8, 14, "SITE", project.projectAddress, {
    valueSize: 9.6,
  });

  addText(slide, "DRAWING", drawingL + 4, BODY_TOP + 2, drawingW - 8, 5, {
    fontSize: 7.3,
    bold: true,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.3,
  });
  addText(slide, sheet.drawingTitle1 || "Drawing title", drawingL + 4, BODY_TOP + 7, drawingW - 8, 19, {
    fontSize: 18,
    bold: true,
    margin: 0.4,
  });
  addText(slide, sheet.drawingTitle2, drawingL + 4, BODY_TOP + 26, drawingW - 8, 12, {
    fontSize: 11.5,
    bold: true,
    color: COLOURS.darkGrey,
    margin: 0.4,
  });
  addText(slide, sheet.drawingTitle3, drawingL + 4, BODY_TOP + 38, drawingW - 8, 12, {
    fontSize: 9.6,
    color: COLOURS.midGrey,
    margin: 0.4,
  });

  const metaGridH = 35;
  const rowH = metaGridH / 2;
  drawMetadataCell(pptx, slide, metaL, BODY_TOP, metaW / 2, rowH, "DRAWN", project.drawnBy, COLOURS.white);
  drawMetadataCell(
    pptx,
    slide,
    metaL + metaW / 2,
    BODY_TOP,
    metaW / 2,
    rowH,
    "APPROVED",
    project.approvedBy,
    COLOURS.white,
  );
  const lowerCellW = metaW / 3;
  drawMetadataCell(pptx, slide, metaL, BODY_TOP + rowH, lowerCellW, rowH, "DATE", project.date, COLOURS.paleGrey);
  drawMetadataCell(
    pptx,
    slide,
    metaL + lowerCellW,
    BODY_TOP + rowH,
    lowerCellW,
    rowH,
    "SCALE @ A1",
    sheet.scale || "NTS",
    COLOURS.paleGrey,
  );
  drawMetadataCell(
    pptx,
    slide,
    metaL + lowerCellW * 2,
    BODY_TOP + rowH,
    metaW - lowerCellW * 2,
    rowH,
    "FIGURE NO.",
    `${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`,
    COLOURS.paleGrey,
  );

  drawRevisionStrip(
    pptx,
    slide,
    project,
    record,
    metaL,
    BODY_TOP + metaGridH,
    metaW,
    BODY_H - metaGridH,
  );
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const cleanedProject = cleanProject(project);
  const pptx = createEnhancedPresentation(cleanedProject, preparedSheets, logo, mapPlan);
  const slides = Array.isArray(pptx._slides) ? pptx._slides : [];
  const records = slideSheetRecords(cleanedProject, preparedSheets, mapPlan);

  slides.forEach((slide, index) => {
    const entry = records[index] || {
      sheet: { sheetNumber: "001", drawingTitle1: "Fieldwork Plan", scale: "NTS" },
      revision: revisionRecord(cleanedProject),
    };
    drawFinalTitleBlock(pptx, slide, cleanedProject, entry.sheet, entry.revision, logo);
  });
  return pptx;
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
  const pptx = createPresentation(cleanProject(project), preparedSheets, logo, mapPlan);
  const buffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return { buffer, missing: preparedSheets.filter((sheet) => !sheet.image) };
}

export { downloadPresentation, prepareImageFile, prepareLogo, prepareSheets };
