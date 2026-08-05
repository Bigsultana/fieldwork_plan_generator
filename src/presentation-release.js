import pptxgen from "pptxgenjs";
import { A1, fitContain, mm, normaliseHex } from "./model.js";
import {
  downloadPresentation,
  prepareImageFile,
  prepareLogo,
  prepareSheets,
} from "./presentation.js";
import { normaliseExportStyle } from "./export-style.js";

const COLOURS = Object.freeze({
  black: "111827",
  white: "FFFFFF",
  darkGrey: "374151",
  midGrey: "667085",
  lightGrey: "D7DEE8",
  paleGrey: "F4F6F8",
  headerFill: "E8EEF5",
  placeholder: "F3F4F6",
});

const LAYOUT = Object.freeze({
  outerL: 6,
  outerR: 835,
  outerT: 7,
  outerB: 7,
  innerL: 12,
  innerR: 829,
  innerT: 13,
  innerB: 13,
  titleBlockH: 64,
});

const SMALL_SCHEDULE_THRESHOLD = 8;
const SCHEDULE_ROWS_PER_PAGE = 15;
const PLANNING_DISCLAIMER =
  "Planning coordinates only. Verify survey control, datum and final set-out requirements before fieldwork.";

const titleBlockTop = A1.heightMm - LAYOUT.innerB - LAYOUT.titleBlockH;
const contentBox = Object.freeze({
  x: mm(LAYOUT.innerL),
  y: mm(LAYOUT.innerT),
  w: mm(LAYOUT.innerR - LAYOUT.innerL),
  h: mm(titleBlockTop - LAYOUT.innerT),
});

function fontSize(base, style) {
  return Math.max(5, Number((base * style.titleBlockScale).toFixed(1)));
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
      transparency: options.lineTransparency || 0,
    },
  });
}

function addText(slide, text, left, top, width, height, style, options = {}) {
  slide.addText(String(text || ""), {
    x: mm(left),
    y: mm(top),
    w: mm(width),
    h: mm(height),
    fontFace: options.fontFace || style.fontFamily,
    fontSize: options.fontSize || fontSize(10, style),
    bold: Boolean(options.bold),
    color: options.color || COLOURS.black,
    align: options.align || "left",
    valign: options.valign || "middle",
    margin: options.margin ?? 0.6,
    fit: "shrink",
    wrap: true,
  });
}

function addField(slide, left, top, width, height, label, value, style, options = {}) {
  const labelHeight = Math.min(5.2, height * 0.36);
  addText(slide, label, left, top, width, labelHeight, style, {
    fontSize: fontSize(options.labelSize || 7.1, style),
    bold: true,
    color: COLOURS.midGrey,
    align: options.align || "left",
    valign: "top",
    margin: 0.35,
  });
  addText(slide, value, left, top + labelHeight, width, height - labelHeight, style, {
    fontSize: fontSize(options.valueSize || 10.2, style),
    bold: options.bold !== false,
    align: options.align || "left",
    color: options.valueColor || COLOURS.black,
    margin: 0.45,
  });
}

function addBlankSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOURS.white };
  return slide;
}

function cleanProject(project = {}) {
  const { drawingStatus: _drawingStatus, designedBy: _designedBy, ...cleaned } = project;
  return cleaned;
}

function realCompanyName(project) {
  const value = String(project.companyName || "").trim();
  return value && value.toUpperCase() !== "COMPANY NAME" ? value : "";
}

function revisionRecord(project, sheet = {}) {
  return {
    revision: String(sheet.revision || project.revision || "-").trim() || "-",
    description: String(project.revisionDescription || "").trim() || "ISSUED",
    date: String(project.revisionDate || project.date || "").trim(),
    by: String(project.revisionBy || project.drawnBy || "").trim(),
    sheet: String(sheet.sheetNumber || "").trim(),
  };
}

function drawCompanyBranding(pptx, slide, project, logo, style, left, top, width, height) {
  const accent = normaliseHex(project.accentColor);
  if (logo?.data) {
    const scale = style.logoScale;
    const insetX = 7 + (1.35 - scale) * 9;
    const insetY = 4 + (1.35 - scale) * 4;
    const fit = fitContain(logo.width, logo.height, {
      x: mm(left + insetX),
      y: mm(top + insetY),
      w: mm(width - insetX * 2),
      h: mm(Math.max(20, height - insetY * 2 - 10)),
    });
    slide.addImage({ data: logo.data, ...fit });
  } else if (realCompanyName(project)) {
    addText(slide, realCompanyName(project), left + 5, top + 5, width - 10, 20, style, {
      fontSize: fontSize(16, style),
      bold: true,
      color: accent,
      align: "center",
    });
  }

  const contact = [project.companyPhone, project.companyEmail, project.companyWebsite]
    .filter(Boolean)
    .join("  |  ");
  if (contact) {
    addText(slide, contact, left + 4, top + height - 11, width - 8, 8, style, {
      fontSize: fontSize(7.4, style),
      color: COLOURS.midGrey,
      align: "center",
      margin: 0.25,
    });
  }
}

function drawRevisionStrip(pptx, slide, record, style, left, top, width, height) {
  const widths = [20, 82, 34, 22, width - 158];
  const cells = [
    ["REV", record.revision],
    ["DESCRIPTION", record.description, { align: "left", fill: COLOURS.paleGrey }],
    ["DATE", record.date],
    ["BY", record.by],
    ["SHEET", record.sheet],
  ];
  let currentLeft = left;
  cells.forEach(([label, value, options = {}], index) => {
    const cellWidth = widths[index];
    addRect(pptx, slide, currentLeft, top, cellWidth, height, {
      fill: options.fill || COLOURS.white,
      lineColor: COLOURS.lightGrey,
      lineWidth: 0.3,
    });
    addText(slide, label, currentLeft + 0.8, top + 0.5, cellWidth - 1.6, 4.5, style, {
      fontSize: fontSize(6.8, style),
      bold: true,
      color: COLOURS.midGrey,
      align: options.align || "center",
      valign: "top",
      margin: 0.2,
    });
    addText(slide, value, currentLeft + 0.8, top + 4.6, cellWidth - 1.6, height - 5.1, style, {
      fontSize: fontSize(index === 1 ? 8.5 : 9, style),
      bold: true,
      align: options.align || "center",
      margin: 0.3,
    });
    currentLeft += cellWidth;
  });
}

function drawMetadataCell(pptx, slide, left, top, width, height, label, value, style, fill) {
  addRect(pptx, slide, left, top, width, height, {
    fill,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.3,
  });
  addField(slide, left + 0.7, top + 0.45, width - 1.4, height - 0.9, label, value, style, {
    align: "center",
    labelSize: 6.8,
    valueSize: 9.5,
  });
}

function drawTitleBlock(pptx, slide, project, sheet, logo, style) {
  const accent = normaliseHex(project.accentColor);
  const totalWidth = LAYOUT.innerR - LAYOUT.innerL;
  const accentHeight = 4.5;
  const bodyTop = titleBlockTop + accentHeight;
  const bodyHeight = LAYOUT.titleBlockH - accentHeight;
  const companyWidth = 145;
  const projectWidth = 247;
  const drawingWidth = 247;
  const metaWidth = totalWidth - companyWidth - projectWidth - drawingWidth;
  const companyLeft = LAYOUT.innerL;
  const projectLeft = companyLeft + companyWidth;
  const drawingLeft = projectLeft + projectWidth;
  const metaLeft = drawingLeft + drawingWidth;

  addRect(pptx, slide, LAYOUT.innerL, titleBlockTop, totalWidth, LAYOUT.titleBlockH, {
    fill: COLOURS.white,
    lineColor: COLOURS.black,
    lineWidth: 0.65,
  });
  addRect(pptx, slide, LAYOUT.innerL, titleBlockTop, totalWidth, accentHeight, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });

  for (const x of [projectLeft, drawingLeft, metaLeft]) {
    slide.addShape(pptx.ShapeType.line, {
      x: mm(x),
      y: mm(bodyTop),
      w: 0,
      h: mm(bodyHeight),
      line: { color: COLOURS.lightGrey, width: 0.5 },
    });
  }

  drawCompanyBranding(
    pptx,
    slide,
    project,
    logo,
    style,
    companyLeft,
    bodyTop,
    companyWidth,
    bodyHeight,
  );

  addText(slide, "PROJECT", projectLeft + 4, bodyTop + 2, projectWidth - 8, 5, style, {
    fontSize: fontSize(7.2, style),
    bold: true,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.25,
  });
  addText(slide, project.projectTitle || "Project title", projectLeft + 4, bodyTop + 7, projectWidth - 8, 16, style, {
    fontSize: fontSize(16, style),
    bold: true,
    color: accent,
    margin: 0.35,
  });
  addField(slide, projectLeft + 4, bodyTop + 24, 143, 13, "CLIENT", project.clientName, style, {
    valueSize: 10.3,
  });
  addField(slide, projectLeft + 151, bodyTop + 24, projectWidth - 155, 13, "PROJECT NO.", project.projectNumber, style, {
    align: "center",
    valueSize: 10.3,
  });
  addField(slide, projectLeft + 4, bodyTop + 38, projectWidth - 8, 17, "SITE", project.projectAddress, style, {
    valueSize: 9.8,
  });

  addText(slide, "DRAWING", drawingLeft + 4, bodyTop + 2, drawingWidth - 8, 5, style, {
    fontSize: fontSize(7.2, style),
    bold: true,
    color: COLOURS.midGrey,
    valign: "top",
    margin: 0.25,
  });
  addText(slide, sheet.drawingTitle1 || "Drawing title", drawingLeft + 4, bodyTop + 7, drawingWidth - 8, 21, style, {
    fontSize: fontSize(18, style),
    bold: true,
    margin: 0.35,
  });
  addText(slide, sheet.drawingTitle2, drawingLeft + 4, bodyTop + 29, drawingWidth - 8, 13, style, {
    fontSize: fontSize(11.4, style),
    bold: true,
    color: COLOURS.darkGrey,
    margin: 0.35,
  });
  addText(slide, sheet.drawingTitle3, drawingLeft + 4, bodyTop + 43, drawingWidth - 8, 12, style, {
    fontSize: fontSize(9.6, style),
    color: COLOURS.midGrey,
    margin: 0.35,
  });

  const metaGridHeight = 38;
  const rowHeight = metaGridHeight / 2;
  drawMetadataCell(pptx, slide, metaLeft, bodyTop, metaWidth / 2, rowHeight, "DRAWN", project.drawnBy, style, COLOURS.white);
  drawMetadataCell(pptx, slide, metaLeft + metaWidth / 2, bodyTop, metaWidth / 2, rowHeight, "APPROVED", project.approvedBy, style, COLOURS.white);
  const lowerWidth = metaWidth / 3;
  drawMetadataCell(pptx, slide, metaLeft, bodyTop + rowHeight, lowerWidth, rowHeight, "DATE", project.date, style, COLOURS.paleGrey);
  drawMetadataCell(pptx, slide, metaLeft + lowerWidth, bodyTop + rowHeight, lowerWidth, rowHeight, "SCALE @ A1", sheet.scale || "NTS", style, COLOURS.paleGrey);
  drawMetadataCell(pptx, slide, metaLeft + lowerWidth * 2, bodyTop + rowHeight, metaWidth - lowerWidth * 2, rowHeight, "FIGURE NO.", `${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`, style, COLOURS.paleGrey);

  drawRevisionStrip(
    pptx,
    slide,
    revisionRecord(project, sheet),
    style,
    metaLeft,
    bodyTop + metaGridHeight,
    metaWidth,
    bodyHeight - metaGridHeight,
  );
}

function drawPageFrames(pptx, slide) {
  addRect(pptx, slide, LAYOUT.outerL, LAYOUT.outerT, LAYOUT.outerR - LAYOUT.outerL, A1.heightMm - LAYOUT.outerT - LAYOUT.outerB, {
    fill: COLOURS.white,
    transparency: 100,
    lineColor: COLOURS.darkGrey,
    lineWidth: 0.25,
  });
  addRect(pptx, slide, LAYOUT.innerL, LAYOUT.innerT, LAYOUT.innerR - LAYOUT.innerL, A1.heightMm - LAYOUT.innerT - LAYOUT.innerB, {
    fill: COLOURS.white,
    transparency: 100,
    lineColor: COLOURS.black,
    lineWidth: 0.7,
  });
}

function drawDisclaimer(slide, left, top, width, style) {
  addText(slide, PLANNING_DISCLAIMER, left, top, width, 7, style, {
    fontSize: Math.max(7.5, style.coordinateFontSize - 1.2),
    color: COLOURS.darkGrey,
    margin: 0.35,
  });
}

function drawCoordinateInset(pptx, slide, project, mapPlan, style) {
  const points = mapPlan.points || [];
  if (!points.length || !style.showCoordinateInset) {
    drawDisclaimer(slide, LAYOUT.innerL + 10, LAYOUT.innerT + 8, 360, style);
    return;
  }

  const accent = normaliseHex(project.accentColor);
  const columns = [
    ["ID", 38],
    ["TYPE", 76],
    ["ZONE", 48],
    ["EASTING", 68],
    ["NORTHING", 76],
    ["NOTES", 124],
  ];
  const width = columns.reduce((sum, [, columnWidth]) => sum + columnWidth, 0);
  const titleHeight = 10;
  const headerHeight = 10;
  const rowHeight = 12;
  const disclaimerHeight = 9;
  const height = titleHeight + headerHeight + points.length * rowHeight + disclaimerHeight;
  const left = LAYOUT.innerL + 10;
  const top = LAYOUT.innerT + 10;

  addRect(pptx, slide, left, top, width, height, {
    fill: COLOURS.white,
    transparency: 4,
    lineColor: accent,
    lineWidth: 0.8,
  });
  addRect(pptx, slide, left, top, width, titleHeight, {
    fill: accent,
    lineColor: accent,
    lineWidth: 0,
  });
  addText(slide, "FIELDWORK COORDINATE SUMMARY", left + 2, top, width - 4, titleHeight, style, {
    fontSize: style.coordinateFontSize + 1,
    bold: true,
    color: COLOURS.white,
    margin: 0.45,
  });

  let currentLeft = left;
  columns.forEach(([label, columnWidth]) => {
    addRect(pptx, slide, currentLeft, top + titleHeight, columnWidth, headerHeight, {
      fill: COLOURS.headerFill,
      lineColor: COLOURS.lightGrey,
      lineWidth: 0.3,
    });
    addText(slide, label, currentLeft, top + titleHeight, columnWidth, headerHeight, style, {
      fontSize: style.coordinateFontSize - 0.5,
      bold: true,
      align: "center",
      color: COLOURS.darkGrey,
      margin: 0.35,
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
      const rowTop = top + titleHeight + headerHeight + rowIndex * rowHeight;
      addRect(pptx, slide, currentLeft, rowTop, columnWidth, rowHeight, {
        fill: rowIndex % 2 === 0 ? COLOURS.white : COLOURS.paleGrey,
        transparency: 4,
        lineColor: COLOURS.lightGrey,
        lineWidth: 0.25,
      });
      addText(slide, value, currentLeft, rowTop, columnWidth, rowHeight, style, {
        fontSize: columnIndex === 5 ? style.coordinateFontSize - 0.8 : style.coordinateFontSize,
        bold: columnIndex === 0,
        align: columnIndex >= 2 && columnIndex <= 4 ? "center" : "left",
        margin: 0.55,
      });
      currentLeft += columnWidth;
    });
  });

  drawDisclaimer(
    slide,
    left + 2,
    top + height - disclaimerHeight,
    width - 4,
    style,
  );
}

function drawMapSlide(pptx, project, mapPlan, logo, style) {
  const slide = addBlankSlide(pptx);
  drawPageFrames(pptx, slide);
  slide.addImage({ data: mapPlan.image.data, ...contentBox });
  if ((mapPlan.points || []).length <= SMALL_SCHEDULE_THRESHOLD) {
    drawCoordinateInset(pptx, slide, project, mapPlan, style);
  } else {
    drawDisclaimer(slide, LAYOUT.innerL + 10, LAYOUT.innerT + 8, 390, style);
  }
  drawTitleBlock(pptx, slide, project, mapPlan.sheet, logo, style);
}

function drawCoordinateSchedules(pptx, project, mapPlan, logo, style) {
  const points = mapPlan.points || [];
  if (points.length <= SMALL_SCHEDULE_THRESHOLD) return;

  const columns = [
    ["ID", 42],
    ["TYPE", 80],
    ["LATITUDE", 86],
    ["LONGITUDE", 86],
    ["MGA ZONE", 78],
    ["EASTING", 86],
    ["NORTHING", 96],
    ["NOTES", 263],
  ];
  const pageCount = Math.ceil(points.length / SCHEDULE_ROWS_PER_PAGE);
  const accent = normaliseHex(project.accentColor);

  for (let page = 0; page < pageCount; page += 1) {
    const sheet = {
      sheetNumber: `${mapPlan.sheet.sheetNumber}-S${page + 1}`,
      drawingTitle1: "Fieldwork Location Schedule",
      drawingTitle2: mapPlan.sheet.drawingTitle1,
      drawingTitle3: `Page ${page + 1} of ${pageCount}`,
      scale: "NTS",
      revision: mapPlan.sheet.revision || project.revision || "-",
    };
    const slide = addBlankSlide(pptx);
    drawPageFrames(pptx, slide);
    addText(slide, "PROPOSED FIELDWORK LOCATION COORDINATES", LAYOUT.innerL, LAYOUT.innerT + 3, LAYOUT.innerR - LAYOUT.innerL, 14, style, {
      fontSize: 20,
      bold: true,
      color: accent,
      margin: 0.45,
    });
    addText(slide, `${project.projectTitle || "Project"}  ·  ${project.projectAddress || "Site address not entered"}`, LAYOUT.innerL, LAYOUT.innerT + 17, LAYOUT.innerR - LAYOUT.innerL, 9, style, {
      fontSize: 10,
      color: COLOURS.midGrey,
      margin: 0.4,
    });

    const headerTop = LAYOUT.innerT + 31;
    const headerHeight = 12;
    let currentLeft = LAYOUT.innerL;
    columns.forEach(([label, width]) => {
      addRect(pptx, slide, currentLeft, headerTop, width, headerHeight, {
        fill: COLOURS.headerFill,
        lineColor: COLOURS.lightGrey,
        lineWidth: 0.4,
      });
      addText(slide, label, currentLeft, headerTop, width, headerHeight, style, {
        fontSize: style.coordinateFontSize,
        bold: true,
        align: "center",
        color: COLOURS.darkGrey,
        margin: 0.5,
      });
      currentLeft += width;
    });

    const pageRows = points.slice(page * SCHEDULE_ROWS_PER_PAGE, (page + 1) * SCHEDULE_ROWS_PER_PAGE);
    const availableHeight = titleBlockTop - 11 - (headerTop + headerHeight);
    const rowHeight = Math.max(20, Math.min(29, availableHeight / Math.max(pageRows.length, 11)));
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
      currentLeft = LAYOUT.innerL;
      values.forEach((value, columnIndex) => {
        const width = columns[columnIndex][1];
        const rowTop = headerTop + headerHeight + rowIndex * rowHeight;
        addRect(pptx, slide, currentLeft, rowTop, width, rowHeight, {
          fill: rowIndex % 2 === 0 ? COLOURS.white : COLOURS.paleGrey,
          lineColor: COLOURS.lightGrey,
          lineWidth: 0.3,
        });
        addText(slide, value, currentLeft, rowTop, width, rowHeight, style, {
          fontSize: columnIndex === 7 ? style.coordinateFontSize - 0.5 : style.coordinateFontSize,
          bold: columnIndex === 0,
          align: columnIndex >= 2 && columnIndex <= 6 ? "center" : "left",
          margin: 0.8,
        });
        currentLeft += width;
      });
    });

    drawDisclaimer(slide, LAYOUT.innerL, titleBlockTop - 9, LAYOUT.innerR - LAYOUT.innerL, style);
    drawTitleBlock(pptx, slide, project, sheet, logo, style);
  }
}

function drawSupportingSlide(pptx, project, sheet, logo, style) {
  const slide = addBlankSlide(pptx);
  drawPageFrames(pptx, slide);
  addRect(pptx, slide, LAYOUT.innerL, LAYOUT.innerT, LAYOUT.innerR - LAYOUT.innerL, titleBlockTop - LAYOUT.innerT, {
    fill: COLOURS.paleGrey,
    lineColor: COLOURS.lightGrey,
    lineWidth: 0.3,
  });
  if (sheet.image?.data && sheet.image.width > 0 && sheet.image.height > 0) {
    const fit = fitContain(sheet.image.width, sheet.image.height, contentBox);
    slide.addImage({ data: sheet.image.data, ...fit });
  } else {
    addText(slide, `[ ${sheet.drawingTitle1 || "Image"} ]\n${sheet.imageError || "Unable to read image"}`, LAYOUT.innerL, LAYOUT.innerT, LAYOUT.innerR - LAYOUT.innerL, titleBlockTop - LAYOUT.innerT, style, {
      fontSize: 18,
      bold: true,
      color: COLOURS.midGrey,
      align: "center",
      margin: 8,
    });
  }
  drawTitleBlock(pptx, slide, project, sheet, logo, style);
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const cleanedProject = cleanProject(project);
  const style = normaliseExportStyle(mapPlan?.exportStyle || cleanedProject.exportStyle || {});
  const pptx = new pptxgen();
  pptx.defineLayout({
    name: "A1_LANDSCAPE_RELEASE",
    width: mm(A1.widthMm),
    height: mm(A1.heightMm),
  });
  pptx.layout = "A1_LANDSCAPE_RELEASE";
  pptx.author = cleanedProject.drawnBy || cleanedProject.companyName || "Fieldwork Plan Generator";
  pptx.company = realCompanyName(cleanedProject);
  pptx.subject = "Fieldwork plan";
  pptx.title = cleanedProject.projectTitle || "Fieldwork Plan";
  pptx.lang = "en-AU";
  pptx.theme = { headFontFace: style.fontFamily, bodyFontFace: style.fontFamily, lang: "en-AU" };

  if (mapPlan?.image?.data) {
    drawMapSlide(pptx, cleanedProject, mapPlan, logo, style);
    drawCoordinateSchedules(pptx, cleanedProject, mapPlan, logo, style);
  }
  preparedSheets.forEach((sheet) => drawSupportingSlide(pptx, cleanedProject, sheet, logo, style));
  return pptx;
}

export async function generatePresentation(project, sheets, logoFile, onProgress = () => {}, mapPlan = null) {
  const preparedSheets = await prepareSheets(sheets, onProgress);
  const logo = await prepareLogo(logoFile);
  onProgress(Math.max(sheets.length, 1), Math.max(sheets.length, 1), "Building PowerPoint");
  const pptx = createPresentation(project, preparedSheets, logo, mapPlan);
  const buffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return { buffer, missing: preparedSheets.filter((sheet) => !sheet.image) };
}

export { downloadPresentation, prepareImageFile, prepareLogo, prepareSheets };
