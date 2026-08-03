import { describe, expect, it } from "vitest";
import {
  parseWorldFile,
  worldFileCoordinates,
  worldFileNativeCorners,
} from "../src/world-file-overlay.js";

describe("world-file image georeferencing", () => {
  it("parses the standard six-line world-file order", () => {
    expect(parseWorldFile("1\n0\n0\n-1\n100\n-30\n")).toEqual({
      a: 1,
      d: 0,
      b: 0,
      e: -1,
      c: 100,
      f: -30,
    });
  });

  it("uses pixel-edge corners rather than pixel centres", () => {
    const transform = parseWorldFile("1\n0\n0\n-1\n100\n-30");
    expect(worldFileNativeCorners(transform, 2, 2)).toEqual([
      [99.5, -29.5],
      [101.5, -29.5],
      [101.5, -31.5],
      [99.5, -31.5],
    ]);
    const [longitude, latitude] = worldFileCoordinates(transform, 2, 2, "EPSG:4326")[0];
    expect(longitude).toBeCloseTo(99.5, 10);
    expect(latitude).toBeCloseTo(-29.5, 10);
  });

  it("rejects rotated world files until rotated-image rendering is supported", () => {
    const rotated = parseWorldFile("1\n0.1\n0\n-1\n100\n-30");
    expect(() => worldFileCoordinates(rotated, 2, 2, "EPSG:4326")).toThrow(/Rotated world files/);
  });
});
