import { FIELDWORK_TYPES } from "./map-model.js";
import { toWgs84 } from "./projection-utils.js";

const HEADER_ALIASES = Object.freeze({
  id: ["id", "pointid", "pointname", "name", "label", "location", "locationid", "testlocation", "holeid"],
  type: ["type", "pointtype", "locationtype", "testtype", "method"],
  longitude: ["longitude", "lon", "long", "lng", "x", "wgs84longitude"],
  latitude: ["latitude", "lat", "y", "wgs84latitude"],
  easting: ["easting", "east", "x", "mgaeasting", "gridx"],
  northing: ["northing", "north", "y", "mganorthing", "gridy"],
  notes: ["notes", "note", "description", "comments", "comment", "remarks", "remark"],
});

const TYPE_ALIASES = Object.freeze({
  BH: ["bh", "borehole", "bore", "drillhole", "drillholelocation"],
  TP: ["tp", "testpit", "pit", "excavation"],
  CPT: ["cpt", "conepenetrationtest", "cone"],
  DCP: ["dcp", "dynamicconepenetrometer", "dynamiccone"],
  MW: ["mw", "monitoringwell", "monitoringbore", "well"],
  SP: ["sp", "surveypoint", "survey", "controlpoint", "setoutpoint"],
});

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

export function detectCoordinateMapping(headers, sourceCrs = "EPSG:4326") {
  const geographic = String(sourceCrs) === "EPSG:4326";
  return {
    id: findHeader(headers, HEADER_ALIASES.id),
    type: findHeader(headers, HEADER_ALIASES.type),
    x: findHeader(headers, geographic ? HEADER_ALIASES.longitude : HEADER_ALIASES.easting),
    y: findHeader(headers, geographic ? HEADER_ALIASES.latitude : HEADER_ALIASES.northing),
    notes: findHeader(headers, HEADER_ALIASES.notes),
  };
}

export function normalisePointType(value, fallback = "BH") {
  const candidate = normalise(value);
  if (FIELDWORK_TYPES[String(value || "").toUpperCase()]) return String(value).toUpperCase();
  const match = Object.entries(TYPE_ALIASES).find(([, aliases]) => aliases.includes(candidate));
  return match?.[0] || (FIELDWORK_TYPES[fallback] ? fallback : "BH");
}

function valueFor(row, headers, column) {
  if (!column) return "";
  const index = headers.indexOf(column);
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}

export function prepareCoordinateImport({
  headers,
  rows,
  mapping,
  sourceCrs = "EPSG:4326",
  defaultType = "BH",
  maximumPoints = 500,
}) {
  if (!mapping?.x || !mapping?.y) {
    throw new Error("Choose the two coordinate columns before importing.");
  }
  const points = [];
  const errors = [];
  const warnings = [];

  rows.forEach((row, rowIndex) => {
    if (points.length >= maximumPoints) return;
    const sourceX = Number(String(valueFor(row, headers, mapping.x)).replaceAll(",", ""));
    const sourceY = Number(String(valueFor(row, headers, mapping.y)).replaceAll(",", ""));
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      errors.push(`Row ${rowIndex + 2}: coordinate values are not numeric.`);
      return;
    }
    try {
      const [longitude, latitude] = toWgs84(sourceCrs, [sourceX, sourceY]);
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error("transformed outside valid longitude/latitude limits");
      }
      const rawType = valueFor(row, headers, mapping.type);
      const type = normalisePointType(rawType, defaultType);
      if (rawType && normalisePointType(rawType, "") !== type) {
        warnings.push(`Row ${rowIndex + 2}: unknown type '${rawType}' was imported as ${type}.`);
      }
      points.push({
        type,
        longitude,
        latitude,
        customLabel: valueFor(row, headers, mapping.id),
        notes: valueFor(row, headers, mapping.notes),
        sourceRow: rowIndex + 2,
      });
    } catch (error) {
      errors.push(`Row ${rowIndex + 2}: ${error.message}.`);
    }
  });

  if (rows.length > maximumPoints) warnings.push(`Only the first ${maximumPoints} valid locations were prepared.`);
  return { points, errors, warnings };
}

export function coordinateTemplateCsv() {
  return [
    "ID,Type,Latitude,Longitude,Notes",
    "BH1,Borehole,-27.9000000,153.3000000,Optional note",
    "TP1,Test pit,-27.9005000,153.3005000,",
  ].join("\n");
}
