import { describe, expect, it } from "vitest";
import { parseDxfText } from "../src/dxf-overlay.js";
import { dxfComponents, dxfScopeMatches, dxfComponentAppearance } from "../src/model.js";

const entities = [
  0,"LWPOLYLINE",5,"A1",8,"BOUNDARY",90,3,70,0,10,530000,20,6912000,10,530040,20,6912000,10,530040,20,6911960,
  0,"TEXT",5,"B1",8,"BOUNDARY",10,530020,20,6911980,40,2,1,"BOUNDARY NOTE",
  0,"TEXT",5,"B2",8,"LEVELS",10,530030,20,6911970,40,2,1,"RL 100.0",
].join("\n");
const source = `0\nSECTION\n2\nENTITIES\n${entities}\n0\nENDSEC\n0\nEOF\n`;
const settings = () => ({ color: "#111111", weight: 1.5, textSize: 11, textVisible: true, layerStyles: new Map() });

describe("DXF component editing", () => {
  it("retains distinct identities, CAD layers and entity types for geometry and text", () => {
    const parts = dxfComponents(parseDxfText(source,"EPSG:7856"));
    expect(parts).toHaveLength(3);
    expect(new Set(parts.map((part) => part.id)).size).toBe(3);
    expect(parts[0]).toMatchObject({ layer:"BOUNDARY", category:"geometry", entityType:"LWPOLYLINE", handle:"A1" });
    expect(parts[1]).toMatchObject({ layer:"BOUNDARY", category:"text", entityType:"TEXT", text:"BOUNDARY NOTE" });
  });

  it("isolates one entity, a CAD layer, or only text within a layer", () => {
    const parts = dxfComponents(parseDxfText(source,"EPSG:7856"));
    expect(parts.filter((part) => dxfScopeMatches(part,{layer:"BOUNDARY"}))).toHaveLength(2);
    expect(parts.filter((part) => dxfScopeMatches(part,{layer:"BOUNDARY", category:"text"})).map((part) => part.handle)).toEqual(["B1"]);
    parts.filter((part) => dxfScopeMatches(part,{id:parts[0].id})).forEach((part) => { part.deleted = true; });
    expect(parts.map((part) => dxfComponentAppearance(part,settings()).visible)).toEqual([false,true,true]);
    parts[0].deleted = false;
    expect(dxfComponentAppearance(parts[0],settings()).visible).toBe(true);
  });

  it("combines visibility gates without resetting individual choices", () => {
    const parts = dxfComponents(parseDxfText(source,"EPSG:7856")), defaults = settings();
    parts[1].visible = false;
    defaults.textVisible = false;
    expect(parts.map((part) => dxfComponentAppearance(part,defaults).visible)).toEqual([true,false,false]);
    defaults.textVisible = true;
    expect(parts.map((part) => dxfComponentAppearance(part,defaults).visible)).toEqual([true,false,true]);
    defaults.layerStyles.set("BOUNDARY",{geometry:{visible:false}});
    expect(parts.map((part) => dxfComponentAppearance(part,defaults).visible)).toEqual([false,false,true]);
    defaults.layerStyles.set("LEVELS",{visible:false});
    expect(parts.every((part) => !dxfComponentAppearance(part,defaults).visible)).toBe(true);
  });

  it("inherits styles with independent entity overrides", () => {
    const parts = dxfComponents(parseDxfText(source,"EPSG:7856")), defaults = settings();
    defaults.layerStyles.set("BOUNDARY",{color:"#00ff00", weight:3, text:{color:"#0000ff",textSize:18}});
    parts[0].style.weight = 6;
    expect(dxfComponentAppearance(parts[0],defaults)).toMatchObject({color:"#00ff00",weight:6});
    expect(dxfComponentAppearance(parts[1],defaults)).toMatchObject({color:"#0000ff",textSize:18});
    expect(dxfComponentAppearance(parts[2],defaults)).toMatchObject({color:"#111111",weight:1.5,textSize:11});
    delete parts[0].style.weight;
    expect(dxfComponentAppearance(parts[0],defaults).weight).toBe(3);
  });

  it("preserves edits and deletions after reprojection while updating coordinates", () => {
    const parts = dxfComponents(parseDxfText(source,"EPSG:7856"));
    parts[0].deleted = true; parts[1].visible = false; parts[2].style = {color:"#ff00ff",textSize:20};
    const reprojected = dxfComponents(parseDxfText(source,"EPSG:7855"),parts);
    expect(reprojected[0].deleted).toBe(true);
    expect(reprojected[1].visible).toBe(false);
    expect(reprojected[2].style).toEqual(parts[2].style);
    expect(reprojected[0].coordinates[0][0]).not.toBe(parts[0].coordinates[0][0]);
    expect(reprojected[2].style).not.toBe(parts[2].style);
  });

  it("distinguishes repeated block children and inherits the insert's CAD layer for layer 0", () => {
    const block = [0,"BLOCK",2,"MARK",10,0,20,0,30,0,
      0,"LINE",5,"CHILD",8,"0",10,0,20,0,11,10,21,0,
      0,"TEXT",8,"ANNOTATION",10,0,20,0,40,1,1,"LABEL",0,"ENDBLK"].join("\n");
    const inserts = [0,"INSERT",5,"I1",8,"SURVEY",2,"MARK",10,530000,20,6912000,
      0,"INSERT",5,"I2",8,"BOUNDARY",2,"MARK",10,530020,20,6912000].join("\n");
    const file = `0\nSECTION\n2\nBLOCKS\n${block}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${inserts}\n0\nENDSEC\n0\nEOF\n`;
    const parts = dxfComponents(parseDxfText(file,"EPSG:7856"));
    expect(parts).toHaveLength(4);
    expect(new Set(parts.map((part) => part.id)).size).toBe(4);
    expect(parts.filter((part) => part.category === "geometry").map((part) => part.layer)).toEqual(["SURVEY","BOUNDARY"]);
    expect(parts.filter((part) => part.category === "text").every((part) => part.layer === "ANNOTATION")).toBe(true);
  });
});
