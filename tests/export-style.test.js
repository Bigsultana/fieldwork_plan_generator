import { describe, expect, it } from "vitest";
import { DEFAULT_EXPORT_STYLE, normaliseExportStyle } from "../src/export-style.js";

describe("export appearance settings", () => {
  it("uses readable defaults", () => {
    expect(normaliseExportStyle({})).toEqual(DEFAULT_EXPORT_STYLE);
    expect(DEFAULT_EXPORT_STYLE.mapResolutionScale).toBe(1.5);
  });

  it("bounds unsafe values and rejects unsupported fonts", () => {
    const style = normaliseExportStyle({
      fontFamily: "Comic Sans MS",
      markerLabelSize: 100,
      coordinateFontSize: 2,
      titleBlockScale: 3,
      legendFontSize: 1,
      logoScale: 4,
      mapResolutionScale: 9,
    });
    expect(style.fontFamily).toBe("Arial");
    expect(style.markerLabelSize).toBe(34);
    expect(style.coordinateFontSize).toBe(7);
    expect(style.titleBlockScale).toBe(1.35);
    expect(style.legendFontSize).toBe(9);
    expect(style.logoScale).toBe(1.35);
    expect(style.mapResolutionScale).toBe(2);
  });

  it("snaps map resolution to supported output sizes", () => {
    expect(normaliseExportStyle({ mapResolutionScale: 1.4 }).mapResolutionScale).toBe(1.5);
    expect(normaliseExportStyle({ mapResolutionScale: 1.1 }).mapResolutionScale).toBe(1);
  });
});
