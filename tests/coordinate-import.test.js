import { describe, expect, it } from "vitest";
import {
  detectCoordinateSchema,
  inferPointTypeFromId,
  parseDelimitedText,
  prepareCoordinateImport,
} from "../src/coordinate-import.js";

describe("coordinate CSV import", () => {
  it("parses quoted CSV and detects Location ID plus geographic coordinates", () => {
    const rows = parseDelimitedText('Location ID,Latitude,Longitude\nBH-A,-27.9,153.3');
    expect(rows).toHaveLength(2);
    expect(detectCoordinateSchema(rows[0])).toEqual({
      id: "Location ID",
      longitude: "Longitude",
      latitude: "Latitude",
      easting: "",
      northing: "",
      zone: "",
      format: "geographic",
    });
  });

  it("detects MGA columns and reads the zone automatically", () => {
    const result = prepareCoordinateImport({
      headers: ["Location ID", "Easting", "Northing", "Zone"],
      rows: [["BH1", "524000", "6932800", "MGA 56"]],
      sourceCrs: "auto",
    });
    expect(result.errors).toEqual([]);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].type).toBe("BH");
    expect(result.points[0].longitude).toBeGreaterThan(150);
    expect(result.points[0].latitude).toBeLessThan(-20);
  });

  it("infers fieldwork marker type from the Location ID prefix", () => {
    expect(inferPointTypeFromId("BH12")).toBe("BH");
    expect(inferPointTypeFromId("TP-03")).toBe("TP");
    expect(inferPointTypeFromId("CPT_A")).toBe("CPT");
    expect(inferPointTypeFromId("MW1")).toBe("MW");
    expect(inferPointTypeFromId("unknown")).toBe("BH");
  });

  it("uses WGS84 automatically when Latitude and Longitude are present", () => {
    const result = prepareCoordinateImport({
      headers: ["Location ID", "Latitude", "Longitude"],
      rows: [["TP1", "-27.9", "153.3"]],
      sourceCrs: "EPSG:7856",
    });
    expect(result.errors).toEqual([]);
    expect(result.points[0]).toMatchObject({
      customLabel: "TP1",
      type: "TP",
      latitude: -27.9,
      longitude: 153.3,
    });
  });

  it("requires Location ID and one supported coordinate pair", () => {
    expect(() => prepareCoordinateImport({
      headers: ["Latitude", "Longitude"],
      rows: [["-27.9", "153.3"]],
    })).toThrow(/Location ID/);
    expect(() => prepareCoordinateImport({
      headers: ["Location ID", "X", "Y"],
      rows: [["BH1", "1", "2"]],
    })).toThrow(/Latitude and Longitude|Easting and Northing/);
  });

  it("reports invalid rows without blocking valid rows", () => {
    const result = prepareCoordinateImport({
      headers: ["Location ID", "Latitude", "Longitude"],
      rows: [["BH1", "-27.9", "153.3"], ["BH2", "bad", "153.4"]],
    });
    expect(result.points).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 3/);
  });
});
