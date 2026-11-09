import { describe, expect, it } from "vitest";
import { parseDxfText } from "../src/dxf-overlay.js";

const SIMPLE_DXF = `0
SECTION
2
ENTITIES
0
LINE
8
TEST
10
153.30
20
-27.90
11
153.31
21
-27.91
0
TEXT
8
TEXT
10
153.305
20
-27.905
40
2.5
1
SITE
0
ENDSEC
0
EOF
`;

describe("georeferenced DXF overlay", () => {
  it("imports survey TIN faces despite the parser's trailing empty vertex", () => {
    const face = [
      0, "3DFACE", 8, "SURFACE",
      10, 500000, 20, 6900000, 30, 100,
      11, 500010, 21, 6900000, 31, 101,
      12, 500000, 22, 6900010, 32, 102,
      13, 500000, 23, 6900010, 33, 102,
    ].join("\n");
    const line = [0, "LINE", 8, "BOUNDARY", 10, 500000, 20, 6900000, 11, 500020, 21, 6900020].join("\n");
    const text = `0\nSECTION\n2\nENTITIES\n${face}\n${line}\n0\nENDSEC\n0\nEOF\n`;
    const parsed = parseDxfText(text, "EPSG:7856");
    expect(parsed.features).toHaveLength(2);
    expect(parsed.features[0]).toMatchObject({ kind: "polygon", entityType: "3DFACE", layer: "SURFACE" });
    expect(parsed.features[0].coordinates).toHaveLength(5);
    expect(parsed.features[0].coordinates[0][0]).toBeCloseTo(153, 5);
    expect(parsed.features[0].coordinates[0][1]).toBeLessThan(-20);
    expect(parsed.features[1].layer).toBe("BOUNDARY");
    expect(parsed.skippedCount).toBe(0);
    expect(parsed.boundsCoordinates.flat().every(Number.isFinite)).toBe(true);
  });

  it("parses and transforms supported 2D entities", () => {
    const parsed = parseDxfText(SIMPLE_DXF, "EPSG:4326");
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].kind).toBe("polyline");
    expect(parsed.features[0].coordinates[0]).toEqual([153.3, -27.9]);
    expect(parsed.labels[0].text).toBe("SITE");
    expect(parsed.boundsCoordinates.length).toBeGreaterThanOrEqual(3);
  });
});
