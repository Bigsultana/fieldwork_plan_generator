const SPACINGS = Object.freeze([10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]);

export function engineeringGridSpacing(spanMetres, targetLines = 8) {
  const desired = Math.max(1, Number(spanMetres) / Math.max(2, Number(targetLines)));
  return SPACINGS.find((spacing) => spacing >= desired) || SPACINGS.at(-1);
}
