// Source image pixels -> projected coordinates. Pixel (0,0) is the outer corner.
export function applyAffine(t, [x, y]) {
  return [t.a * x + t.b * y + t.c, t.d * x + t.e * y + t.f];
}

export function invertAffine(t) {
  const determinant = t.a * t.e - t.b * t.d;
  const scale = Math.max(Math.abs(t.a), Math.abs(t.b), Math.abs(t.d), Math.abs(t.e));
  if (!scale || Math.abs(determinant) < scale * scale * 1e-12) {
    throw new Error("The reference points produce a collapsed image. Spread the points across the plan.");
  }
  const inverse = { a: t.e / determinant, b: -t.b / determinant, d: -t.d / determinant, e: t.a / determinant };
  inverse.c = -inverse.a * t.c - inverse.b * t.f;
  inverse.f = -inverse.d * t.c - inverse.e * t.f;
  return inverse;
}

function solve(matrix, vector) {
  const rows = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let i = column + 1; i < 3; i++) if (Math.abs(rows[i][column]) > Math.abs(rows[pivot][column])) pivot = i;
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error("Reference points must not lie on one line.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let i = 0; i < 3; i++) {
      if (i === column) continue;
      const factor = rows[i][column];
      rows[i] = rows[i].map((value, j) => value - factor * rows[column][j]);
    }
  }
  return rows.map((row) => row[3]);
}

export function fitReferencePoints(controls) {
  if (controls.length < 3) throw new Error("Add at least three matching reference points.");
  if (controls.some((point) => [...point.source, ...point.target].some((value) => !Number.isFinite(value)))) {
    throw new Error("Reference coordinates must be finite numbers.");
  }
  // Centre and scale before least squares: MGA northings and large scans otherwise
  // make the normal equations poorly conditioned.
  const mean = [0, 1].map((axis) => controls.reduce((sum, p) => sum + p.source[axis], 0) / controls.length);
  const scale = Math.max(...controls.flatMap((p) => p.source.map((v, i) => Math.abs(v - mean[i]))));
  if (!scale) throw new Error("Choose distinct reference points.");
  const rows = controls.map((p) => [(p.source[0] - mean[0]) / scale, (p.source[1] - mean[1]) / scale, 1]);
  const normal = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const coefficients = [0, 1].map((axis) => solve(normal, [0, 1, 2].map((i) => rows.reduce((sum, row, j) => sum + row[i] * controls[j].target[axis], 0))));
  const [[a, b, c], [d, e, f]] = coefficients;
  const transform = { a: a / scale, b: b / scale, c: c - (a * mean[0] + b * mean[1]) / scale,
    d: d / scale, e: e / scale, f: f - (d * mean[0] + e * mean[1]) / scale };
  invertAffine(transform);
  const residuals = controls.map((p) => {
    const predicted = applyAffine(transform, p.source);
    return Math.hypot(predicted[0] - p.target[0], predicted[1] - p.target[1]);
  });
  return { transform, residuals, rms: Math.sqrt(residuals.reduce((sum, v) => sum + v * v, 0) / controls.length) };
}

export function imageCorners(width, height) {
  return [[0, 0], [width, 0], [width, height], [0, height]];
}

export function worldToPixelTransform(world) {
  const { a, b, c, d, e, f } = world;
  return { a, b, c: c - (a + b) / 2, d, e, f: f - (d + e) / 2 };
}
