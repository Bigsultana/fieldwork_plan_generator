import { describe, expect, it } from "vitest";
import { applyAffine, invertAffine, fitReferencePoints, worldToPixelTransform } from "../src/model.js";
import { geoTiffTransform, matchingSidecar, rasterPlacement } from "../src/plan-import.js";

describe("manual image alignment", () => {
  const transform = { a: 0.12, b: 0.07, c: 17000000, d: 0.03, e: -0.15, f: -3200000 };
  const sources = [[0, 0], [12000, 0], [0, 8000], [12000, 8000], [4000, 3000]];
  it("recovers rotation, scale and shear at projected map magnitudes", () => {
    const fitted = fitReferencePoints(sources.map((source) => ({ source, target: applyAffine(transform, source) })));
    for (const source of sources) {
      const output = applyAffine(fitted.transform, source);
      const expected = applyAffine(transform, source);
      expect(output[0]).toBeCloseTo(expected[0], 5);
      expect(output[1]).toBeCloseTo(expected[1], 5);
    }
    expect(fitted.rms).toBeLessThan(1e-6);
  });
  it("reports residual error with redundant control points", () => {
    const controls = sources.map((source) => ({ source, target: applyAffine(transform, source) }));
    controls[4].target[0] += 5;
    expect(fitReferencePoints(controls).rms).toBeGreaterThan(1);
  });
  it("rejects insufficient, collinear, repeated and collapsed controls", () => {
    expect(() => fitReferencePoints([])).toThrow(/three/);
    expect(() => fitReferencePoints([[0, 0], [1, 1], [2, 2]].map((source) => ({ source, target: source })))).toThrow(/line/);
    expect(() => fitReferencePoints(Array(3).fill({ source: [1, 1], target: [0, 0] }))).toThrow(/distinct/);
    expect(() => fitReferencePoints(sources.map((source) => ({ source, target: [0, 0] })))).toThrow(/collapsed/);
  });
  it("inverts rotations and accounts for world-file pixel centres", () => {
    const cornerTransform = worldToPixelTransform(transform);
    expect(applyAffine(cornerTransform, [0.5, 0.5])).toEqual([transform.c, transform.f]);
    const input = [1234, 5678];
    const result = applyAffine(invertAffine(transform), applyAffine(transform, input));
    expect(result[0]).toBeCloseTo(input[0], 6);
    expect(result[1]).toBeCloseTo(input[1], 6);
  });
});

describe("raster placement", () => {
  it("reads rotated GeoTIFF matrices and tiepoint pixel offsets", () => {
    const matrix = [2, .1, 0, 500, .2, -2, 0, 800, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(geoTiffTransform({ ModelTransformation: matrix })).toEqual({ a: 2, b: .1, c: 500, d: .2, e: -2, f: 800 });
    const result = geoTiffTransform({ ModelPixelScale: [2, 3, 0], ModelTiepoint: [10, 20, 0, 1000, 2000, 0] });
    expect(applyAffine(result, [10, 20])).toEqual([1000, 2000]);
    expect(geoTiffTransform({ getValue: (name) => ({ ModelPixelScale: [2, 3, 0], ModelTiepoint: [10, 20, 0, 1000, 2000, 0] })[name] })).toEqual(result);
  });
  it("preserves rotated coordinates through CRS reprojection and inverse sampling", () => {
    const entry = { width: 5000, height: 4000, nativeTransform: { a: .1, b: .02, c: 530000, d: .03, e: -.1, f: 6912000 } };
    const placement = rasterPlacement(entry, "EPSG:7856");
    const source = [2345.67, 1234.56];
    const result = placement.toPixel(placement.toMercator(source));
    expect(result[0]).toBeCloseTo(source[0], 5);
    expect(result[1]).toBeCloseTo(source[1], 5);
    expect(placement.corners).toHaveLength(4);
    expect(() => rasterPlacement(entry, "auto")).toThrow(/coordinate system/);
  });
  it("does not attach another image's world or projection file", () => {
    const files = [{ name: "other.jgw" }, { name: "SITE.JGW" }, { name: "other.prj" }];
    expect(matchingSidecar(files, "site.jpg", [".jgw"])).toBe(files[1]);
    expect(matchingSidecar(files, "site.jpg", [".prj"])).toBeUndefined();
  });
});
