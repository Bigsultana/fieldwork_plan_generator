import { describe, expect, it } from "vitest";
import { DEFAULT_EXPORT_STYLE, normaliseExportStyle } from "../src/export-style.js";

describe("export appearance settings", () => {
  it("uses readable defaults", () => {
    expect(normaliseExportStyle({})).toEqual(DEFAULT_EXPORT_STYLE);
  });

  it("bounds unsafe values and rejects unsupported fonts", () => {
    const style = normaliseExportStyle({
      fontFamily: "Comic Sans MS",
      markerLabelSize: 100,
      coordinateFontSize: 2,
      titleBlockScale: 3,
      legendFontSize: 1,
      logoScale: 4,
    });
    expect(style.fontFamily).toBe("Arial");
    expect(style.markerLabelSize).toBe(34);
    expect(style.coordinateFontSize).toBe(7);
    expect(style.titleBlockScale).toBe(1.35);
    expect(style.legendFontSize).toBe(9);
    expect(style.logoScale).toBe(1.35);
  });
});
