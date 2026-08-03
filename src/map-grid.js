import L from "leaflet";
import proj4 from "proj4";
import { engineeringGridSpacing } from "./grid-spacing.js";

const WGS84 = "+proj=longlat +datum=WGS84 +no_defs +type=crs";

function zoneFromLongitude(longitude) {
  return Math.min(60, Math.max(1, Math.floor((Number(longitude) + 180) / 6) + 1));
}

function definition(zone) {
  return `+proj=utm +zone=${Number(zone)} +south +ellps=GRS80 +units=m +no_defs +type=crs`;
}

function labelIcon(text, axis) {
  return L.divIcon({
    className: "mga-grid-label-icon",
    html: `<span class="mga-grid-label ${axis}">${text}</span>`,
    iconSize: null,
  });
}

export function createMgaGridLayer(map, options = {}) {
  const bounds = map.getBounds();
  const centre = map.getCenter();
  const zone = zoneFromLongitude(centre.lng);
  const projected = definition(zone);
  const corners = [
    [bounds.getWest(), bounds.getSouth()],
    [bounds.getWest(), bounds.getNorth()],
    [bounds.getEast(), bounds.getSouth()],
    [bounds.getEast(), bounds.getNorth()],
  ].map((coordinate) => proj4(WGS84, projected, coordinate));

  const eastings = corners.map((coordinate) => coordinate[0]);
  const northings = corners.map((coordinate) => coordinate[1]);
  const minE = Math.min(...eastings);
  const maxE = Math.max(...eastings);
  const minN = Math.min(...northings);
  const maxN = Math.max(...northings);
  const automatic = engineeringGridSpacing(Math.max(maxE - minE, maxN - minN));
  const spacing = Number(options.spacing) > 0 ? Number(options.spacing) : automatic;
  const firstE = Math.ceil(minE / spacing) * spacing;
  const firstN = Math.ceil(minN / spacing) * spacing;
  const group = L.layerGroup();
  const lineStyle = {
    color: options.color || "#1f4f7a",
    opacity: Number(options.opacity ?? 0.48),
    weight: Number(options.weight ?? 1),
    dashArray: options.dashArray || "4 5",
    interactive: false,
    pane: options.pane || "gridPane",
  };

  for (let easting = firstE; easting <= maxE; easting += spacing) {
    const south = proj4(projected, WGS84, [easting, minN]);
    const north = proj4(projected, WGS84, [easting, maxN]);
    L.polyline(
      [
        [south[1], south[0]],
        [north[1], north[0]],
      ],
      lineStyle,
    ).addTo(group);
    L.marker([south[1], south[0]], {
      icon: labelIcon(`${Math.round(easting).toLocaleString("en-AU")} E`, "easting"),
      interactive: false,
      keyboard: false,
      pane: options.pane || "gridPane",
    }).addTo(group);
  }

  for (let northing = firstN; northing <= maxN; northing += spacing) {
    const west = proj4(projected, WGS84, [minE, northing]);
    const east = proj4(projected, WGS84, [maxE, northing]);
    L.polyline(
      [
        [west[1], west[0]],
        [east[1], east[0]],
      ],
      lineStyle,
    ).addTo(group);
    L.marker([west[1], west[0]], {
      icon: labelIcon(`${Math.round(northing).toLocaleString("en-AU")} N`, "northing"),
      interactive: false,
      keyboard: false,
      pane: options.pane || "gridPane",
    }).addTo(group);
  }

  group.gridMetadata = {
    zone,
    crs: `GDA2020 / MGA Zone ${zone}`,
    spacing,
  };
  return group;
}

export { engineeringGridSpacing };
