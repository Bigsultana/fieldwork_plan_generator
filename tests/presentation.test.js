import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../src/model.js";
import { createPresentation } from "../src/presentation-enhanced.js";

const transparentPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("PowerPoint generation", () => {
  it("creates a valid zipped PPTX payload containing a map, revision strip and supporting sheet", async () => {
    const project = {
      ...DEFAULT_PROJECT,
      projectTitle: "Test project",
      projectNumber: "TEST-001",
      clientName: "Test client",
      revision: "A",
      revisionDescription: "Initial issue for fieldwork",
      revisionDate: "03/08/2026",
      revisionBy: "MR",
    };
    const mapPlan = {
      image: { data: transparentPng, width: 817, height: 516 },
      sheet: { sheetNumber: "001", drawingTitle1: "Proposed Fieldwork Plan", drawingTitle2: "Test site", drawingTitle3: "2 proposed fieldwork locations", scale: "1:1000", revision: "A" },
      points: [
        { label: "BH1", typeName: "Borehole", latitudeText: "-27.9100000", longitudeText: "153.3120000", zone: 56, eastingText: "530,000", northingText: "6,912,000", notes: "" },
        { label: "TP1", typeName: "Test pit", latitudeText: "-27.9110000", longitudeText: "153.3130000", zone: 56, eastingText: "530,100", northingText: "6,911,900", notes: "" },
      ],
    };
    const pptx = createPresentation(project, [{ sheetNumber: "002", drawingTitle1: "Site Layout", drawingTitle2: "", drawingTitle3: "", scale: "NTS", revision: "A", image: { data: transparentPng, width: 1, height: 1 } }], null, mapPlan);
    const output = await pptx.write({ outputType: "arraybuffer", compression: true });
    const bytes = new Uint8Array(output);
    expect(bytes.byteLength).toBeGreaterThan(9000);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
