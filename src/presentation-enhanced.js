import { fitContain, mm, normaliseHex } from "./model.js";
import {
  createPresentation as createBasePresentation,
  downloadPresentation,
  prepareImageFile,
  prepareLogo,
  prepareSheets,
} from "./presentation.js";

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
const PLANNING_DISCLAIMER =
  "Planning coordinates only. Verify survey control, datum and final set-out requirements before fieldwork.";

const COLOURS = Object.freeze({
  black: "111827",
  white: "FFFFFF",
  navy: "17233B",
  darkGrey: "374151",
  midGrey: "6B7280",
  lightGrey: "D8DEE7",
  paleGrey: "F4F6F8",
  headerFill: "E8EEF5",
});

function installRevisionFields() {
  const form = document.querySelector("#generator-form");
  const companyDetails = document.querySelector(".company-details");
  if (!form || !companyDetails || form.querySelector("[name='revisionDescription']")) return;

  const details = document.createElement("details");
  details.className = "company-details revision-details";
  details.innerHTML = `
    <summary>Revision and issue details</summary>
    <div class="form-grid three detail-grid">
      <label>Revision<input name="revision" value="-" maxlength="8" autocomplete="off" /></label>
      <label class="span-two">Revision description<input name="revisionDescription" placeholder="e.g. Initial issue for fieldwork" maxlength="80" autocomplete="off" /></label>
      <label>Revision date<input name="revisionDate" placeholder="Uses drawing date when blank" autocomplete="off" /></label>
      <label>Revision by<input name="revisionBy" placeholder="Uses Drawn by when blank" maxlength="12" autocomplete="off" /></label>
      <label>Revision status<select name="revisionStatus">
        <option value="ISSUED">ISSUED</option>
        <option value="REVISED">REVISED</option>
        <option value="SUPERSEDED">SUPERSEDED</option>
      </select></label>
    </div>`;
  companyDetails.before(details);
}

if (typeof document !== "undefined") installRevisionFields();

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
    records.push({ sheet: mapPlan.sheet, revision: revisionRecord(project, mapPlan.sheet), kind: "map" });
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
        records.push({ sheet, revision: revisionRecord(project, sheet), kind: "schedule" });
      }
    }
  }
  preparedSheets.forEach((sheet) =>
    records.push({ sheet, revision: revisionRecord(project, sheet), kind: "supporting" }),
  );
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

function drawReadableTitleBlock(pptx, slide, project, sheet, record, logo) {
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
  addText(slide, sheet.drawingTitle1 || "Drawing title", drawingL + 4, BODY_TOP + 7, drawingW - 8, 16, {
    fontSize: 17.5,
    bold: true,
    margin: 0.4,
  });
  addText(slide, sheet.drawingTitle2, drawingL + 4, BODY_TOP + 23, drawingW - 8, 10, {
    fontSize: 11.2,
    bold: true,
    color: COLOURS.darkGrey,
    margin: 0.4,
  });
  addText(slide, sheet.drawingTitle3, drawingL + 4, BODY_TOP + 33, drawingW - 8, 8, {
    fontSize: 9.2,
    color: COLOURS.midGrey,
    margin: 0.4,
  });
  addRect(pptx, slide, drawingL + 4, BODY_TOP + 42, drawingW - 8, 8, {
    fill: COLOURS.paleGrey,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.3,
  });
  addText(slide, project.drawingStatus || "FOR INFORMATION", drawingL + 4, BODY_TOP + 42, drawingW - 8, 8, {
    fontSize: 9.2,
    bold: true,
    color: accent,
    align: "center",
    margin: 0.3,
  });

  const metaGridH = 35;
  const cellW = metaW / 3;
  const cellH = metaGridH / 2;
  const fields = [
    ["DRAWN", project.drawnBy],
    ["DESIGNED", project.designedBy],
    ["APPROVED", project.approvedBy],
    ["DATE", project.date],
    ["SCALE @ A1", sheet.scale || "NTS"],
    ["FIGURE NO.", `${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`],
  ];
  fields.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const left = metaL + col * cellW;
    const top = BODY_TOP + row * cellH;
    addRect(pptx, slide, left, top, cellW, cellH, {
      fill: row === 0 ? COLOURS.white : COLOURS.paleGrey,
      lineColor: COLOURS.lightGrey,
      lineWidth: 0.3,
    });
    addField(slide, left + 0.8, top + 0.5, cellW - 1.6, cellH - 1, label, value, {
      align: "center",
      labelSize: 6.7,
      valueSize: 9.4,
    });
  });

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

function drawReadableCoordinateInset(pptx, slide, project, mapPlan) {
  const points = mapPlan.points || [];
  const accent = normaliseHex(project.accentColor);
  const left = INNER_L + 8;
  const top = 21;

  if (!points.length) {
    addRect(pptx, slide, left, top, 430, 12, {
      fill: COLOURS.white,
      transparency: 4,
      lineColor: accent,
      lineWidth: 0.7,
    });
    addText(slide, PLANNING_DISCLAIMER, left + 3, top + 1, 424, 10, {
      fontSize: 8.2,
      color: COLOURS.darkGrey,
      margin: 0.5,
    });
    return;
  }

  const columns = [
    ["ID", 40],
    ["TYPE", 78],
    ["ZONE", 55],
    ["EASTING", 70],
    ["NORTHING", 80],
    ["NOTES", 107],
  ];
  const width = columns.reduce((sum, [, columnWidth]) => sum + columnWidth, 0);
  const titleH = 10;
  const headerH = 10;
  const rowH = 12;
  const disclaimerH = 10;
  const height = titleH + headerH + points.length * rowH + disclaimerH;

  addRect(pptx, slide, left, top, width, height, {
    fill: COLOURS.white,
    transparency: 3,
    lineColor: accent,
    lineWidth: 0.9,
  });
  addRect(pptx, slide, left, top, width, titleH, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });
  addText(slide, "FIELDWORK COORDINATE SUMMARY", left + 3, top, width - 6, titleH, {
    fontSize: 10.5,
    bold: true,
    color: COLOURS.white,
    margin: 0.5,
  });

  let currentLeft = left;
  columns.forEach(([label, columnWidth]) => {
    addRect(pptx, slide, currentLeft, top + titleH, columnWidth, headerH, {
      fill: COLOURS.headerFill,
      lineColor: COLOURS.lightGrey,
      lineWidth: 0.35,
    });
    addText(slide, label, currentLeft, top + titleH, columnWidth, headerH, {
      fontSize: 8.5,
      bold: true,
      align: "center",
      color: COLOURS.darkGrey,
      margin: 0.4,
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
        transparency: 2,
        lineColor: COLOURS.lightGrey,
        lineWidth: 0.3,
      });
      addText(slide, value, currentLeft, rowTop, columnWidth, rowH, {
        fontSize: columnIndex === 5 ? 8.8 : 9.5,
        bold: columnIndex === 0,
        align: columnIndex >= 2 && columnIndex <= 4 ? "center" : "left",
        margin: 0.7,
      });
      currentLeft += columnWidth;
    });
  });

  addText(slide, PLANNING_DISCLAIMER, left + 3, top + height - disclaimerH, width - 6, disclaimerH, {
    fontSize: 7.8,
    color: COLOURS.darkGrey,
    margin: 0.5,
  });
}

function drawReadableDisclaimer(pptx, slide, project) {
  const accent = normaliseHex(project.accentColor);
  const left = INNER_L + 8;
  const top = 21;
  addRect(pptx, slide, left, top, 430, 12, {
    fill: COLOURS.white,
    transparency: 4,
    lineColor: accent,
    lineWidth: 0.7,
  });
  addText(slide, PLANNING_DISCLAIMER, left + 3, top + 1, 424, 10, {
    fontSize: 8.2,
    color: COLOURS.darkGrey,
    margin: 0.5,
  });
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const pptx = createBasePresentation(project, preparedSheets, logo, mapPlan);
  const slides = Array.isArray(pptx._slides) ? pptx._slides : [];
  const records = slideSheetRecords(project, preparedSheets, mapPlan);

  slides.forEach((slide, index) => {
    const entry = records[index] || {
      sheet: { sheetNumber: "001", drawingTitle1: "Fieldwork Plan", scale: "NTS" },
      revision: revisionRecord(project),
      kind: "supporting",
    };
    drawReadableTitleBlock(pptx, slide, project, entry.sheet, entry.revision, logo);
  });

  if (mapPlan?.image?.data && slides[0]) {
    if ((mapPlan.points || []).length <= SMALL_SCHEDULE_THRESHOLD) {
      drawReadableCoordinateInset(pptx, slides[0], project, mapPlan);
    } else {
      drawReadableDisclaimer(pptx, slides[0], project);
    }
  }
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
  const pptx = createPresentation(project, preparedSheets, logo, mapPlan);
  const buffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return { buffer, missing: preparedSheets.filter((sheet) => !sheet.image) };
}

export { downloadPresentation, prepareImageFile, prepareLogo, prepareSheets };
