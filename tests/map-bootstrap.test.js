import { describe, expect, it } from "vitest";
import {
  FALLBACK_MAP_STYLE,
  createMapStyle,
  isGeocodeRequest,
  isPrimaryStyleRequest,
} from "../src/map-bootstrap.js";

describe("map bootstrap", () => {
  it("recognises the configured vector-style request", () => {
    expect(isPrimaryStyleRequest("https://tiles.openfreemap.org/styles/liberty")).toBe(true);
    expect(isPrimaryStyleRequest("https://tiles.openfreemap.org/styles/liberty/")).toBe(true);
  });

  it("provides an absolute same-origin raster style", () => {
    const style = createMapStyle("https://preview.example/path");
    expect(style.version).toBe(8);
    expect(style.sources.basemap.tiles[0]).toBe(
      "https://preview.example/api/tiles/{z}/{x}/{y}.png",
    );
    expect(style.layers[0]).toMatchObject({ type: "raster", source: "basemap" });
    expect(FALLBACK_MAP_STYLE.sources.basemap.tiles[0]).toContain(
      "/api/tiles/{z}/{x}/{y}.png",
    );
  });

  it("recognises same-origin geocoding calls", () => {
    expect(isGeocodeRequest("https://example.com/api/geocode?q=Oxenford")).toBe(true);
    expect(isGeocodeRequest("https://example.com/other?q=Oxenford")).toBe(false);
  });
});
