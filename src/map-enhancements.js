import L from "leaflet";
import "./map-enhancements.css";
import { readWorldFileOverlay, trimWorldFileOverlay } from "./world-file-overlay.js";
import { readDxfOverlay } from "./dxf-overlay.js";

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

function fitBoundsToA1Frame(map, bounds, { maxZoom = 19, animate = true } = {}) {
  const mapElement = map.getContainer();
  const frameElement = document.querySelector("#map-print-frame");
  if (!frameElement) {
    map.fitBounds(bounds, { padding: [25, 25], maxZoom, animate });
    return;
  }
  const mapRect = mapElement.getBoundingClientRect();
  const frameRect = frameElement.getBoundingClientRect();
  const buffer = 18;
  map.fitBounds(bounds, {
    paddingTopLeft: [
      Math.max(buffer, frameRect.left - mapRect.left + buffer),
      Math.max(buffer, frameRect.top - mapRect.top + buffer),
    ],
    paddingBottomRight: [
      Math.max(buffer, mapRect.right - frameRect.right + buffer),
      Math.max(buffer, mapRect.bottom - frameRect.bottom + buffer),
    ],
    maxZoom,
    animate,
  });
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

export function enhanceMapPlanner(mapPlanner, { setStatus = () => {} } = {}) {
  const map = mapPlanner?.map;
  const tools = document.querySelector(".map-tools");
  if (!map || !tools || tools.dataset.enhanced === "true") return mapPlanner;
  tools.dataset.enhanced = "true";

  ensurePane(map, "uploadedImageryPane", 250);
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

  const imageGroup = createGroup(`
    <h3>Georeferenced aerial image</h3>
    <label>Select image + world file
      <input id="world-image-files" class="overlay-file-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.jgw,.jpgw,.jpegw,.pgw,.pngw,.wld,.prj,image/jpeg,image/png,image/webp" />
    </label>
    <label>Coordinate system<select id="world-image-crs">${CRS_OPTIONS}</select></label>
    <label>Image opacity<input id="world-image-opacity" type="range" min="0" max="1" step="0.05" value="1" /></label>
    <label class="overlay-check"><input id="world-image-primary" type="checkbox" checked /> Use uploaded image as the main background</label>
    <label class="overlay-check"><input id="world-image-auto-trim" type="checkbox" checked /> Automatically trim white or transparent borders</label>
    <label>White-margin sensitivity
      <select id="world-image-threshold">
        <option value="240">Conservative</option>
        <option value="248" selected>Normal</option>
        <option value="253">Aggressive</option>
      </select>
    </label>
    <details class="crop-details">
      <summary>Manual crop adjustment</summary>
      <div class="crop-grid">
        <label>Left %<input id="world-crop-left" type="number" min="0" max="45" step="0.5" value="0" /></label>
        <label>Top %<input id="world-crop-top" type="number" min="0" max="45" step="0.5" value="0" /></label>
        <label>Right %<input id="world-crop-right" type="number" min="0" max="45" step="0.5" value="0" /></label>
        <label>Bottom %<input id="world-crop-bottom" type="number" min="0" max="45" step="0.5" value="0" /></label>
      </div>
      <small class="enhancement-note">Percentages are applied after automatic white-border trimming and preserve the georeferencing.</small>
    </details>
    <div class="mini-toolbar crop-toolbar">
      <button id="apply-world-crop" class="button secondary" type="button">Apply crop</button>
      <button id="fit-world-visible" class="button secondary" type="button">Fit visible content</button>
      <button id="fit-world-full" class="button secondary" type="button">Fit full image</button>
      <button id="remove-world-image" class="button danger" type="button">Remove</button>
    </div>
    <small class="enhancement-note">Select the image and matching world file together, for example <code>site.jpg</code> + <code>site.jgw</code>. The fit buttons use the blue A1 frame, not the whole browser map.</small>
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
      <button id="fit-dxf" class="button secondary" type="button">Fit DXF to A1 frame</button>
      <button id="remove-dxf" class="button danger" type="button">Remove</button>
    </div>
    <small class="enhancement-note">DXF files generally contain coordinates but not a dependable CRS. Select the correct MGA/WGS grid or include a matching <code>.prj</code>.</small>
    <p id="dxf-status" class="enhancement-status">No DXF loaded.</p>`);

  tools.insertBefore(backgroundGroup, tools.children[1] || null);
  const existingGeoTiff = [...tools.children].find((child) => child.textContent.includes("Georeferenced plan"));
  if (existingGeoTiff) existingGeoTiff.after(imageGroup, dxfGroup);
  else tools.append(imageGroup, dxfGroup);

  const basemapSelect = backgroundGroup.querySelector("#basemap-mode");
  const basemapStatus = backgroundGroup.querySelector("#basemap-status");
  let currentBasemap = null;

  function setBasemap(source) {
    removeTileLayers(map);
    currentBasemap = null;
    if (source === "none") {
      setPanelStatus(basemapStatus, "Online basemap hidden. Uploaded imagery and overlays remain visible.", "success");
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
  }

  basemapSelect.addEventListener("change", () => setBasemap(basemapSelect.value));
  setBasemap("satellite");

  const imageFiles = imageGroup.querySelector("#world-image-files");
  const imageCrs = imageGroup.querySelector("#world-image-crs");
  const imageOpacity = imageGroup.querySelector("#world-image-opacity");
  const imagePrimary = imageGroup.querySelector("#world-image-primary");
  const imageAutoTrim = imageGroup.querySelector("#world-image-auto-trim");
  const imageThreshold = imageGroup.querySelector("#world-image-threshold");
  const imageStatus = imageGroup.querySelector("#world-image-status");
  const cropInputs = {
    left: imageGroup.querySelector("#world-crop-left"),
    top: imageGroup.querySelector("#world-crop-top"),
    right: imageGroup.querySelector("#world-crop-right"),
    bottom: imageGroup.querySelector("#world-crop-bottom"),
  };
  let imageOverlay = null;
  let imageSource = null;
  let imageData = null;

  function cropOptions() {
    return {
      autoTrim: imageAutoTrim.checked,
      whiteThreshold: Number(imageThreshold.value),
      manualCrop: Object.fromEntries(
        Object.entries(cropInputs).map(([key, input]) => [key, Number(input.value) || 0]),
      ),
    };
  }

  async function renderWorldImage({ fit = true } = {}) {
    if (!imageSource) return;
    setPanelStatus(imageStatus, "Trimming and georeferencing the uploaded image…");
    const next = await trimWorldFileOverlay(imageSource, cropOptions());
    if (imageOverlay) map.removeLayer(imageOverlay);
    imageData = next;
    imageOverlay = L.imageOverlay(next.dataUrl, boundsFromCoordinates(next.visibleCoordinates), {
      opacity: Number(imageOpacity.value),
      interactive: false,
      pane: "uploadedImageryPane",
    }).addTo(map);
    if (imagePrimary.checked) {
      basemapSelect.value = "none";
      setBasemap("none");
    }
    if (fit) fitBoundsToA1Frame(map, boundsFromCoordinates(next.visibleCoordinates));
    const removedPercent = Math.max(0, Math.round((1 - next.retainedArea) * 100));
    const trimMessage = next.trimmed
      ? ` White/cropped margins removed: approximately ${removedPercent}% of the source image area.`
      : " No outer white margin was detected.";
    setPanelStatus(
      imageStatus,
      `${next.name} loaded with ${next.worldFileName}.${trimMessage}`,
      "success",
    );
  }

  async function loadWorldImage() {
    if (!imageFiles.files.length) return;
    setPanelStatus(imageStatus, "Reading image and world file…");
    try {
      imageSource = await readWorldFileOverlay(imageFiles.files, imageCrs.value);
      await renderWorldImage({ fit: true });
      setStatus(`Georeferenced image ${imageSource.name} added and fitted to the A1 frame.`);
    } catch (error) {
      imageSource = null;
      imageData = null;
      if (imageOverlay) map.removeLayer(imageOverlay);
      imageOverlay = null;
      setPanelStatus(imageStatus, error.message, "error");
      setStatus(`Unable to add georeferenced image: ${error.message}`, "error");
    } finally {
      imageFiles.value = "";
    }
  }

  imageFiles.addEventListener("change", loadWorldImage);
  imageOpacity.addEventListener("input", () => imageOverlay?.setOpacity(Number(imageOpacity.value)));
  imageGroup.querySelector("#apply-world-crop").addEventListener("click", async () => {
    if (!imageSource) return;
    try {
      await renderWorldImage({ fit: true });
      setStatus("Image crop reapplied and fitted to the A1 frame.");
    } catch (error) {
      setPanelStatus(imageStatus, error.message, "error");
    }
  });
  imageGroup.querySelector("#fit-world-visible").addEventListener("click", () => {
    if (imageData) fitBoundsToA1Frame(map, boundsFromCoordinates(imageData.visibleCoordinates));
  });
  imageGroup.querySelector("#fit-world-full").addEventListener("click", () => {
    if (imageSource) fitBoundsToA1Frame(map, boundsFromCoordinates(imageSource.fullCoordinates));
  });
  imageGroup.querySelector("#remove-world-image").addEventListener("click", () => {
    if (imageOverlay) map.removeLayer(imageOverlay);
    imageOverlay = null;
    imageData = null;
    imageSource = null;
    setPanelStatus(imageStatus, "No world-file image loaded.");
  });

  const dxfFiles = dxfGroup.querySelector("#dxf-files");
  const dxfCrs = dxfGroup.querySelector("#dxf-crs");
  const dxfColour = dxfGroup.querySelector("#dxf-colour");
  const dxfOpacity = dxfGroup.querySelector("#dxf-opacity");
  const dxfWeight = dxfGroup.querySelector("#dxf-weight");
  const dxfStatus = dxfGroup.querySelector("#dxf-status");
  let dxfData = null;
  let dxfLayer = null;

  function dxfStyle() {
    return {
      color: dxfColour.value,
      opacity: Number(dxfOpacity.value),
      weight: Number(dxfWeight.value),
    };
  }

  function renderDxf() {
    if (dxfLayer) map.removeLayer(dxfLayer);
    dxfLayer = dxfData ? addDxfToMap(map, dxfData, dxfStyle()) : null;
  }

  async function loadDxf() {
    if (!dxfFiles.files.length) return;
    setPanelStatus(dxfStatus, "Parsing and transforming DXF geometry…");
    try {
      dxfData = await readDxfOverlay(dxfFiles.files, dxfCrs.value);
      renderDxf();
      fitBoundsToA1Frame(map, boundsFromCoordinates(dxfData.boundsCoordinates));
      const skipped = dxfData.skippedCount ? ` ${dxfData.skippedCount} unsupported entities were skipped.` : "";
      setPanelStatus(dxfStatus, `${dxfData.name} loaded: ${dxfData.features.length} geometry items and ${dxfData.labels.length} labels.${skipped}`, dxfData.skippedCount ? "warning" : "success");
      setStatus(`DXF overlay ${dxfData.name} added and fitted to the A1 frame.`);
    } catch (error) {
      dxfData = null;
      if (dxfLayer) map.removeLayer(dxfLayer);
      dxfLayer = null;
      setPanelStatus(dxfStatus, error.message, "error");
      setStatus(`Unable to add DXF: ${error.message}`, "error");
    } finally {
      dxfFiles.value = "";
    }
  }

  dxfFiles.addEventListener("change", loadDxf);
  for (const control of [dxfColour, dxfOpacity, dxfWeight]) control.addEventListener("input", renderDxf);
  dxfGroup.querySelector("#fit-dxf").addEventListener("click", () => {
    if (dxfData) fitBoundsToA1Frame(map, boundsFromCoordinates(dxfData.boundsCoordinates));
  });
  dxfGroup.querySelector("#remove-dxf").addEventListener("click", () => {
    if (dxfLayer) map.removeLayer(dxfLayer);
    dxfLayer = null;
    dxfData = null;
    setPanelStatus(dxfStatus, "No DXF loaded.");
  });

  mapPlanner.fitBoundsToA1Frame = (bounds) => fitBoundsToA1Frame(map, bounds);
  return mapPlanner;
}
