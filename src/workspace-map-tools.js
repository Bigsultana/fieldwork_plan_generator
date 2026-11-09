import L from "leaflet";
import { createMgaGridLayer } from "./map-grid.js";
import { frameFitPadding } from "./model.js";
import { workspaceElement as node, workspaceButton as button, workspaceMenu } from "./workspace-controls.js";

export function installWorkspaceMapTools(planner, { ribbon, setStatus }) {
  const map = planner.map;
  map.options.zoomSnap = .05;
  map.options.zoomDelta = .25;
  map.options.wheelPxPerZoomLevel = 120;
  map.options.wheelDebounceTime = 30;
  const background = node("label", "workspace-inline-control", "Background");
  const basemap = node("select"); basemap.id = "basemap-mode";
  basemap.innerHTML = '<option value="satellite">Satellite</option><option value="street">Street map</option><option value="none">None</option>';
  background.append(basemap); ribbon.append(background);
  let currentBasemap = null;
  let backgroundErrors = 0;
  // Replace the initial street tiles once; imported raster layers are separate
  // GridLayers and must never be removed when changing the basemap.
  map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
  function setBasemap() {
    if (currentBasemap) map.removeLayer(currentBasemap);
    currentBasemap = null; backgroundErrors = 0;
    if (basemap.value === "none") return;
    const source = basemap.value;
    currentBasemap = L.tileLayer(`/api/tiles/${source}/{z}/{x}/{y}.${source === "satellite" ? "jpg" : "png"}`, {
      minZoom: 0, maxZoom: 26, maxNativeZoom: 19, crossOrigin: "anonymous", keepBuffer: 3,
      attribution: source === "satellite" ? "Imagery © Esri and contributors" : "© OpenStreetMap contributors © CARTO",
    });
    currentBasemap.on("tileerror", () => {
      backgroundErrors++;
      setStatus("Some background tiles could not be loaded. Uploaded plans remain available.", "warning");
    });
    currentBasemap.addTo(map);
  }
  basemap.addEventListener("change", setBasemap);

  const view = workspaceMenu("View", { closeOnAction: false }); ribbon.append(view.element);
  view.content.innerHTML = `<label class="inline-check"><input id="layer-points" type="checkbox" checked> Fieldwork locations</label>
    <label class="inline-check"><input id="layer-mga-grid" type="checkbox"> MGA grid</label>
    <label>Grid spacing<select id="mga-grid-spacing"><option value="0">Automatic</option>${[10,20,50,100,200,500,1000].map((v) => `<option value="${v}">${v} m</option>`).join("")}</select></label>
    <label>Grid opacity<input id="mga-grid-opacity" type="range" min="0.15" max="0.9" step="0.05" value="0.45"></label>
    <label>Map nudge step<select id="workspace-nudge-step"><option value="5">5 px</option><option value="10" selected>10 px</option><option value="25">25 px</option><option value="50">50 px</option></select></label>
    <div class="workspace-nudge-buttons" aria-label="Nudge map"></div><small>Alt + arrow keys also nudge the map.</small>`;
  const points = view.content.querySelector("#layer-points");
  points.addEventListener("change", () => planner.setPointVisibility(points.checked));
  const gridToggle = view.content.querySelector("#layer-mga-grid");
  const spacing = view.content.querySelector("#mga-grid-spacing");
  const opacity = view.content.querySelector("#mga-grid-opacity");
  const gridPane = map.createPane("gridPane"); gridPane.style.zIndex = "420";
  let grid = null, gridFrame = null;
  function renderGrid() {
    if (gridFrame) cancelAnimationFrame(gridFrame);
    gridFrame = requestAnimationFrame(() => {
      if (grid) map.removeLayer(grid);
      grid = gridToggle.checked ? createMgaGridLayer(map, { pane: "gridPane", spacing: Number(spacing.value), opacity: Number(opacity.value) }).addTo(map) : null;
    });
  }
  gridToggle.addEventListener("change", renderGrid);
  spacing.addEventListener("change", renderGrid);
  opacity.addEventListener("input", renderGrid);
  map.on("moveend zoomend", () => { if (gridToggle.checked) renderGrid(); });
  const nudgeStep = view.content.querySelector("#workspace-nudge-step");
  const directions = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };
  function nudge(key) { map.panBy(directions[key].map((v) => v * Number(nudgeStep.value)), { animate: false }); }
  const nudgeButtons = view.content.querySelector(".workspace-nudge-buttons");
  for (const [key, text] of [["ArrowLeft","←"],["ArrowUp","↑"],["ArrowDown","↓"],["ArrowRight","→"]]) nudgeButtons.append(button(text, () => nudge(key), `Nudge ${key.slice(5).toLowerCase()}`));
  document.addEventListener("keydown", (event) => {
    if (event.altKey && directions[event.key] && !event.defaultPrevented && !event.target.closest("input,textarea,select,[contenteditable=true]")) {
      event.preventDefault(); nudge(event.key);
    }
  });
  planner.fitBoundsToA1Frame = (bounds, options = {}) => {
    const mapRect = map.getContainer().getBoundingClientRect();
    const frameRect = document.querySelector("#map-print-frame").getBoundingClientRect();
    map.fitBounds(bounds, { ...frameFitPadding(mapRect, frameRect), maxZoom: 26, animate: false, ...options });
  };
  planner.getLayerState = () => ({ basemap: basemap.value, points: points.checked,
    mgaGrid: grid?.gridMetadata ? { ...grid.gridMetadata } : null });
  const originalQa = planner.getQaWarnings.bind(planner);
  planner.getQaWarnings = () => {
    const warnings = originalQa();
    if (backgroundErrors) warnings.push("Some online background tiles were unavailable.");
    if (grid?.gridMetadata) {
      const zone = grid.gridMetadata.zone;
      if (planner.getPoints().some((point) => Math.floor((point.longitude + 180) / 6) + 1 !== zone)) warnings.push(`The MGA grid is Zone ${zone}; some fieldwork locations use another zone.`);
    }
    return warnings;
  };
  setBasemap();
}
