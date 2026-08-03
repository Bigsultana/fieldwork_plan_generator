import { describe, expect, it } from "vitest";
import { engineeringGridSpacing } from "../src/map-grid.js";

describe("engineering MGA grid spacing", () => {
  it("chooses a readable standard spacing", () => {
    expect(engineeringGridSpacing(400)).toBe(50);
    expect(engineeringGridSpacing(1600)).toBe(200);
    expect(engineeringGridSpacing(8200)).toBe(2000);
  });
});
