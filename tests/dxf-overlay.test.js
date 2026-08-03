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
  it("parses and transforms supported 2D entities", () => {
    const parsed = parseDxfText(SIMPLE_DXF, "EPSG:4326");
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].kind).toBe("polyline");
    expect(parsed.features[0].coordinates[0]).toEqual([153.3, -27.9]);
    expect(parsed.labels[0].text).toBe("SITE");
    expect(parsed.boundsCoordinates.length).toBeGreaterThanOrEqual(3);
  });
});
