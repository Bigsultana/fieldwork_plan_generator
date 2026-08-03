import parseDxf, { DxfParser } from "dxf-parser";
import { matchingPrjFile, resolveSourceProjection, toWgs84 } from "./projection-utils.js";

const TAU = Math.PI * 2;

function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function apply(matrix, point) {
  const x = Number(point?.x ?? point?.[0]);
  const y = Number(point?.y ?? point?.[1]);
  return [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ];
}

function multiply(left, right) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function insertMatrix(entity, block) {
  const rotation = (Number(entity.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const sx = Number(entity.xScale || entity.scaleX || 1);
  const sy = Number(entity.yScale || entity.scaleY || 1);
  const position = entity.position || { x: 0, y: 0 };
  const base = block?.position || block?.basePoint || { x: 0, y: 0 };
  return {
    a: cos * sx,
    b: sin * sx,
    c: -sin * sy,
    d: cos * sy,
    e: Number(position.x || 0) - cos * sx * Number(base.x || 0) + sin * sy * Number(base.y || 0),
    f: Number(position.y || 0) - sin * sx * Number(base.x || 0) - cos * sy * Number(base.y || 0),
  };
}

function radians(value) {
  const number = Number(value || 0);
  return Math.abs(number) > TAU + 0.01 ? (number * Math.PI) / 180 : number;
}

function sampleArc(center, radius, startAngle, endAngle, segments = 48) {
  let start = radians(startAngle);
  let end = radians(endAngle);
  while (end <= start) end += TAU;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = start + ((end - start) * index) / segments;
    return {
      x: Number(center.x) + Number(radius) * Math.cos(angle),
      y: Number(center.y) + Number(radius) * Math.sin(angle),
    };
  });
}

function sourcePolyline(entity) {
  const type = String(entity.type || "").toUpperCase();
  if (["LINE", "LWPOLYLINE", "POLYLINE", "SPLINE", "SOLID", "3DFACE"].includes(type)) {
    return entity.vertices || entity.controlPoints || entity.fitPoints || [];
  }
  if (type === "CIRCLE") return sampleArc(entity.center, entity.radius, 0, TAU, 64);
  if (type === "ARC") return sampleArc(entity.center, entity.radius, entity.startAngle, entity.endAngle, 48);
  if (type === "ELLIPSE" && entity.center && entity.majorAxisEndPoint) {
    const major = entity.majorAxisEndPoint;
    const ratio = Number(entity.axisRatio || 1);
    let start = radians(entity.startAngle || 0);
    let end = radians(entity.endAngle ?? TAU);
    while (end <= start) end += TAU;
    return Array.from({ length: 65 }, (_, index) => {
      const angle = start + ((end - start) * index) / 64;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: Number(entity.center.x) + Number(major.x) * cos - Number(major.y) * ratio * sin,
        y: Number(entity.center.y) + Number(major.y) * cos + Number(major.x) * ratio * sin,
      };
    });
  }
  return [];
}

function entityPoint(entity) {
  return entity.position || entity.startPoint || entity.center || entity.vertices?.[0] || null;
}

function parseText(text) {
  if (typeof parseDxf === "function") return parseDxf(text);
  const Parser = DxfParser || parseDxf?.DxfParser;
  if (!Parser) throw new Error("The DXF parser could not be loaded.");
  return new Parser().parseSync(text);
}

export function parseDxfText(text, sourceProjection) {
  const dxf = parseText(text);
  const features = [];
  const labels = [];
  const boundsCoordinates = [];
  let skippedCount = 0;

  const convert = (point, matrix) => {
    const transformed = toWgs84(sourceProjection, apply(matrix, point));
    boundsCoordinates.push(transformed);
    return transformed;
  };

  const visit = (entity, matrix = identity(), depth = 0) => {
    if (!entity || depth > 8) return;
    const type = String(entity.type || "").toUpperCase();
    if (type === "INSERT") {
      const block = dxf.blocks?.[entity.name];
      if (!block?.entities) {
        skippedCount += 1;
        return;
      }
      const childMatrix = multiply(matrix, insertMatrix(entity, block));
      block.entities.forEach((child) => visit(child, childMatrix, depth + 1));
      return;
    }

    const vertices = sourcePolyline(entity);
    if (vertices.length >= 2) {
      const coordinates = vertices.map((vertex) => convert(vertex, matrix));
      const closed = Boolean(entity.shape || entity.closed || ["CIRCLE", "SOLID", "3DFACE"].includes(type));
      if (closed && coordinates.length && coordinates.at(-1).some((value, index) => value !== coordinates[0][index])) {
        coordinates.push([...coordinates[0]]);
      }
      features.push({
        kind: closed ? "polygon" : "polyline",
        coordinates,
        layer: entity.layer || "0",
        entityType: type,
      });
      return;
    }

    if (type === "POINT") {
      const point = entityPoint(entity);
      if (point) features.push({ kind: "point", coordinate: convert(point, matrix), layer: entity.layer || "0", entityType: type });
      else skippedCount += 1;
      return;
    }

    if (["TEXT", "MTEXT", "ATTRIB", "ATTDEF"].includes(type)) {
      const point = entityPoint(entity);
      const value = entity.text || entity.string || entity.value;
      if (point && value) labels.push({ coordinate: convert(point, matrix), text: String(value), layer: entity.layer || "0" });
      else skippedCount += 1;
      return;
    }

    skippedCount += 1;
  };

  (dxf.entities || []).forEach((entity) => visit(entity));
  if (!features.length && !labels.length) {
    throw new Error("No supported 2D DXF geometry was found.");
  }
  return {
    features,
    labels,
    boundsCoordinates,
    entityCount: (dxf.entities || []).length,
    skippedCount,
  };
}

export async function readDxfOverlay(files, selectedCrs = "auto") {
  const list = [...(files || [])];
  const dxfFile = list.find((file) => file.name.toLowerCase().endsWith(".dxf"));
  if (!dxfFile) throw new Error("Select a DXF file.");
  const fileStem = dxfFile.name.toLowerCase().replace(/\.dxf$/, "");
  const prjFile = matchingPrjFile(list, fileStem);
  const prjText = prjFile ? await prjFile.text() : "";
  const sourceProjection = resolveSourceProjection(selectedCrs, prjText);
  const parsed = parseDxfText(await dxfFile.text(), sourceProjection);
  return {
    ...parsed,
    name: dxfFile.name,
    sourceCrs: selectedCrs === "auto" ? "PRJ-defined CRS" : selectedCrs,
  };
}
