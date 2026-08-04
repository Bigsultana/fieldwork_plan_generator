import {
  ACCEPTED_IMAGE_EXTENSIONS,
  DEFAULT_PROJECT as BASE_DEFAULT_PROJECT,
  applyCsvRows,
  normaliseHex,
  parseCsv,
  renumberSheets,
  sheetFromFile,
  validateSheets,
} from "./model.js";

function withoutObsoleteFields(project = {}) {
  const { drawingStatus: _drawingStatus, designedBy: _designedBy, ...cleaned } = project;
  return cleaned;
}

export const DEFAULT_PROJECT = Object.freeze(withoutObsoleteFields(BASE_DEFAULT_PROJECT));

export function serialisableProject(project = {}) {
  const merged = withoutObsoleteFields({ ...DEFAULT_PROJECT, ...project });
  return { ...merged, accentColor: normaliseHex(merged.accentColor) };
}

export {
  ACCEPTED_IMAGE_EXTENSIONS,
  applyCsvRows,
  normaliseHex,
  parseCsv,
  renumberSheets,
  sheetFromFile,
  validateSheets,
};
