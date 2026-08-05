export const EXPORT_STYLE_KEY = "fieldwork-plan-export-style-v1";
export const EXPORT_PREVIEW_KEY = "fieldwork-plan-export-preview-v1";

export const FONT_OPTIONS = Object.freeze([
  "Arial",
  "Aptos",
  "Calibri",
  "Segoe UI",
  "Verdana",
]);

export const DEFAULT_EXPORT_STYLE = Object.freeze({
  fontFamily: "Arial",
  markerLabelSize: 18,
  markerLabelWeight: 800,
  coordinateFontSize: 10,
  titleBlockScale: 1,
  legendFontSize: 14,
  logoScale: 1,
  showCoordinateInset: true,
  previewBeforeExport: true,
});

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export function normaliseExportStyle(value = {}) {
  const family = FONT_OPTIONS.includes(value.fontFamily)
    ? value.fontFamily
    : DEFAULT_EXPORT_STYLE.fontFamily;
  return {
    fontFamily: family,
    markerLabelSize: boundedNumber(
      value.markerLabelSize,
      DEFAULT_EXPORT_STYLE.markerLabelSize,
      12,
      34,
    ),
    markerLabelWeight: boundedNumber(
      value.markerLabelWeight,
      DEFAULT_EXPORT_STYLE.markerLabelWeight,
      500,
      900,
    ),
    coordinateFontSize: boundedNumber(
      value.coordinateFontSize,
      DEFAULT_EXPORT_STYLE.coordinateFontSize,
      7,
      16,
    ),
    titleBlockScale: boundedNumber(
      value.titleBlockScale,
      DEFAULT_EXPORT_STYLE.titleBlockScale,
      0.85,
      1.35,
    ),
    legendFontSize: boundedNumber(
      value.legendFontSize,
      DEFAULT_EXPORT_STYLE.legendFontSize,
      9,
      22,
    ),
    logoScale: boundedNumber(
      value.logoScale,
      DEFAULT_EXPORT_STYLE.logoScale,
      0.65,
      1.35,
    ),
    showCoordinateInset:
      value.showCoordinateInset === undefined
        ? DEFAULT_EXPORT_STYLE.showCoordinateInset
        : Boolean(value.showCoordinateInset),
    previewBeforeExport:
      value.previewBeforeExport === undefined
        ? DEFAULT_EXPORT_STYLE.previewBeforeExport
        : Boolean(value.previewBeforeExport),
  };
}

export function loadExportPreferences() {
  if (typeof localStorage === "undefined") {
    return { style: { ...DEFAULT_EXPORT_STYLE }, locked: false };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPORT_STYLE_KEY) || "null") || {};
    return {
      style: normaliseExportStyle(parsed.style || parsed),
      locked: Boolean(parsed.locked),
    };
  } catch {
    return { style: { ...DEFAULT_EXPORT_STYLE }, locked: false };
  }
}

export function saveExportPreferences(style, locked = false) {
  const payload = { style: normaliseExportStyle(style), locked: Boolean(locked) };
  localStorage.setItem(EXPORT_STYLE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearExportPreferenceLock() {
  const current = loadExportPreferences();
  return saveExportPreferences(current.style, false);
}
