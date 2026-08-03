import { mm, normaliseHex } from "./model.js";
import {
  createPresentation as createBasePresentation,
  downloadPresentation,
  prepareImageFile,
  prepareLogo,
  prepareSheets,
} from "./presentation.js";

const A1_HEIGHT = 594;
const INNER_B = 13;
const TITLE_BLOCK_H = 44;
const TITLE_BLOCK_TOP = A1_HEIGHT - INNER_B - TITLE_BLOCK_H;
const STRIP_H = 4.5;
const BODY_H = TITLE_BLOCK_H - STRIP_H;
const META_LEFT = 12 + 150 + 252 + 242;
const META_WIDTH = 829 - META_LEFT;
const REVISION_ROW_TOP = TITLE_BLOCK_TOP + STRIP_H + (BODY_H * 2) / 3;
const REVISION_ROW_H = BODY_H / 3;
const SMALL_SCHEDULE_THRESHOLD = 8;
const SCHEDULE_ROWS_PER_PAGE = 16;

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

function slideRevisionRecords(project, preparedSheets, mapPlan) {
  const records = [];
  if (mapPlan?.image?.data) {
    records.push(revisionRecord(project, mapPlan.sheet));
    const pointCount = mapPlan.points?.length || 0;
    if (pointCount > SMALL_SCHEDULE_THRESHOLD) {
      const pageCount = Math.ceil(pointCount / SCHEDULE_ROWS_PER_PAGE);
      for (let page = 0; page < pageCount; page += 1) {
        records.push(
          revisionRecord(project, {
            ...mapPlan.sheet,
            sheetNumber: `${mapPlan.sheet.sheetNumber}-S${page + 1}`,
          }),
        );
      }
    }
  }
  preparedSheets.forEach((sheet) => records.push(revisionRecord(project, sheet)));
  return records;
}

function addCell(pptx, slide, left, width, label, value, options = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x: mm(left),
    y: mm(REVISION_ROW_TOP),
    w: mm(width),
    h: mm(REVISION_ROW_H),
    fill: { color: options.fill || "FFFFFF" },
    line: { color: "D1D5DB", width: 0.3 },
  });
  slide.addText(label, {
    x: mm(left + 0.8),
    y: mm(REVISION_ROW_TOP + 0.5),
    w: mm(width - 1.6),
    h: mm(3.6),
    fontFace: "Arial",
    fontSize: 4.8,
    bold: true,
    color: "6B7280",
    align: options.align || "center",
    valign: "top",
    margin: 0.2,
    fit: "shrink",
  });
  slide.addText(String(value || ""), {
    x: mm(left + 0.8),
    y: mm(REVISION_ROW_TOP + 3.8),
    w: mm(width - 1.6),
    h: mm(REVISION_ROW_H - 4.3),
    fontFace: "Arial",
    fontSize: options.fontSize || 6.8,
    bold: options.bold !== false,
    color: options.color || "111827",
    align: options.align || "center",
    valign: "middle",
    margin: 0.25,
    fit: "shrink",
    wrap: true,
  });
}

function addRevisionStrip(pptx, slide, project, record) {
  const accent = normaliseHex(project.accentColor);
  slide.addShape(pptx.ShapeType.rect, {
    x: mm(META_LEFT),
    y: mm(REVISION_ROW_TOP),
    w: mm(META_WIDTH),
    h: mm(REVISION_ROW_H),
    fill: { color: "FFFFFF" },
    line: { color: accent, width: 0.45 },
  });

  const widths = [18, 78, 32, 20, 25];
  const values = [
    ["REV", record.revision],
    ["DESCRIPTION", record.description || record.status, { align: "left", fontSize: 6.2, fill: "F7F8FA" }],
    ["DATE", record.date],
    ["BY", record.by],
    ["SHEET", record.sheet],
  ];
  let left = META_LEFT;
  values.forEach(([label, value, options], index) => {
    addCell(pptx, slide, left, widths[index], label, value, options || {});
    left += widths[index];
  });
}

export function createPresentation(project, preparedSheets, logo = null, mapPlan = null) {
  const pptx = createBasePresentation(project, preparedSheets, logo, mapPlan);
  const slides = Array.isArray(pptx._slides) ? pptx._slides : [];
  const records = slideRevisionRecords(project, preparedSheets, mapPlan);
  slides.forEach((slide, index) => addRevisionStrip(pptx, slide, project, records[index] || revisionRecord(project)));
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
