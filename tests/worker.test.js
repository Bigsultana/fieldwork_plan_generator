import { describe, expect, it } from "vitest";
import { parseTilePath } from "../src/worker.js";

describe("Cloudflare map tile route", () => {
  it("accepts valid XYZ tile paths", () => {
    expect(parseTilePath("/api/tiles/10/948/603.png")).toEqual({ zoom: 10, x: 948, y: 603 });
  });

  it("rejects invalid or out-of-range paths", () => {
    expect(parseTilePath("/api/tiles/20/1/1.png")).toBeNull();
    expect(parseTilePath("/api/tiles/2/4/0.png")).toBeNull();
    expect(parseTilePath("/api/tiles/2/0/4.png")).toBeNull();
    expect(parseTilePath("/api/not-tiles/2/0/0.png")).toBeNull();
  });
});
