import { describe, expect, it } from "vitest";
import {
  croppedWorldFileTransform,
  detectVisiblePixelBounds,
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

  it("detects non-white content within a white image border", () => {
    const width = 5;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        const index = (y * width + x) * 4;
        pixels[index] = 80;
        pixels[index + 1] = 90;
        pixels[index + 2] = 100;
        pixels[index + 3] = 255;
      }
    }
    expect(detectVisiblePixelBounds(pixels, width, height)).toEqual({
      left: 1,
      top: 1,
      right: 4,
      bottom: 3,
      width: 3,
      height: 2,
      trimmed: true,
    });
  });

  it("preserves map coordinates when the image is cropped", () => {
    const transform = parseWorldFile("2\n0\n0\n-2\n100\n200");
    const cropped = croppedWorldFileTransform(transform, 10, 5);
    expect(cropped.c).toBe(120);
    expect(cropped.f).toBe(190);
    const originalCorner = worldFileNativeCorners(transform, 100, 100)[0];
    const croppedCorner = worldFileNativeCorners(cropped, 90, 95)[0];
    expect(croppedCorner[0] - originalCorner[0]).toBe(20);
    expect(croppedCorner[1] - originalCorner[1]).toBe(-10);
  });
});
