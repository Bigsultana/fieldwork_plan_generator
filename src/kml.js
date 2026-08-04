import JSZip from "jszip";
import { FIELDWORK_TYPES, coordinateRecord, framePolygon } from "./map-model.js";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function kmlColor(hex, alpha = "ff") {
  const cleaned = String(hex || "333333").replace(/^#/, "").padStart(6, "0");
  const red = cleaned.slice(0, 2);
  const green = cleaned.slice(2, 4);
  const blue = cleaned.slice(4, 6);
  return `${alpha}${blue}${green}${red}`.toLowerCase();
}

function styleDefinitions() {
  return Object.values(FIELDWORK_TYPES)
    .map(
      (type) => `
    <Style id="style-${type.code}">
      <IconStyle>
        <color>${kmlColor(type.color)}</color>
        <scale>1.15</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
      <LabelStyle><color>ff111111</color><scale>0.9</scale></LabelStyle>
    </Style>`,
    )
    .join("");
}

function pointPlacemark(point) {
  const record = coordinateRecord(point);
  return `
      <Placemark>
        <name>${escapeXml(record.label)}</name>
        <styleUrl>#style-${escapeXml(record.type)}</styleUrl>
        <description><![CDATA[
          <b>Type:</b> ${escapeXml(record.typeName)}<br/>
          <b>Latitude:</b> ${record.latitudeText}<br/>
          <b>Longitude:</b> ${record.longitudeText}<br/>
          <b>MGA2020 Zone:</b> ${record.zone}<br/>
          <b>Easting:</b> ${record.eastingText} m<br/>
          <b>Northing:</b> ${record.northingText} m<br/>
          <b>Notes:</b> ${escapeXml(record.notes || "")}
        ]]></description>
        <ExtendedData>
          <Data name="type"><value>${escapeXml(record.type)}</value></Data>
          <Data name="label"><value>${escapeXml(record.label)}</value></Data>
          <Data name="mga2020_zone"><value>${record.zone}</value></Data>
          <Data name="easting"><value>${Math.round(record.easting)}</value></Data>
          <Data name="northing"><value>${Math.round(record.northing)}</value></Data>
        </ExtendedData>
        <Point><coordinates>${record.longitude.toFixed(9)},${record.latitude.toFixed(9)},0</coordinates></Point>
      </Placemark>`;
}

function framePlacemark(frameCorners) {
  const polygon = framePolygon(frameCorners);
  if (!polygon) return "";
  const coordinates = polygon
    .map(([longitude, latitude]) => `${longitude.toFixed(9)},${latitude.toFixed(9)},0`)
    .join(" ");
  return `
    <Placemark>
      <name>PowerPoint map extent</name>
      <Style>
        <LineStyle><color>ff0066cc</color><width>3</width></LineStyle>
        <PolyStyle><color>220066cc</color></PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>`;
}

export function buildKml({ projectTitle = "Fieldwork Plan", points = [], frameCorners = null } = {}) {
  const grouped = Object.keys(FIELDWORK_TYPES)
    .map((type) => {
      const matches = points.filter((point) => point.type === type);
      if (!matches.length) return "";
      return `
    <Folder>
      <name>${escapeXml(FIELDWORK_TYPES[type].name)}</name>${matches.map(pointPlacemark).join("")}
    </Folder>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(projectTitle)}</name>${styleDefinitions()}${framePlacemark(frameCorners)}${grouped}
  </Document>
</kml>`;
}

export async function buildKmz(options = {}) {
  const zip = new JSZip();
  zip.file("doc.kml", buildKml(options));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadKml(options, filename = "fieldwork-locations.kml") {
  const blob = new Blob([buildKml(options)], {
    type: "application/vnd.google-earth.kml+xml;charset=utf-8",
  });
  downloadBlob(blob, filename);
}

export async function downloadKmz(options, filename = "fieldwork-locations.kmz") {
  downloadBlob(await buildKmz(options), filename);
}
