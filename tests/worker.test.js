import { describe, expect, it } from "vitest";
import { parseTilePath } from "../src/worker.js";

describe("Cloudflare map tile route", () => {
  it("accepts street, satellite and legacy XYZ tile paths", () => {
    expect(parseTilePath("/api/tiles/street/10/948/603.png")).toEqual({ source: "street", zoom: 10, x: 948, y: 603 });
    expect(parseTilePath("/api/tiles/satellite/10/948/603.jpg")).toEqual({ source: "satellite", zoom: 10, x: 948, y: 603 });
    expect(parseTilePath("/api/tiles/10/948/603.png")).toEqual({ source: "street", zoom: 10, x: 948, y: 603 });
  });

  it("rejects invalid or out-of-range paths", () => {
    expect(parseTilePath("/api/tiles/satellite/20/1/1.jpg")).toBeNull();
    expect(parseTilePath("/api/tiles/street/2/4/0.png")).toBeNull();
    expect(parseTilePath("/api/tiles/unknown/2/0/0.png")).toBeNull();
    expect(parseTilePath("/api/not-tiles/2/0/0.png")).toBeNull();
  });
});
