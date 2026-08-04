import L from "leaflet";
import "./map-enhancements.css";
import "./map-layer-manager.css";
import { readWorldFileOverlay } from "./world-file-overlay.js";
import { readDxfOverlay } from "./dxf-overlay.js";
import { createMgaGridLayer } from "./map-grid.js";

const CRS_OPTIONS = `
  <option value="auto">Use matching .prj file</option>
  <option value="EPSG:7856">GDA2020 / MGA Zone 56</option>
  <option value="EPSG:7855">GDA2020 / MGA Zone 55</option>
  <option value="EPSG:28356">GDA94 / MGA Zone 56</option>
  <option value="EPSG:28355">GDA94 / MGA Zone 55</option>
  <option value="EPSG:4326">WGS84 latitude / longitude</option>
  <option value="EPSG:3857">Web Mercator</option>`;

function createGroup(html) {
  const group = document.createElement("div");
  group.className = "tool-group";
  group.innerHTML = html;
  return group;
}

function boundsFromCoordinates(coordinates) {
  return L.latLngBounds(coordinates.map(([longitude, latitude]) => [latitude, longitude]));
}

function setPanelStatus(element, message, tone = "neutral") {
  element.textContent = message;
  element.dataset.tone = tone;
}

function tileLayer(source) {
  const extension = source === "satellite" ? "jpg" : "png";
  const attribution = source === "satellite"
    ? "Imagery © Esri and contributors"
    : "© OpenStreetMap contributors © CARTO";
  return L.tileLayer(`${window.location.origin}/api/tiles/${source}/{z}/{x}/{y}.${extension}`, {
    minZoom: 0,
    maxZoom: 19,
    maxNativeZoom: 19,
    tileSize: 256,
    detectRetina: false,
    updateWhenIdle: false,
    keepBuffer: 3,
    crossOrigin: "anonymous",
    attribution,
  });
}

function removeTileLayers(map) {
  const layers = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) layers.push(layer);
  });
  layers.forEach((layer) => map.removeLayer(layer));
}

function ensurePane(map, name, zIndex) {
  const pane = map.getPane(name) || map.createPane(name);
  pane.style.zIndex = String(zIndex);
  return pane;
}

function addDxfToMap(map, parsed, style) {
  const group = L.layerGroup();
  const lineOptions = {
    color: style.color,
    opacity: style.opacity,
    weight: style.weight,
    pane: "dxfPane",
    interactive: false,
  };
  parsed.features.forEach((feature) => {
    if (feature.kind === "point") {
      L.circleMarker([feature.coordinate[1], feature.coordinate[0]], {
        ...lineOptions,
        radius: Math.max(2.5, style.weight * 1.7),
        fillColor: style.color,
        fillOpacity: style.opacity,
      }).addTo(group);
      return;
    }
    const latLngs = feature.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
    if (feature.kind === "polygon") {
      L.polygon(latLngs, { ...lineOptions, fill: false }).addTo(group);
    } else {
      L.polyline(latLngs, lineOptions).addTo(group);
    }
  });
  parsed.labels.forEach((label) => {
    const icon = L.divIcon({
      className: "",
      html: `<span class="dxf-map-label" style="color:${style.color};opacity:${style.opacity}">${String(label.text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")}</span>`,
      iconSize: null,
    });
    L.marker([label.coordinate[1], label.coordinate[0]], {
      icon,
      interactive: false,
      keyboard: false,
      pane: "dxfPane",
    }).addTo(group);
  });
  return group.addTo(map);
}

function checkboxRow(id, label, state, checked = true, disabled = false) {
  return `
    <label class="layer-manager-row${disabled ? " disabled" : "}" for="${id}">
      <input id="${id}" type="checkbox"${checked ? " checked" : ""}${disabled ? " disabled" : ""} />
      <span>${label}</span>
      <span class="layer-state">${state}</span>
    </label>`;
}

export function enhanceMapPlanner(mapPlanner, { setStatus = () => {} } = {}) {
  const map = mapPlanner?.map;
  const tools = document.querySelector(".map-tools");
  if (!map || !tools || tools.dataset.enhanced === "true") return mapPlanner;
  tools.dataset.enhanced = "true";

  ensurePane(map, "uploadedImageryPane", 250);
  ensurePane(map, "gridPane", 420);
  ensurePane(map, "dxfPane", 450);

  const backgroundGroup = createGroup(`
    <h3>Background</h3>
    <label>Basemap
      <select id="basemap-mode">
        <option value="satellite" selected>Satellite imagery</option>
        <option value="street">Street map</option>
        <option value="none">None / uploaded imagery only</option>
      </select>
    </label>
    <small class="enhancement-note">Satellite imagery is served through Cloudflare from Esri World Imagery. Use your licensed Nearmap or MetroMap export for project-specific, current imagery.</small>
    <p id="basemap-status" class="enhancement-status">Loading satellite imagery…</p>`);

  const layerGroup = createGroup(`
    <h3>Layers & MGA grid</h3>
    <div class="layer-manager-list">
      ${checkboxRow("layer-points", "Fieldwork locations", "visible", true)}
      ${checkboxRow("layer-basemap", "Online basemap", "visible", true)}
      ${checkboxRow("layer-world-image", "Uploaded aerial image", "not loaded", false, true)}
      ${checkboxRow("layer-dxf", "DXF overlay", "not loaded", false, true)}
      ${checkboxRow("layer-mga-grid", "GDA2020 / MGA grid", "off", false)}
    </div>
    <div class="layer-manager-controls">
      <label>Grid spacing
        <select id="mga-grid-spacing">
          <option value="0" selected>Automatic</option>
          <option value="10">10 m</option>
          <option value="20">20 m</option>
          <option value="50">50 m</option>
          <option value="100">100 m</option>
          <option value="200">200 m</option>
          <option value="500">500 m</option>
          <option value="1000">1,000 m</option>
        </select>
      </label>
      <label>Grid opacity<input id="mga-grid-opacity" type="range" min="0.15" max="0.9" step="0.05" value="0.45" /></label>
    </div>
    <p id="layer-manager-status" class="enhancement-status">Fieldwork locations and the online basemap are visible.</p>`);

  const imageGroup = createGroup(`
    <h3>Georeferenced aerial image</h3>
    <label>Select image + world file
      <input id="world-image-files" class="overlay-file-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.jgw,.jpgw,.jpegw,.pgw,.pngw,.wld,.prj,image/jpeg,image/png,image/webp" />
    </label>
    <label>Coordinate system<select id="world-image-crs">${CRS_OPTIONS}</select></label>
    <label>Image opacity<input id="world-image-opacity" type="range" min="0" max="1" step="0.05" value="1" /></label>
    <label class="overlay-check"><input id="world-image-primary" type="checkbox" checked /> Use uploaded image as the main background</label>
    <div class="mini-toolbar">
      <button id="fit-world-image" class="button secondary" type="button">Fit image</button>
      <button id="remove-world-image" class="button danger" type="button">Remove</button>
    </div>
    <small class="enhancement-note">Select the image and matching world file together, for example <code>site.jpg</code> + <code>site.jgw</code>. A matching <code>.prj</code> can define the CRS. North-up exports are supported.</small>
    <p id="world-image-status" class="enhancement-status">No world-file image loaded.</p>`);

  const dxfGroup = createGroup(`
    <h3>Georeferenced DXF overlay</h3>
    <label>Select DXF + optional PRJ
      <input id="dxf-files" class="overlay-file-input" type="file" multiple accept=".dxf,.prj,application/dxf" />
    </label>
    <label>DXF coordinate system<select id="dxf-crs">${CRS_OPTIONS}</select></label>
    <label>Line colour<input id="dxf-colour" type="color" value="#e11d48" /></label>
    <label>DXF opacity<input id="dxf-opacity" type="range" min="0" max="1" step="0.05" value="0.9" /></label>
    <label>Line weight<input id="dxf-weight" type="range" min="1" max="6" step="0.5" value="2" /></label>
    <div class="mini-toolbar">
      <button id="fit-dxf" class="button secondary" type="button">Fit DXF</button>
      <button id="remove-dxf" class="button danger" type="button">Remove</button>
    </div>
    <small class="enhancement-note">DXF files generally contain coordinates but not a dependable CRS. Select the correct MGA/WGS grid or include a matching <code>.prj</code>. Supported 2D geometry includes lines, polylines, arcs, circles, points, text and common block inserts.</small>
    <p id="dxf-status" class="enhancement-status">No DXF loaded.</p>`);

  tools.insertBefore(backgroundGroup, tools.children[1] || null);
  backgroundGroup.after(layerGroup);
  const existingGeoTiff = [...tools.children].find((child) => child.textContent.includes("Georeferenced plan"));
  if (existingGeoTiff) existingGeoTiff.after(imageGroup, dxfGroup);
  else tools.append(imageGroup, dxfGroup);

  const basemapSelect = backgroundGroup.querySelector("#basemap-mode");
  const basemapStatus = backgroundGroup.querySelector("#basemap-status");
  const layerStatus = layerGroup.querySelector("#layer-manager-status");
  const pointToggle = layerGroup.querySelector("#layer-points");
  const basemapToggle = layerGroup.querySelector("#layer-basemap");
  const imageToggle = layerGroup.querySelector("#layer-world-image");
  const dxfToggle = layerGroup.querySelector("#layer-dxf");
  const gridToggle = layerGroup.querySelector("#layer-mga-grid");
  const gridSpacing = layerGroup.querySelector("#mga-grid-spacing");
  const gridOpacity = layerGroup.querySelector("#mga-grid-opacity");

  let currentBasemap = null;
  let selectedBasemap = "satellite";
  let imageOverlay = null;
  let imageData = null;
  let dxfData = null;
  let dxfLayer = null;
  let gridLayer = null;
  let gridFrame = null;

  function updateLayerStatus() {
    const visible = [];
    if (pointToggle.checked) visible.push("locations");
    if (basemapToggle.checked && selectedBasemap !== "none") visible.push(selectedBasemap);
    if (imageToggle.checked && imageData) visible.push("uploaded image");
    if (dxfToggle.checked && dxfData) visible.push("DXF");
    if (gridToggle.checked && gridLayer?.gridMetadata) visible.push(`MGA grid ${gridLayer.gridMetadata.spacing} m`);
    setPanelStatus(layerStatus, visible.length ? `Visible: ${visible.join(", ")}.` : "No map layers are currently visible.", visible.length ? "success" : "warning");
  }

  function setBasemap(source = selectedBasemap) {
    selectedBasemap = source;
    removeTileLayers(map);
    currentBasemap = null;
    if (source === "none" || !basemapToggle.checked) {
      setPanelStatus(basemapStatus, "Online basemap hidden. Uploaded imagery and overlays remain visible.", "success");
      updateLayerStatus();
      return;
    }
    currentBasemap = tileLayer(source);
    currentBasemap.on("load", () => setPanelStatus(
      basemapStatus,
      source === "satellite" ? "Satellite imagery loaded." : "Street map loaded.",
      "success",
    ));
    currentBasemap.on("tileerror", () => setPanelStatus(basemapStatus, "Some background tiles could not be loaded.", "warning"));
    currentBasemap.addTo(map).bringToBack();
    setPanelStatus(basemapStatus, `Loading ${source === "satellite" ? "satellite imagery" : "street map"}…`);
    updateLayerStatus();
  }

  function setToggleAvailable(toggle, available, checked = available) {
    toggle.disabled = !available;
    toggle.checked = Boolean(checked && available);
    toggle.closest(".layer-manager-row")?.classList.toggle("disabled", !available);
    const state = toggle.closest(".layer-manager-row")?.querySelector(".layer-state");
    if (state) state.textContent = available ? (toggle.checked ? "visible" : "hidden") : "not loaded";
  }

  function updateToggleState(toggle) {
    const state = toggle.closest(".layer-manager-row")?.querySelector(".layer-state");
    if (state) state.textContent = toggle.checked ? "visible" : "hidden";
  }

  function renderGrid() {
    if (gridFrame) cancelAnimationFrame(gridFrame);
    gridFrame = requestAnimationFrame(() => {
      if (gridLayer) map.removeLayer(gridLayer);
      gridLayer = null;
      if (!gridToggle.checked) {
        updateToggleState(gridToggle);
        updateLayerStatus();
        return;
      }
      gridLayer = createMgaGridLayer(map, {
        spacing: Number(gridSpacing.value),
        opacity: Number(gridOpacity.value),
        pane: "gridPane",
      }).addTo(map);
      const state = gridToggle.closest(".layer-manager-row")?.querySelector(".layer-state");
      if (state) state.textContent = `${gridLayer.gridMetadata.spacing} m`;
      updateLayerStatus();
    });
  }

  basemapSelect.addEventListener("change", () => {
    selectedBasemap = basemapSelect.value;
    basemapToggle.checked = selectedBasemap !== "none";
    updateToggleState(basemapToggle);
    setBasemap(selectedBasemap);
  });
  basemapToggle.addEventListener("change", () => {
    updateToggleState(basemapToggle);
    setBasemap(selectedBasemap);
  });
  pointToggle.addEventListener("change", () => {
    mapPlanner.setPointVisibility?.(pointToggle.checked);
    updateToggleState(pointToggle);
    updateLayerStatus();
  });
  gridToggle.addEventListener("change", renderGrid);
  gridSpacing.addEventListener("change", renderGrid);
  gridOpacity.addEventListener("input", renderGrid);
  map.on("moveend zoomend", () => {
    if (gridToggle.checked) renderGrid();
  });
  setBasemap("satellite");

  const imageFiles = imageGroup.querySelector("#world-image-files");
  const imageCrs = imageGroup.querySelector("#world-image-crs");
  const imageOpacity = imageGroup.querySelector("#world-image-opacity");
  const imagePrimary = imageGroup.querySelector("#world-image-primary");
  const imageStatus = imageGroup.querySelector("#world-image-status");

  async function loadWorldImage() {
    if (!imageFiles.files.length) return;
    setPanelStatus(imageStatus, "Reading image and world file…");
    try {
      const next = await readWorldFileOverlay(imageFiles.files, imageCrs.value);
      if (imageOverlay) map.removeLayer(imageOverlay);
      imageData = next;
      imageOverlay = L.imageOverlay(next.dataUrl, boundsFromCoordinates(next.coordinates), {
        opacity: Number(imageOpacity.value),
        interactive: false,
        pane: "uploadedImageryPane",
      }).addTo(map);
      setToggleAvailable(imageToggle, true, true);
      if (imagePrimary.checked) {
        basemapSelect.value = "none";
        basemapToggle.checked = false;
        setBasemap("none");
      }
      map.fitBounds(boundsFromCoordinates(next.coordinates), { padding: [25, 25], maxZoom: 19 });
      setPanelStatus(imageStatus, `${next.name} loaded with ${next.worldFileName}.`, "success");
      setStatus(`Georeferenced image ${next.name} added.`);
      updateLayerStatus();
    } catch (error) {
      imageData = null;
      if (imageOverlay) map.removeLayer(imageOverlay);
      imageOverlay = null;
      setToggleAvailable(imageToggle, false, false);
      setPanelStatus(imageStatus, error.message, "error");
      setStatus(`Unable to add georeferenced image: ${error.message}`, "error");
    } finally {
      imageFiles.value = "";
    }
  }

  imageFiles.addEventListener("change", loadWorldImage);
  imageOpacity.addEventListener("input", () => imageOverlay?.setOpacity(Number(imageOpacity.value)));
  imageToggle.addEventListener("change", () => {
    if (imageOverlay) {
      if (imageToggle.checked && !map.hasLayer(imageOverlay)) imageOverlay.addTo(map);
      if (!imageToggle.checked && map.hasLayer(imageOverlay)) map.removeLayer(imageOverlay);
    }
    updateToggleState(imageToggle);
    updateLayerStatus();
  });
  imageGroup.querySelector("#fit-world-image").addEventListener("click", () => {
    if (imageData) map.fitBounds(boundsFromCoordinates(imageData.coordinates), { padding: [25, 25], maxZoom: 19 });
  });
  imageGroup.querySelector("#remove-world-image").addEventListener("click", () => {
    if (imageOverlay) map.removeLayer(imageOverlay);
    imageOverlay = null;
    imageData = null;
    setToggleAvailable(imageToggle, false, false);
    setPanelStatus(imageStatus, "No world-file image loaded.");
    updateLayerStatus();
  });

  const dxfFiles = dxfGroup.querySelector("#dxf-files");
  const dxfCrs = dxfGroup.querySelector("#dxf-crs");
  const dxfColour = dxfGroup.querySelector("#dxf-colour");
  const dxfOpacity = dxfGroup.querySelector("#dxf-opacity");
  const dxfWeight = dxfGroup.querySelector("#dxf-weight");
  const dxfStatus = dxfGroup.querySelector("#dxf-status");

  function dxfStyle() {
    return {
      color: dxfColour.value,
      opacity: Number(dxfOpacity.value),
      weight: Number(dxfWeight.value),
    };
  }

  function renderDxf() {
    if (dxfLayer) map.removeLayer(dxfLayer);
    dxfLayer = dxfData && dxfToggle.checked ? addDxfToMap(map, dxfData, dxfStyle()) : null;
    updateLayerStatus();
  }

  async function loadDxf() {
    if (!dxfFiles.files.length) return;
    setPanelStatus(dxfStatus, "Parsing and transforming DXF geometry…");
    try {
      dxfData = await readDxfOverlay(dxfFiles.files, dxfCrs.value);
      setToggleAvailable(dxfToggle, true, true);
      renderDxf();
      const bounds = boundsFromCoordinates(dxfData.boundsCoordinates);
      map.fitBounds(bounds, { padding: [25, 25], maxZoom: 19 });
      const skipped = dxfData.skippedCount ? ` ${dxfData.skippedCount} unsupported entities were skipped.` : "";
      setPanelStatus(dxfStatus, `${dxfData.name} loaded: ${dxfData.features.length} geometry items and ${dxfData.labels.length} labels.${skipped}`, dxfData.skippedCount ? "warning" : "success");
      setStatus(`DXF overlay ${dxfData.name} added.`);
    } catch (error) {
      dxfData = null;
      if (dxfLayer) map.removeLayer(dxfLayer);
      dxfLayer = null;
      setToggleAvailable(dxfToggle, false, false);
      setPanelStatus(dxfStatus, error.message, "error");
      setStatus(`Unable to add DXF: ${error.message}`, "error");
    } finally {
      dxfFiles.value = "";
    }
  }

  dxfFiles.addEventListener("change", loadDxf);
  for (const control of [dxfColour, dxfOpacity, dxfWeight]) control.addEventListener("input", renderDxf);
  dxfToggle.addEventListener("change", () => {
    updateToggleState(dxfToggle);
    renderDxf();
  });
  dxfGroup.querySelector("#fit-dxf").addEventListener("click", () => {
    if (dxfData) map.fitBounds(boundsFromCoordinates(dxfData.boundsCoordinates), { padding: [25, 25], maxZoom: 19 });
  });
  dxfGroup.querySelector("#remove-dxf").addEventListener("click", () => {
    if (dxfLayer) map.removeLayer(dxfLayer);
    dxfLayer = null;
    dxfData = null;
    setToggleAvailable(dxfToggle, false, false);
    setPanelStatus(dxfStatus, "No DXF loaded.");
    updateLayerStatus();
  });

  const baseQa = mapPlanner.getQaWarnings?.bind(mapPlanner) || (() => []);
  mapPlanner.getQaWarnings = () => {
    const warnings = [...baseQa()];
    if (!basemapToggle.checked && !imageData) warnings.push("No online or uploaded aerial background is visible.");
    if (imageData && dxfData) {
      const imageBounds = boundsFromCoordinates(imageData.coordinates);
      const dxfBounds = boundsFromCoordinates(dxfData.boundsCoordinates);
      if (!imageBounds.intersects(dxfBounds)) warnings.push("The uploaded aerial image and DXF extents do not overlap; confirm their coordinate systems.");
    }
    if (gridToggle.checked && gridLayer?.gridMetadata) {
      const zone = gridLayer.gridMetadata.zone;
      const pointZones = new Set((mapPlanner.getPoints?.() || []).map((point) => Math.floor((Number(point.longitude) + 180) / 6) + 1));
      if (pointZones.size > 1 || (pointZones.size === 1 && !pointZones.has(zone))) {
        warnings.push(`The displayed MGA grid is Zone ${zone}, but one or more locations calculate in another MGA zone.`);
      }
    }
    return [...new Set(warnings)];
  };

  const baseCapture = mapPlanner.capturePlan.bind(mapPlanner);
  mapPlanner.capturePlan = async () => {
    const plan = await baseCapture();
    if (!plan) return plan;
    return {
      ...plan,
      qaWarnings: mapPlanner.getQaWarnings(),
      layerSummary: {
        basemap: basemapToggle.checked ? selectedBasemap : "none",
        uploadedImage: Boolean(imageData && imageToggle.checked),
        dxf: Boolean(dxfData && dxfToggle.checked),
        mgaGrid: gridToggle.checked && gridLayer?.gridMetadata ? { ...gridLayer.gridMetadata } : null,
      },
    };
  };

  mapPlanner.getLayerState = () => ({
    basemap: basemapToggle.checked ? selectedBasemap : "none",
    points: pointToggle.checked,
    uploadedImage: Boolean(imageData && imageToggle.checked),
    dxf: Boolean(dxfData && dxfToggle.checked),
    mgaGrid: gridToggle.checked && gridLayer?.gridMetadata ? { ...gridLayer.gridMetadata } : null,
  });

  setToggleAvailable(imageToggle, false, false);
  setToggleAvailable(dxfToggle, false, false);
  updateLayerStatus();
  return mapPlanner;
}
