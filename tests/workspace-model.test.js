import { describe, expect, it } from "vitest";
import { reorderLayerStack, rasterCropBounds, frameFitPadding, applyAffine, importedMapLocations } from "../src/model.js";
import { FIELDWORK_TYPES } from "../src/map-model.js";

describe("coordinate imports without popup editing", () => {
  it("retains custom IDs, coordinates, notes and the correct fieldwork symbols", () => {
    const points = importedMapLocations([{ type: "TP", longitude: "153.3", latitude: "-27.9", customLabel: " TP_A ", notes: "Access from road" }], FIELDWORK_TYPES);
    expect(points[0]).toMatchObject({ type: "TP", longitude: 153.3, latitude: -27.9, customLabel: "TP_A", notes: "Access from road", symbol: FIELDWORK_TYPES.TP.symbol, locked: false });
    expect(points[0].id).toBeTruthy();
  });
  it("rejects invalid rows before an existing point register is changed", () => {
    expect(() => importedMapLocations([{ type: "BH", longitude: 200, latitude: -27 }], FIELDWORK_TYPES)).toThrow(/valid latitude/);
    expect(() => importedMapLocations([{ type: "UNKNOWN", longitude: 153, latitude: -27 }], FIELDWORK_TYPES)).toThrow(/Unsupported/);
  });
});

describe("Contents layer order", () => {
  const layers = [{ id: "contours", opacity: .7 }, { id: "plan", visible: false }, { id: "aerial", locked: true }];
  it("moves a lower layer above an upper layer without changing other layers or properties", () => {
    const next = reorderLayerStack(layers, "aerial", "contours");
    expect(next.map((layer) => layer.id)).toEqual(["aerial", "contours", "plan"]);
    expect(next[0]).toBe(layers[2]);
    expect(layers.map((layer) => layer.id)).toEqual(["contours", "plan", "aerial"]);
  });
  it("moves an upper layer below a lower layer", () => {
    expect(reorderLayerStack(layers, "contours", "aerial", true).map((layer) => layer.id)).toEqual(["plan", "aerial", "contours"]);
  });
  it("preserves the stack when a drag refers to a removed layer or itself", () => {
    expect(reorderLayerStack(layers, "missing", "plan")).toEqual(layers);
    expect(reorderLayerStack(layers, "aerial", "missing")).toEqual(layers);
    expect(reorderLayerStack(layers, "plan", "plan")).toEqual(layers);
  });
});

describe("non-destructive raster cropping", () => {
  it("applies manual margins inside detected content while keeping original pixel coordinates", () => {
    const original = { left: 100, top: 50, right: 1100, bottom: 750 };
    const crop = rasterCropBounds(1200, 800, { left: 10, right: 5, top: 20 }, original);
    expect(crop).toEqual({ left: 200, top: 190, right: 1050, bottom: 750, width: 850, height: 560 });
    const transform = { a: .1, b: .02, c: 500000, d: .03, e: -.1, f: 6900000 };
    expect(applyAffine(transform, [crop.left, crop.top])).toEqual([500023.8, 6899987]);
    expect(original).toEqual({ left: 100, top: 50, right: 1100, bottom: 750 });
  });
  it("keeps the full native image when no crop is requested", () => {
    expect(rasterCropBounds(6000, 4000)).toEqual({ left: 0, top: 0, right: 6000, bottom: 4000, width: 6000, height: 4000 });
  });
  it("rejects invalid margins and empty crops", () => {
    expect(() => rasterCropBounds(100, 100, { left: -1 })).toThrow(/percentages/);
    expect(() => rasterCropBounds(100, 100, { right: 46 })).toThrow(/percentages/);
    expect(() => rasterCropBounds(100, 100, { top: "invalid" })).toThrow(/percentages/);
    expect(() => rasterCropBounds(1, 1)).toThrow(/whole image/);
  });
});

it("fits plans to the actual A1 frame after the workspace layout changes", () => {
  expect(frameFitPadding({ left: 200, top: 300, right: 1400, bottom: 1100 }, { left: 250, top: 400, right: 1300, bottom: 1000 }))
    .toEqual({ paddingTopLeft: [68, 118], paddingBottomRight: [118, 118] });
});
