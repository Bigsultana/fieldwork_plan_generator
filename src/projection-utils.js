import proj4 from "proj4";

const WGS84 = "EPSG:4326";

proj4.defs(WGS84, "+proj=longlat +datum=WGS84 +no_defs +type=crs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs");
proj4.defs("EPSG:7855", "+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:7856", "+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:28355", "+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:28356", "+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs +type=crs");
proj4.defs("EPSG:32755", "+proj=utm +zone=55 +south +datum=WGS84 +units=m +no_defs +type=crs");
proj4.defs("EPSG:32756", "+proj=utm +zone=56 +south +datum=WGS84 +units=m +no_defs +type=crs");

export function resolveSourceProjection(selectedCrs, prjText = "") {
  const selected = String(selectedCrs || "auto").trim();
  if (selected && selected !== "auto") return selected;
  const prj = String(prjText || "").trim();
  if (prj) return prj;
  throw new Error("Select the source coordinate system or include a matching .prj file.");
}

export function toWgs84(sourceProjection, coordinate) {
  const x = Number(coordinate?.[0]);
  const y = Number(coordinate?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("A source coordinate is not numeric.");
  }
  const transformed = proj4(sourceProjection, WGS84, [x, y]);
  if (!transformed.every(Number.isFinite)) {
    throw new Error("A coordinate could not be transformed to WGS84.");
  }
  return transformed;
}

export function matchingPrjFile(files, stem = "") {
  const list = [...(files || [])];
  const expected = String(stem || "").toLowerCase();
  return (
    list.find((file) => {
      const lower = file.name.toLowerCase();
      const fileStem = lower.replace(/\.prj$/, "");
      return lower.endsWith(".prj") && (!expected || fileStem === expected);
    }) || list.find((file) => file.name.toLowerCase().endsWith(".prj")) || null
  );
}
