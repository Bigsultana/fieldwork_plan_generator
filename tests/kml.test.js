import { describe, expect, it } from "vitest";
import { buildKml, buildKmz } from "../src/kml.js";
import { renumberPoints } from "../src/map-model.js";

describe("GIS export", () => {
  const points = renumberPoints([
    { id: "1", type: "BH", longitude: 153.312, latitude: -27.91, notes: "Target 8 m" },
    { id: "2", type: "TP", longitude: 153.313, latitude: -27.911, notes: "" },
  ]);

  it("creates KML placemarks with longitude-latitude coordinates", () => {
    const kml = buildKml({ projectTitle: "Test project", points, frameCorners: [[153.30, -27.90], [153.32, -27.90], [153.32, -27.92], [153.30, -27.92]] });
    expect(kml).toContain("<name>BH1</name>");
    expect(kml).toContain("153.312000000,-27.910000000,0");
    expect(kml).toContain("PowerPoint map extent");
  });

  it("packages doc.kml inside a KMZ zip", async () => {
    const blob = await buildKmz({ projectTitle: "Test project", points });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
