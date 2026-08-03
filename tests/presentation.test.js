import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../src/model.js";
import { createPresentation } from "../src/presentation.js";

const transparentPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("PowerPoint generation", () => {
  it("creates a valid zipped PPTX payload with an A1 sheet", async () => {
    const pptx = createPresentation(
      {
        ...DEFAULT_PROJECT,
        projectTitle: "Test project",
        projectNumber: "TEST-001",
        clientName: "Test client",
      },
      [
        {
          sheetNumber: "001",
          drawingTitle1: "Test Location Plan",
          drawingTitle2: "",
          drawingTitle3: "",
          scale: "NTS",
          revision: "A",
          image: { data: transparentPng, width: 1, height: 1 },
        },
      ],
    );

    const output = await pptx.write({ outputType: "arraybuffer", compression: true });
    const bytes = new Uint8Array(output);
    expect(bytes.byteLength).toBeGreaterThan(5000);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
