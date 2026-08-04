import { FIELDWORK_TYPES } from "./map-model.js";
import { toWgs84 } from "./projection-utils.js";

const HEADER_ALIASES = Object.freeze({
  id: ["id", "pointid", "pointname", "name", "label", "location", "locationid", "testlocation", "holeid"],
  longitude: ["longitude", "lon", "long", "lng", "wgs84longitude"],
  latitude: ["latitude", "lat", "wgs84latitude"],
  easting: ["easting", "east", "mgaeasting", "gridx"],
  northing: ["northing", "north", "mganorthing", "gridy"],
  zone: ["zone", "mgazone", "utmzone", "gridzone", "mga2020zone"],
});

const TYPE_PREFIXES = Object.freeze([
  ["CPT", ["CPT", "CONEPENETRATIONTEST", "CONE"]],
  ["DCP", ["DCP", "DYNAMICCONEPENETROMETER", "DYNAMICCONE"]],
  ["BH", ["BH", "BOREHOLE", "BORE", "DRILLHOLE"]],
  ["TP", ["TP", "TESTPIT", "PIT"]],
  ["MW", ["MW", "MONITORINGWELL", "MONITORINGBORE", "WELL"]],
  ["SP", ["SP", "SURVEYPOINT", "SURVEY", "CONTROLPOINT", "SETOUTPOINT"]],
]);

function normalise(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function delimiterScore(line, delimiter) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

export function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [",", "\t", ";"];
  return candidates.sort((a, b) => delimiterScore(firstLine, b) - delimiterScore(firstLine, a))[0];
}

export function parseDelimitedText(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }
  row.push(field.trim());
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function findHeader(headers, aliases) {
  const normalised = headers.map(normalise);
  const index = normalised.findIndex((header) => aliases.includes(header));
  return index >= 0 ? headers[index] : "";
}

export function detectCoordinateSchema(headers) {
  const id = findHeader(headers, HEADER_ALIASES.id);
  const longitude = findHeader(headers, HEADER_ALIASES.longitude);
  const latitude = findHeader(headers, HEADER_ALIASES.latitude);
  const easting = findHeader(headers, HEADER_ALIASES.easting);
  const northing = findHeader(headers, HEADER_ALIASES.northing);
  const zone = findHeader(headers, HEADER_ALIASES.zone);
  const format = longitude && latitude ? "geographic" : easting && northing ? "projected" : null;
  return { id, longitude, latitude, easting, northing, zone, format };
}

export function inferPointTypeFromId(value, fallback = "BH") {
  const candidate = normalise(value).toUpperCase();
  const match = TYPE_PREFIXES.find(([, prefixes]) => prefixes.some((prefix) => candidate.startsWith(prefix)));
  return match?.[0] || (FIELDWORK_TYPES[fallback] ? fallback : "BH");
}

function valueFor(row, headers, column) {
  if (!column) return "";
  const index = headers.indexOf(column);
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}

function parseNumber(value) {
  return Number(String(value ?? "").replaceAll(",", "").replaceAll(" ", ""));
}

function zoneFromValue(value) {
  const match = /(?:^|\D)(5[5-6])(?:\D|$)/.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
}

function projectedCrs(selectedCrs, zoneValue) {
  const selected = String(selectedCrs || "auto");
  if (selected !== "auto") return selected;
  const zone = zoneFromValue(zoneValue);
  if (zone === 55 || zone === 56) return `EPSG:785${zone - 50}`;
  throw new Error("select the projected coordinate system or include a Zone column containing 55 or 56");
}

export function prepareCoordinateImport({
  headers,
  rows,
  sourceCrs = "auto",
  maximumPoints = 500,
}) {
  const schema = detectCoordinateSchema(headers);
  if (!schema.id) throw new Error("The coordinate file needs a Location ID column.");
  if (!schema.format) {
    throw new Error("The coordinate file needs either Latitude and Longitude columns or Easting and Northing columns.");
  }

  const points = [];
  const errors = [];
  const warnings = [];

  rows.forEach((row, rowIndex) => {
    if (points.length >= maximumPoints) return;
    const locationId = valueFor(row, headers, schema.id);
    if (!locationId) {
      errors.push(`Row ${rowIndex + 2}: Location ID is blank.`);
      return;
    }

    const sourceX = parseNumber(valueFor(row, headers, schema.format === "geographic" ? schema.longitude : schema.easting));
    const sourceY = parseNumber(valueFor(row, headers, schema.format === "geographic" ? schema.latitude : schema.northing));
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      errors.push(`Row ${rowIndex + 2}: coordinate values are not numeric.`);
      return;
    }

    try {
      const rowCrs = schema.format === "geographic"
        ? "EPSG:4326"
        : projectedCrs(sourceCrs, valueFor(row, headers, schema.zone));
      const [longitude, latitude] = toWgs84(rowCrs, [sourceX, sourceY]);
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error("transformed outside valid longitude/latitude limits");
      }
      const type = inferPointTypeFromId(locationId, "BH");
      if (!TYPE_PREFIXES.some(([, prefixes]) => prefixes.some((prefix) => normalise(locationId).toUpperCase().startsWith(prefix)))) {
        warnings.push(`Row ${rowIndex + 2}: '${locationId}' has no recognised BH/TP/CPT/DCP/MW/SP prefix and was imported as BH.`);
      }
      points.push({
        type,
        longitude,
        latitude,
        customLabel: locationId,
        notes: "",
        sourceRow: rowIndex + 2,
      });
    } catch (error) {
      errors.push(`Row ${rowIndex + 2}: ${error.message}.`);
    }
  });

  if (rows.length > maximumPoints) warnings.push(`Only the first ${maximumPoints} valid locations were prepared.`);
  return { points, errors, warnings, schema };
}

export function coordinateTemplateCsv() {
  return [
    "Location ID,Latitude,Longitude",
    "BH1,-27.9000000,153.3000000",
    "TP1,-27.9005000,153.3005000",
  ].join("\n");
}
