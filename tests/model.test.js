import { describe, expect, it } from "vitest";
import {
  applyCsvRows,
  fitContain,
  parseCsv,
  sanitizeFilename,
  titleFromFilename,
  validateSheets,
} from "../src/model.js";

describe("model helpers", () => {
  it("creates readable titles from filenames", () => {
    expect(titleFromFilename("test_location-plan.png")).toBe("Test Location Plan");
  });

  it("fits wide images inside a box", () => {
    expect(fitContain(2000, 1000, { x: 1, y: 2, w: 8, h: 8 })).toEqual({
      x: 1,
      y: 4,
      w: 8,
      h: 4,
    });
  });

  it("parses quoted CSV and applies rows by image order", () => {
    const rows = parseCsv(
      'sheet_number,drawing_title_1,drawing_title_2,scale,revision\n001,"Plan, overall",Proposed works,1:500,B',
    );
    const sheets = applyCsvRows(
      [
        {
          id: "1",
          file: {},
          sheetNumber: "099",
          drawingTitle1: "Original",
          drawingTitle2: "",
          drawingTitle3: "",
          scale: "NTS",
          revision: "-",
        },
      ],
      rows,
    );
    expect(sheets[0]).toMatchObject({
      sheetNumber: "001",
      drawingTitle1: "Plan, overall",
      drawingTitle2: "Proposed works",
      scale: "1:500",
      revision: "B",
    });
  });

  it("reports duplicate sheet numbers", () => {
    const errors = validateSheets([
      { file: {}, sheetNumber: "001", drawingTitle1: "One" },
      { file: {}, sheetNumber: "001", drawingTitle1: "Two" },
    ]);
    expect(errors.some((error) => error.includes("duplicate sheet number"))).toBe(true);
  });

  it("creates safe output filenames", () => {
    expect(sanitizeFilename("  Project 25 / Stage A  ")).toBe("Project-25-Stage-A");
  });
});
