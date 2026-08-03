import { describe, expect, it } from "vitest";
import { assignLabelOffsets, evaluateMapQa } from "../src/map-point-layout.js";

describe("marker label layout", () => {
  it("moves nearby labels onto different candidate offsets", () => {
    const points = [
      { id: "1", label: "BH1" },
      { id: "2", label: "BH2" },
    ];
    const result = assignLabelOffsets(points, () => ({ x: 100, y: 100 }));
    expect(result.offsets.get("1")).not.toEqual(result.offsets.get("2"));
    expect(result.unresolved).toBe(0);
  });
});

describe("map QA", () => {
  const frame = [
    [153, -27],
    [154, -27],
    [154, -28],
    [153, -28],
  ];

  it("warns about duplicate IDs and locations outside the frame", () => {
    const warnings = evaluateMapQa(
      [
        { label: "BH1", longitude: 153.5, latitude: -27.5 },
        { label: "BH1", longitude: 155, latitude: -27.5 },
      ],
      frame,
    );
    expect(warnings.join(" ")).toMatch(/Duplicate location IDs/);
    expect(warnings.join(" ")).toMatch(/outside the blue PowerPoint frame/);
  });

  it("reports unresolved label collisions", () => {
    const warnings = evaluateMapQa([], frame, { unresolvedLabels: 2 });
    expect(warnings.join(" ")).toMatch(/2 marker labels still overlap/);
  });
});
