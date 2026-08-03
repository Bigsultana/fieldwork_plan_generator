import { describe, expect, it } from "vitest";
import {
  detectCoordinateMapping,
  normalisePointType,
  parseDelimitedText,
  prepareCoordinateImport,
} from "../src/coordinate-import.js";

describe("coordinate CSV import", () => {
  it("parses quoted CSV and detects common geographic columns", () => {
    const rows = parseDelimitedText('Point ID,Type,Latitude,Longitude,Notes\nBH-A,Borehole,-27.9,153.3,"Near gate, east"');
    expect(rows).toHaveLength(2);
    expect(rows[1][4]).toBe("Near gate, east");
    expect(detectCoordinateMapping(rows[0], "EPSG:4326")).toEqual({
      id: "Point ID",
      type: "Type",
      x: "Longitude",
      y: "Latitude",
      notes: "Notes",
    });
  });

  it("detects MGA columns and transforms them into WGS84", () => {
    const headers = ["ID", "Easting", "Northing", "Type"];
    const mapping = detectCoordinateMapping(headers, "EPSG:7856");
    const result = prepareCoordinateImport({
      headers,
      rows: [["BH1", "524000", "6932800", "BH"]],
      mapping,
      sourceCrs: "EPSG:7856",
    });
    expect(result.errors).toEqual([]);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].longitude).toBeGreaterThan(150);
    expect(result.points[0].latitude).toBeLessThan(-20);
  });

  it("normalises common fieldwork type names", () => {
    expect(normalisePointType("Test Pit")).toBe("TP");
    expect(normalisePointType("monitoring well")).toBe("MW");
    expect(normalisePointType("unknown", "CPT")).toBe("CPT");
  });

  it("reports invalid coordinate rows without blocking valid rows", () => {
    const result = prepareCoordinateImport({
      headers: ["Latitude", "Longitude"],
      rows: [["-27.9", "153.3"], ["bad", "153.4"]],
      mapping: { x: "Longitude", y: "Latitude" },
      sourceCrs: "EPSG:4326",
    });
    expect(result.points).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 3/);
  });
});
