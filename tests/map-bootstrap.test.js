import { describe, expect, it } from "vitest";
import {
  FALLBACK_MAP_STYLE,
  isGeocodeRequest,
  isPrimaryStyleRequest,
} from "../src/map-bootstrap.js";

describe("map bootstrap", () => {
  it("recognises the configured vector-style request", () => {
    expect(isPrimaryStyleRequest("https://tiles.openfreemap.org/styles/liberty")).toBe(true);
    expect(isPrimaryStyleRequest("https://tiles.openfreemap.org/styles/liberty/")).toBe(true);
  });

  it("provides a complete raster fallback style", () => {
    expect(FALLBACK_MAP_STYLE.version).toBe(8);
    expect(FALLBACK_MAP_STYLE.sources.openstreetmap.tiles[0]).toContain("{z}/{x}/{y}");
    expect(FALLBACK_MAP_STYLE.layers[0]).toMatchObject({ type: "raster", source: "openstreetmap" });
  });

  it("recognises same-origin geocoding calls", () => {
    expect(isGeocodeRequest("https://example.com/api/geocode?q=Oxenford")).toBe(true);
    expect(isGeocodeRequest("https://example.com/other?q=Oxenford")).toBe(false);
  });
});
