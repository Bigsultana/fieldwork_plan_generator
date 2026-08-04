const LABEL_CANDIDATES = Object.freeze([
  Object.freeze({ x: 0, y: 24 }),
  Object.freeze({ x: 38, y: 0 }),
  Object.freeze({ x: -38, y: 0 }),
  Object.freeze({ x: 0, y: -30 }),
  Object.freeze({ x: 38, y: 24 }),
  Object.freeze({ x: -38, y: 24 }),
  Object.freeze({ x: 38, y: -26 }),
  Object.freeze({ x: -38, y: -26 }),
]);

function labelBox(point, projected, offset) {
  const label = String(point.customLabel || point.label || point.type || "");
  const width = Math.max(34, Math.min(120, 12 + label.length * 9));
  const height = 20;
  return {
    left: projected.x + offset.x - width / 2,
    right: projected.x + offset.x + width / 2,
    top: projected.y + offset.y - height / 2,
    bottom: projected.y + offset.y + height / 2,
  };
}

function boxesOverlap(a, b, padding = 3) {
  return !(
    a.right + padding < b.left ||
    a.left - padding > b.right ||
    a.bottom + padding < b.top ||
    a.top - padding > b.bottom
  );
}

export function assignLabelOffsets(points, projectPoint) {
  const occupied = [];
  const offsets = new Map();
  let unresolved = 0;

  for (const point of points || []) {
    const projected = projectPoint(point);
    let chosen = LABEL_CANDIDATES[0];
    let found = false;

    for (const candidate of LABEL_CANDIDATES) {
      const box = labelBox(point, projected, candidate);
      if (!occupied.some((other) => boxesOverlap(box, other))) {
        chosen = candidate;
        occupied.push(box);
        found = true;
        break;
      }
    }

    if (!found) {
      occupied.push(labelBox(point, projected, chosen));
      unresolved += 1;
    }
    offsets.set(point.id, { ...chosen });
  }

  return { offsets, unresolved };
}

function frameBounds(frameCorners) {
  if (!Array.isArray(frameCorners) || frameCorners.length !== 4) return null;
  const longitudes = frameCorners.map((corner) => Number(corner?.[0])).filter(Number.isFinite);
  const latitudes = frameCorners.map((corner) => Number(corner?.[1])).filter(Number.isFinite);
  if (longitudes.length !== 4 || latitudes.length !== 4) return null;
  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  };
}

function pointInside(bounds, point) {
  return (
    Number(point.longitude) >= bounds.west &&
    Number(point.longitude) <= bounds.east &&
    Number(point.latitude) >= bounds.south &&
    Number(point.latitude) <= bounds.north
  );
}

export function evaluateMapQa(points, frameCorners, options = {}) {
  const warnings = [];
  const list = points || [];
  const bounds = frameBounds(frameCorners);
  const labels = new Set();
  const duplicates = new Set();

  if (!list.length) warnings.push("No fieldwork locations have been placed.");

  for (const point of list) {
    const label = String(point.customLabel || point.label || "").trim().toUpperCase();
    if (label && labels.has(label)) duplicates.add(label);
    labels.add(label);
  }

  if (duplicates.size) warnings.push(`Duplicate location IDs: ${[...duplicates].join(", ")}.`);
  if (bounds) {
    const outside = list.filter((point) => !pointInside(bounds, point));
    if (outside.length) {
      warnings.push(
        `${outside.length} location${outside.length === 1 ? " is" : "s are"} outside the blue PowerPoint frame: ${outside
          .map((point) => point.customLabel || point.label)
          .join(", ")}.`,
      );
    }
  }

  if (Number(options.unresolvedLabels) > 0) {
    warnings.push(
      `${Number(options.unresolvedLabels)} marker label${Number(options.unresolvedLabels) === 1 ? " still overlaps" : "s still overlap"}; zoom in or move the locations.`,
    );
  }

  if (Number(options.scale) > 5000 && list.length > 6) {
    warnings.push("The selected map scale may make a dense fieldwork layout difficult to read at A1.");
  }

  return warnings;
}
