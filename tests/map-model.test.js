import { describe, expect, it } from "vitest";
import {
  coordinateRecord,
  overlayCornerCoordinates,
  renumberPoints,
  scaleFromFrameWidth,
  utmZone,
} from "../src/map-model.js";

describe("map planning helpers", () => {
  it("numbers each fieldwork type independently", () => {
    const points = renumberPoints([
      { id: "1", type: "BH", longitude: 153.3, latitude: -27.9 },
      { id: "2", type: "TP", longitude: 153.31, latitude: -27.91 },
      { id: "3", type: "BH", longitude: 153.32, latitude: -27.92 },
    ]);
    expect(points.map((point) => point.label)).toEqual(["BH1", "TP1", "BH2"]);
  });

  it("calculates a practical MGA2020 coordinate record", () => {
    const record = coordinateRecord({ id: "1", type: "BH", label: "BH1", typeName: "Borehole", longitude: 153.312, latitude: -27.91 });
    expect(record.zone).toBe(56);
    expect(record.easting).toBeGreaterThan(400000);
    expect(record.easting).toBeLessThan(700000);
    expect(record.northing).toBeGreaterThan(6800000);
    expect(record.northing).toBeLessThan(7100000);
  });

  it("selects UTM zones from longitude", () => {
    expect(utmZone(147)).toBe(55);
    expect(utmZone(153)).toBe(56);
  });

  it("rounds map scale to an engineering-friendly scale", () => {
    expect(scaleFromFrameWidth(817)).toBe(1000);
    expect(scaleFromFrameWidth(410)).toBe(750);
  });

  it("transforms a Web Mercator bounding box to WGS84 corners", () => {
    const corners = overlayCornerCoordinates([0, 0, 111319.4908, 111325.1429], "EPSG:3857");
    expect(corners[0][0]).toBeCloseTo(0, 4);
    expect(corners[0][1]).toBeCloseTo(1, 3);
    expect(corners[2][0]).toBeCloseTo(1, 3);
    expect(corners[2][1]).toBeCloseTo(0, 4);
  });
});
