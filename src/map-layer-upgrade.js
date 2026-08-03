import "./map-layer-manager.css";
import { createMgaGridLayer } from "./map-grid.js";

function createGroup(html) {
  const group = document.createElement("div");
  group.className = "tool-group";
  group.innerHTML = html;
  return group;
}

function row(id, label, state, checked = true, disabled = false) {
  const disabledClass = disabled ? " disabled" : "";
  const checkedAttribute = checked ? " checked" : "";
  const disabledAttribute = disabled ? " disabled" : "";
  return `
    <label class="layer-manager-row${disabledClass}" for="${id}">
      <input id="${id}" type="checkbox"${checkedAttribute}${disabledAttribute} />
      <span>${label}</span>
      <span class="layer-state">${state}</span>
    </label>`;
}

function updateState(toggle, text = null) {
  const state = toggle.closest(".layer-manager-row")?.querySelector(".layer-state");
  if (state) state.textContent = text || (toggle.checked ? "visible" : "hidden");
}

function setAvailable(toggle, available, checked = available) {
  toggle.disabled = !available;
  toggle.checked = Boolean(available && checked);
  toggle.closest(".layer-manager-row")?.classList.toggle("disabled", !available);
  updateState(toggle, available ? (toggle.checked ? "visible" : "hidden") : "not loaded");
}

function statusIndicatesLoaded(element, type) {
  const text = String(element?.textContent || "").toLowerCase();
  return type === "image"
    ? text.includes("loaded with")
    : text.includes("loaded:") || text.includes("geometry items");
}

export function enhanceMapLayers(mapPlanner) {
  const map = mapPlanner?.map;
  const tools = document.querySelector(".map-tools");
  if (!map || !tools || tools.dataset.layerUpgrade === "true") return mapPlanner;
  tools.dataset.layerUpgrade = "true";

  const group = createGroup(`
    <h3>Layers & MGA grid</h3>
    <div class="layer-manager-list">
      ${row("layer-points", "Fieldwork locations", "visible", true)}
      ${row("layer-basemap", "Online basemap", "visible", true)}
      ${row("layer-world-image", "Uploaded aerial image", "not loaded", false, true)}
      ${row("layer-dxf", "DXF overlay", "not loaded", false, true)}
      ${row("layer-mga-grid", "GDA2020 / MGA grid", "off", false)}
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
    <p id="layer-manager-status" class="enhancement-status">Locations and online imagery are visible.</p>`);

  const backgroundGroup = [...tools.children].find((child) => child.textContent.includes("Background"));
  if (backgroundGroup) backgroundGroup.after(group);
  else tools.prepend(group);

  const pointToggle = group.querySelector("#layer-points");
  const basemapToggle = group.querySelector("#layer-basemap");
  const imageToggle = group.querySelector("#layer-world-image");
  const dxfToggle = group.querySelector("#layer-dxf");
  const gridToggle = group.querySelector("#layer-mga-grid");
  const gridSpacing = group.querySelector("#mga-grid-spacing");
  const gridOpacity = group.querySelector("#mga-grid-opacity");
  const layerStatus = group.querySelector("#layer-manager-status");
  const basemapSelect = document.querySelector("#basemap-mode");
  const imageStatus = document.querySelector("#world-image-status");
  const dxfStatus = document.querySelector("#dxf-status");
  const imagePane = map.getPane("uploadedImageryPane");
  const dxfPane = map.getPane("dxfPane");
  const gridPane = map.getPane("gridPane") || map.createPane("gridPane");
  gridPane.style.zIndex = "420";

  let previousBasemap = basemapSelect?.value === "none" ? "satellite" : basemapSelect?.value || "satellite";
  let gridLayer = null;
  let gridFrame = null;

  function refreshStatus() {
    const visible = [];
    if (pointToggle.checked) visible.push("locations");
    if (basemapToggle.checked && basemapSelect?.value !== "none") visible.push(basemapSelect?.value || "basemap");
    if (imageToggle.checked && !imageToggle.disabled) visible.push("uploaded image");
    if (dxfToggle.checked && !dxfToggle.disabled) visible.push("DXF");
    if (gridToggle.checked && gridLayer?.gridMetadata) visible.push(`MGA grid ${gridLayer.gridMetadata.spacing} m`);
    layerStatus.textContent = visible.length ? `Visible: ${visible.join(", ")}.` : "No map layers are visible.";
    layerStatus.dataset.tone = visible.length ? "success" : "warning";
  }

  function renderGrid() {
    if (gridFrame) cancelAnimationFrame(gridFrame);
    gridFrame = requestAnimationFrame(() => {
      if (gridLayer) map.removeLayer(gridLayer);
      gridLayer = null;
      if (!gridToggle.checked) {
        updateState(gridToggle, "off");
        refreshStatus();
        return;
      }
      gridLayer = createMgaGridLayer(map, {
        spacing: Number(gridSpacing.value),
        opacity: Number(gridOpacity.value),
        pane: "gridPane",
      }).addTo(map);
      updateState(gridToggle, `${gridLayer.gridMetadata.spacing} m`);
      refreshStatus();
    });
  }

  pointToggle.addEventListener("change", () => {
    mapPlanner.setPointVisibility?.(pointToggle.checked);
    updateState(pointToggle);
    refreshStatus();
  });

  basemapToggle.addEventListener("change", () => {
    if (!basemapSelect) return;
    if (basemapToggle.checked) {
      basemapSelect.value = previousBasemap || "satellite";
    } else {
      if (basemapSelect.value !== "none") previousBasemap = basemapSelect.value;
      basemapSelect.value = "none";
    }
    basemapSelect.dispatchEvent(new Event("change"));
    updateState(basemapToggle);
    refreshStatus();
  });

  basemapSelect?.addEventListener("change", () => {
    if (basemapSelect.value !== "none") previousBasemap = basemapSelect.value;
    basemapToggle.checked = basemapSelect.value !== "none";
    updateState(basemapToggle);
    refreshStatus();
  });

  imageToggle.addEventListener("change", () => {
    if (imagePane) imagePane.style.display = imageToggle.checked ? "" : "none";
    updateState(imageToggle);
    refreshStatus();
  });
  dxfToggle.addEventListener("change", () => {
    if (dxfPane) dxfPane.style.display = dxfToggle.checked ? "" : "none";
    updateState(dxfToggle);
    refreshStatus();
  });

  gridToggle.addEventListener("change", renderGrid);
  gridSpacing.addEventListener("change", renderGrid);
  gridOpacity.addEventListener("input", renderGrid);
  map.on("moveend zoomend", () => {
    if (gridToggle.checked) renderGrid();
  });

  const imageObserver = new MutationObserver(() => {
    const loaded = statusIndicatesLoaded(imageStatus, "image");
    setAvailable(imageToggle, loaded, loaded);
    if (imagePane) imagePane.style.display = loaded ? "" : "none";
    refreshStatus();
  });
  if (imageStatus) imageObserver.observe(imageStatus, { childList: true, characterData: true, subtree: true });

  const dxfObserver = new MutationObserver(() => {
    const loaded = statusIndicatesLoaded(dxfStatus, "dxf");
    setAvailable(dxfToggle, loaded, loaded);
    if (dxfPane) dxfPane.style.display = loaded ? "" : "none";
    refreshStatus();
  });
  if (dxfStatus) dxfObserver.observe(dxfStatus, { childList: true, characterData: true, subtree: true });

  const baseQa = mapPlanner.getQaWarnings?.bind(mapPlanner) || (() => []);
  mapPlanner.getQaWarnings = () => {
    const warnings = [...baseQa()];
    if (!basemapToggle.checked && (imageToggle.disabled || !imageToggle.checked)) {
      warnings.push("No online or uploaded aerial background is visible.");
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
        basemap: basemapToggle.checked ? basemapSelect?.value || "street" : "none",
        points: pointToggle.checked,
        uploadedImage: !imageToggle.disabled && imageToggle.checked,
        dxf: !dxfToggle.disabled && dxfToggle.checked,
        mgaGrid: gridToggle.checked && gridLayer?.gridMetadata ? { ...gridLayer.gridMetadata } : null,
      },
    };
  };

  mapPlanner.getLayerState = () => ({
    basemap: basemapToggle.checked ? basemapSelect?.value || "street" : "none",
    points: pointToggle.checked,
    uploadedImage: !imageToggle.disabled && imageToggle.checked,
    dxf: !dxfToggle.disabled && dxfToggle.checked,
    mgaGrid: gridToggle.checked && gridLayer?.gridMetadata ? { ...gridLayer.gridMetadata } : null,
  });

  setAvailable(imageToggle, statusIndicatesLoaded(imageStatus, "image"), false);
  setAvailable(dxfToggle, statusIndicatesLoaded(dxfStatus, "dxf"), false);
  refreshStatus();
  return mapPlanner;
}
