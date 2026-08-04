import proj4 from "proj4";

export const MAP_CONTENT_RATIO = 817 / 516;

export const FIELDWORK_TYPES = Object.freeze({
  BH: Object.freeze({ code: "BH", name: "Borehole", symbol: "⊕", color: "C62828" }),
  TP: Object.freeze({ code: "TP", name: "Test pit", symbol: "■", color: "EF6C00" }),
  CPT: Object.freeze({ code: "CPT", name: "CPT", symbol: "◆", color: "6A1B9A" }),
  DCP: Object.freeze({ code: "DCP", name: "DCP", symbol: "▲", color: "1565C0" }),
  MW: Object.freeze({ code: "MW", name: "Monitoring well", symbol: "◎", color: "00897B" }),
  SP: Object.freeze({ code: "SP", name: "Survey point", symbol: "+", color: "455A64" }),
});

const WGS84 = "EPSG:4326";
proj4.defs(WGS84, "+proj=longlat +datum=WGS84 +no_defs +type=crs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs");
proj4.defs("EPSG:7855", "+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:7856", "+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:28355", "+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:28356", "+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:32755", "+proj=utm +zone=55 +south +datum=WGS84 +units=m +no_defs +type=crs");
proj4.defs("EPSG:32756", "+proj=utm +zone=56 +south +datum=WGS84 +units=m +no_defs +type=crs");

export function makePoint(type, longitude, latitude, existing = []) {
  const definition = FIELDWORK_TYPES[type];
  if (!definition) throw new Error(`Unsupported fieldwork point type '${type}'.`);
  const point = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type,
    longitude: Number(longitude),
    latitude: Number(latitude),
    notes: "",
  };
  return renumberPoints([...existing, point]).at(-1);
}

export function renumberPoints(points) {
  const counts = new Map();
  return points.map((point) => {
    const type = point.type;
    const next = (counts.get(type) || 0) + 1;
    counts.set(type, next);
    const definition = FIELDWORK_TYPES[type] || { code: type, name: type, symbol: "●", color: "333333" };
    return {
      ...point,
      sequence: next,
      label: `${definition.code}${next}`,
      typeName: definition.name,
      symbol: definition.symbol,
      color: definition.color,
    };
  });
}

export function utmZone(longitude) {
  const zone = Math.floor((Number(longitude) + 180) / 6) + 1;
  return Math.min(60, Math.max(1, zone));
}

export function mga2020Definition(zone) {
  return `+proj=utm +zone=${Number(zone)} +south +ellps=GRS80 +units=m +no_defs +type=crs`;
}

export function coordinateRecord(point) {
  const longitude = Number(point.longitude);
  const latitude = Number(point.latitude);
  const zone = utmZone(longitude);
  const [easting, northing] = proj4(WGS84, mga2020Definition(zone), [longitude, latitude]);
  return {
    ...point,
    zone,
    easting,
    northing,
    latitudeText: latitude.toFixed(7),
    longitudeText: longitude.toFixed(7),
    eastingText: Math.round(easting).toLocaleString("en-AU"),
    northingText: Math.round(northing).toLocaleString("en-AU"),
  };
}

export function pointsGeoJson(points) {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      id: point.id,
      properties: {
        id: point.id,
        type: point.type,
        label: point.label,
        symbol: point.symbol,
        color: `#${point.color}`,
        icon: `fieldwork-${point.type}`,
      },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

export function haversineDistanceMetres(a, b) {
  const radius = 6371008.8;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundedEngineeringScale(denominator) {
  const value = Math.max(1, Number(denominator));
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = steps.find((candidate) => normalized <= candidate) || 10;
  return Math.round(step * magnitude);
}

export function scaleFromFrameWidth(groundWidthMetres, paperWidthMm = 817) {
  return roundedEngineeringScale((Number(groundWidthMetres) * 1000) / Number(paperWidthMm));
}

export function projectionFromGeoKeys(geoKeys = {}, fallback = "auto") {
  if (fallback && fallback !== "auto") return fallback;
  const projected = Number(geoKeys.ProjectedCSTypeGeoKey || 0);
  const geographic = Number(geoKeys.GeographicTypeGeoKey || 0);
  if (projected > 0 && projected !== 32767) return `EPSG:${projected}`;
  if (geographic === 4326 || geographic === 7844 || geographic === 4283) return "EPSG:4326";
  return null;
}

export function transformCoordinate(coordinate, sourceCrs) {
  if (!sourceCrs || sourceCrs === WGS84 || sourceCrs === "EPSG:7844" || sourceCrs === "EPSG:4283") {
    return [Number(coordinate[0]), Number(coordinate[1])];
  }
  if (!proj4.defs(sourceCrs)) {
    const match = /^EPSG:(327|283|785)(\d{2})$/.exec(sourceCrs);
    if (match) {
      const family = match[1];
      const zone = Number(match[2]);
      const datum = family === "327" ? "+datum=WGS84" : "+ellps=GRS80";
      proj4.defs(sourceCrs, `+proj=utm +zone=${zone} +south ${datum} +units=m +no_defs +type=crs`);
    }
  }
  if (!proj4.defs(sourceCrs)) throw new Error(`Coordinate system ${sourceCrs} is not supported.`);
  return proj4(sourceCrs, WGS84, coordinate.map(Number));
}

export function overlayCornerCoordinates(bbox, sourceCrs) {
  const [minX, minY, maxX, maxY] = bbox.map(Number);
  return [
    transformCoordinate([minX, maxY], sourceCrs),
    transformCoordinate([maxX, maxY], sourceCrs),
    transformCoordinate([maxX, minY], sourceCrs),
    transformCoordinate([minX, minY], sourceCrs),
  ];
}

export function framePolygon(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  return [...corners, corners[0]].map(([longitude, latitude]) => [Number(longitude), Number(latitude)]);
}
