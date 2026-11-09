import L from "leaflet";
import proj4 from "proj4";
import { readDxfOverlay } from "./dxf-overlay.js";
import { readPlanImage, matchingSidecar, rasterPlacement } from "./plan-import.js";
import { applyAffine, invertAffine, fitReferencePoints, imageCorners } from "./georeferencing.js";
import { createPlanRasterLayer } from "./plan-raster-layer.js";
import "./map-workspace.css";

const CRS_OPTIONS = `<option value="auto">Detect / matching PRJ</option>
  <option value="EPSG:7856">GDA2020 / MGA 56</option><option value="EPSG:7855">GDA2020 / MGA 55</option>
  <option value="EPSG:28356">GDA94 / MGA 56</option><option value="EPSG:28355">GDA94 / MGA 55</option>
  <option value="EPSG:4326">WGS84 longitude / latitude</option><option value="EPSG:3857">Web Mercator</option>`;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, action, title = text) {
  const el = node("button", "button secondary", text);
  el.type = "button"; el.title = title; el.addEventListener("click", action);
  return el;
}
function ll([x, y]) { return L.CRS.EPSG3857.unproject(L.point(x, y)); }

export function createMapWorkspace(planner, { setStatus = () => {} } = {}) {
  const map = planner.map;
  const form = document.querySelector("#generator-form");
  const panel = document.querySelector(".map-panel");
  const layout = panel.querySelector(".map-layout");
  const oldTools = panel.querySelector(".map-tools");
  document.body.classList.add("workspace-app");
  document.querySelector(".hero-copy").textContent = "Locate the site · layer your plans · place fieldwork · export";
  const originalPanels = [...form.querySelectorAll(":scope > .panel")];
  const tabs = node("nav", "workspace-tabs");
  tabs.setAttribute("aria-label", "Project workspace");
  form.prepend(tabs);
  [[panel, "Map workspace"], [originalPanels[0], "Project & title block"],
    [originalPanels[2], "Supporting sheets"], [originalPanels[3], "Export"]].forEach(([section, label], index) => {
    const tab = button(label, () => {
      originalPanels.forEach((p) => { p.hidden = p !== section; });
      [...tabs.children].forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      if (section === panel) requestAnimationFrame(() => map.invalidateSize(false));
    });
    tab.setAttribute("aria-pressed", String(index === 0));
    section.hidden = index !== 0;
    tabs.append(tab);
  });
  const register = node("details", "workspace-register");
  register.append(node("summary", "", "Fieldwork coordinate schedule"));
  register.append(panel.querySelector(".coordinate-heading"), panel.querySelector(".coordinate-wrapper"));
  panel.append(register);
  const sheetSettings = node("details", "workspace-sheet-settings");
  sheetSettings.append(node("summary", "", "Map sheet settings"), panel.querySelector(".map-sheet-settings"));
  originalPanels[3].prepend(sheetSettings);
  originalPanels[3].prepend(panel.querySelector(".section-heading .inline-check"));
  panel.querySelector(".section-heading").hidden = true;

  const ribbon = node("div", "workspace-ribbon");
  const fileInput = node("input");
  fileInput.type = "file"; fileInput.multiple = true; fileInput.hidden = true;
  fileInput.accept = ".jpg,.jpeg,.png,.tif,.tiff,.dxf,.jgw,.jpgw,.jpegw,.pgw,.pngw,.tfw,.tifw,.tiffw,.wld,.prj";
  fileInput.id = "workspace-plan-files";
  ribbon.append(button("＋ Add plans", () => fileInput.click()), fileInput);
  ribbon.append(document.querySelector("#map-pan-mode"));
  const palette = document.querySelector(".point-palette");
  ribbon.append(palette);
  const fitAll = button("Fit plans", () => {
    const corners = entries.filter((e) => e.visible && e.placement).flatMap((e) => e.placement.corners);
    if (corners.length) fitCorners(corners);
  });
  ribbon.append(fitAll);
  const zoomLabel = node("label", "workspace-zoom", "Zoom");
  const zoom = node("input"); zoom.type = "number"; zoom.min = "1"; zoom.max = "26"; zoom.step = "0.25";
  zoom.id = "workspace-zoom"; zoom.value = String(map.getZoom());
  zoom.addEventListener("change", () => {
    const value = Number(zoom.value);
    if (Number.isFinite(value)) map.setZoom(Math.max(1, Math.min(26, value)), { animate: false });
  });
  map.on("zoomend", () => { zoom.value = String(Math.round(map.getZoom() * 100) / 100); });
  zoomLabel.append(zoom); ribbon.append(zoomLabel);
  const frameButton = button("A1 frame", () => {
    const frame = document.querySelector("#map-print-frame");
    frame.classList.toggle("frame-muted");
    frameButton.setAttribute("aria-pressed", String(!frame.classList.contains("frame-muted")));
  });
  frameButton.setAttribute("aria-pressed", "true");
  ribbon.append(frameButton);
  panel.insertBefore(ribbon, layout);

  const left = node("aside", "workspace-layers");
  left.append(node("h2", "", "Contents"));
  const list = node("div", "workspace-layer-list");
  list.id = "workspace-layer-list";
  left.append(list);
  const empty = node("p", "workspace-help", "Drop JPG, PNG, TIFF or DXF files onto the map. Include matching world/PRJ files when available.");
  left.append(empty);
  const baseControls = node("div", "workspace-base-controls");
  // Keep original controls and their event handlers for basemaps, points and grid.
  for (const id of ["basemap-mode", "layer-points", "layer-basemap", "layer-mga-grid"]) {
    const control = document.querySelector(`#${id}`);
    const label = control?.closest("label");
    if (label) baseControls.append(label);
  }
  left.append(baseControls);
  const right = node("aside", "workspace-inspector");
  right.append(node("h2", "", "Properties"));
  const properties = node("div", "workspace-properties");
  right.append(properties);
  const advanced = node("details", "workspace-advanced");
  advanced.append(node("summary", "", "More tools"), oldTools);
  right.append(advanced);
  layout.prepend(left); layout.append(right);
  const status = node("p", "workspace-notice", "Ready. Find a site or drop a plan onto the map.");
  status.id = "workspace-notice"; status.setAttribute("role", "status");
  panel.insertBefore(status, ribbon);
  const statusBar = originalPanels[3].querySelector(".output-row > div");
  statusBar.classList.add("workspace-statusbar");
  form.append(statusBar);
  function notice(text, error = false) {
    status.textContent = text; status.dataset.tone = error ? "error" : "neutral";
    setStatus(text, error ? "error" : "neutral");
  }

  const entries = [];
  let selected = null;
  let importing = false;
  let session = null;
  let sourceMap = null;
  const referenceMarkers = L.layerGroup();
  const targetMarkers = L.layerGroup().addTo(map);
  let sourceImage = null;
  const refPanel = node("section", "workspace-reference");
  refPanel.hidden = true;
  refPanel.innerHTML = `<h3>Reference image</h3><p class="workspace-help">Zoom/pan this image. Click a detail, then the same detail on the main map, or enter its known coordinates.</p>
    <div id="reference-image" aria-label="Source image reference picker"></div>
    <div class="reference-actions"></div>
    <p id="reference-instruction" role="status"></p>
    <label>Known coordinate system<select id="reference-crs">${CRS_OPTIONS.replace('<option value="auto">Detect / matching PRJ</option>', "")}</select></label>
    <div class="reference-coordinates"><label>Easting / longitude<input id="reference-x" type="number" step="any"></label><label>Northing / latitude<input id="reference-y" type="number" step="any"></label></div>
    <button id="reference-add-known" type="button" class="button secondary">Add known coordinate</button>
    <ol id="reference-points"></ol><p id="reference-quality" role="status"></p><div class="reference-footer"></div>`;
  right.insertBefore(refPanel, advanced);
  const refInstruction = refPanel.querySelector("#reference-instruction");
  const refQuality = refPanel.querySelector("#reference-quality");
  const refList = refPanel.querySelector("#reference-points");

  function fitCorners(corners) {
    const bounds = L.latLngBounds(corners.map(ll));
    planner.fitBoundsToA1Frame?.(bounds, { maxZoom: 26, animate: false });
  }
  function updateOrder() {
    entries.forEach((entry, index) => { if (entry.pane) map.getPane(entry.pane).style.zIndex = String(260 + index); });
  }
  function removeLayer(entry) {
    if (entry.layer) map.removeLayer(entry.layer);
    entry.layer = null;
  }
  function showRaster(entry, placement) {
    removeLayer(entry);
    entry.placement = placement;
    entry.layer = createPlanRasterLayer(entry, placement, entry.pane);
    if (entry.visible) entry.layer.addTo(map);
  }
  function renderList() {
    list.replaceChildren();
    [...entries].reverse().forEach((entry) => {
      const row = node("div", `workspace-layer-row${entry === selected ? " selected" : ""}`);
      const visible = node("input"); visible.type = "checkbox"; visible.checked = entry.visible;
      visible.setAttribute("aria-label", `Show ${entry.name}`);
      visible.addEventListener("change", () => {
        entry.visible = visible.checked;
        if (entry.layer) { if (entry.visible) entry.layer.addTo(map); else map.removeLayer(entry.layer); }
      });
      const select = button(entry.name, () => selectEntry(entry));
      select.className = "workspace-layer-name";
      const state = node("small", "", entry.placement ? (entry.kind === "dxf" ? "DXF" : "Image") : "Needs placement");
      const label = node("div"); label.append(select, state);
      row.append(visible, label); list.append(row);
    });
    empty.hidden = entries.length > 0;
  }
  function selectEntry(entry) {
    if (session && session.entry !== entry) cancelReference();
    selected = entry; renderList(); renderProperties();
  }
  function renderProperties() {
    properties.replaceChildren();
    if (!selected) { properties.append(node("p", "workspace-help", "Select a plan layer to inspect or georeference it.")); return; }
    const entry = selected;
    properties.append(node("h3", "workspace-filename", entry.name));
    properties.append(node("p", "workspace-help", entry.kind === "dxf" ? (entry.summary || "Select the coordinate system used by the DXF.") : `${entry.width.toLocaleString()} × ${entry.height.toLocaleString()} pixels · original resolution`));
    const crsLabel = node("label", "", "Source coordinate system");
    const crs = node("select"); crs.id = "workspace-source-crs"; crs.innerHTML = CRS_OPTIONS;
    crs.value = entry.selectedCrs || "auto";
    crs.addEventListener("change", () => { entry.selectedCrs = crs.value; });
    crsLabel.append(crs);
    if (entry.kind === "dxf" || entry.nativeTransform) properties.append(crsLabel);
    if (entry.kind === "dxf" || entry.nativeTransform) {
      const place = button(entry.placement ? "Reapply source CRS" : "Place using source CRS", async () => {
        if (session) return notice("Apply or cancel the manual alignment first.", true);
        place.disabled = true;
        try { await placeEntry(entry); renderList(); renderProperties(); } catch (error) { notice(error.message, true); }
        finally { place.disabled = false; }
      });
      place.disabled = Boolean(session) || (entry.kind === "raster" && Boolean(entry.placement) && entry.locked);
      properties.append(place);
    }
    const opacityLabel = node("label", "", "Opacity");
    const opacity = node("input"); opacity.type = "range"; opacity.min = "0"; opacity.max = "1"; opacity.step = "0.05"; opacity.value = entry.opacity;
    opacity.addEventListener("input", () => {
      entry.opacity = Number(opacity.value);
      if (entry.kind === "raster") entry.layer?.setOpacity(entry.opacity);
      else { map.getPane(entry.pane).style.opacity = String(entry.opacity); }
    });
    opacityLabel.append(opacity); properties.append(opacityLabel);
    if (entry.kind === "dxf") {
      const colorLabel = node("label", "", "Line colour");
      const color = node("input"); color.type = "color"; color.value = entry.color;
      color.addEventListener("input", () => {
        entry.color = color.value;
        entry.layer?.eachLayer((layer) => { layer.setStyle?.({ color: entry.color, fillColor: entry.color });
          const label = layer.getElement?.()?.querySelector(".workspace-dxf-label"); if (label) label.style.color = entry.color; });
      });
      colorLabel.append(color); properties.append(colorLabel);
    }
    const actions = node("div", "workspace-property-actions");
    if (entry.placement) actions.append(button("Zoom to layer", () => fitCorners(entry.placement.corners)));
    if (entry.kind === "raster") {
      if (entry.placement) {
        const locked = node("label", "inline-check"); const check = node("input");
        check.type = "checkbox"; check.checked = entry.locked;
        check.addEventListener("change", () => { entry.locked = check.checked; renderProperties(); });
        locked.append(check, document.createTextNode("Lock alignment")); properties.append(locked);
      }
      const georef = button("Georeference image", () => startReference(entry));
      georef.disabled = Boolean(entry.placement && entry.locked) || Boolean(session);
      actions.append(georef);
    }
    const up = button("↑", () => moveEntry(entry, 1), "Move layer up");
    const down = button("↓", () => moveEntry(entry, -1), "Move layer down");
    up.disabled = entries.indexOf(entry) === entries.length - 1;
    down.disabled = entries.indexOf(entry) === 0;
    actions.append(up, down, button("Remove", () => {
      if (session?.entry === entry) cancelReference();
      removeLayer(entry); map.getPane(entry.pane).remove();
      entries.splice(entries.indexOf(entry), 1);
      selected = entries.at(-1) || null; updateOrder(); renderList(); renderProperties();
      notice(`${entry.name} removed.`);
    }));
    properties.append(actions);
  }
  function moveEntry(entry, direction) {
    const index = entries.indexOf(entry), next = index + direction;
    if (next < 0 || next >= entries.length) return;
    [entries[index], entries[next]] = [entries[next], entries[index]];
    updateOrder(); renderList(); renderProperties();
  }
  async function placeEntry(entry) {
    const sourceCrs = entry.selectedCrs !== "auto" ? entry.selectedCrs : entry.detectedCrs;
    if (!sourceCrs) throw new Error("Select the source CRS, or add a matching PRJ file with the plan.");
    if (entry.placement && entry.locked && entry.kind === "raster") throw new Error("Unlock alignment before changing its coordinate system.");
    if (entry.kind === "raster") showRaster(entry, rasterPlacement(entry, sourceCrs));
    else {
      const parsed = await readDxfOverlay(entry.files, sourceCrs);
      if (parsed.boundsCoordinates.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 85.05112878)) {
        throw new Error("The DXF coordinates fall outside the map. Check its source CRS.");
      }
      const group = L.layerGroup();
      const style = { color: entry.color, weight: 1.5, pane: entry.pane, interactive: false, fill: false };
      parsed.features.forEach((feature) => {
        if (feature.kind === "point") L.circleMarker([feature.coordinate[1], feature.coordinate[0]], { ...style, radius: 3 }).addTo(group);
        else L.polyline(feature.coordinates.map(([x, y]) => [y, x]), style).addTo(group);
      });
      parsed.labels.forEach((label) => {
        const text = node("span", "workspace-dxf-label", label.text); text.style.color = entry.color;
        L.marker([label.coordinate[1], label.coordinate[0]], { pane: entry.pane, interactive: false,
          icon: L.divIcon({ className: "", html: text, iconSize: null }) }).addTo(group);
      });
      const corners = parsed.boundsCoordinates.map(([x, y]) => { const p = L.CRS.EPSG3857.project(L.latLng(y, x)); return [p.x, p.y]; });
      if (!corners.length) throw new Error("The DXF contains no supported geometry.");
      removeLayer(entry); entry.layer = group;
      if (entry.visible) group.addTo(map);
      entry.placement = { corners, sourceCrs };
      entry.summary = `${parsed.features.length} geometry items · ${parsed.labels.length} labels${parsed.skippedCount ? ` · ${parsed.skippedCount} unsupported entities skipped` : ""}`;
    }
    entry.locked = true;
    fitCorners(entry.placement.corners);
    notice(`${entry.name} placed.${entry.summary ? ` ${entry.summary}` : ""}`);
  }

  async function importFiles(files) {
    if (importing) return notice("Please wait for the current plans to finish loading.", true);
    const all = [...files];
    const plans = all.filter((file) => /\.(jpe?g|png|tiff?|dxf)$/i.test(file.name));
    if (!plans.length) return notice("Drop a JPG, PNG, TIFF or DXF, together with any matching world/PRJ files.", true);
    importing = true;
    for (const file of plans) {
      notice(`Reading ${file.name}…`);
      try {
        const id = crypto.randomUUID();
        const entry = { id, name: file.name, kind: /\.dxf$/i.test(file.name) ? "dxf" : "raster",
          files: all, visible: true, opacity: 1, color: "#e11d48", selectedCrs: "auto", locked: false, pane: `plan-${id}` };
        if (entry.kind === "raster") Object.assign(entry, await readPlanImage(file, all));
        else { const prj = matchingSidecar(all, file.name, [".prj"]); if (prj) entry.detectedCrs = await prj.text(); }
        const pane = map.createPane(entry.pane); pane.style.pointerEvents = "none";
        entries.push(entry); updateOrder();
        if (entry.detectedCrs && (entry.kind === "dxf" || entry.nativeTransform)) {
          try { await placeEntry(entry); } catch (error) { notice(`${entry.name}: ${error.message}`, true); }
        } else notice(`${entry.name} loaded. ${entry.nativeTransform || entry.kind === "dxf" ? "Select its source CRS in Properties." : "Select Georeference image to align it."}`);
        selectEntry(entry);
      } catch (error) { notice(`${file.name}: ${error.message}`, true); }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    importing = false; fileInput.value = "";
  }
  fileInput.addEventListener("change", () => importFiles(fileInput.files));
  const stage = panel.querySelector(".map-stage");
  stage.addEventListener("dragover", (event) => { event.preventDefault(); stage.classList.add("plan-dragging"); });
  stage.addEventListener("dragleave", () => stage.classList.remove("plan-dragging"));
  stage.addEventListener("drop", (event) => { event.preventDefault(); stage.classList.remove("plan-dragging"); importFiles(event.dataTransfer.files); });

  function refreshReferences() {
    referenceMarkers.clearLayers(); targetMarkers.clearLayers(); refList.replaceChildren();
    session.controls.forEach((control, index) => {
      const latlng = L.latLng(session.entry.height - control.source[1], control.source[0]);
      L.circleMarker(latlng, { radius: 5, color: "#f43f5e" }).bindTooltip(String(index + 1), { permanent: true }).addTo(referenceMarkers);
      L.circleMarker(ll(control.target), { radius: 5, color: "#f43f5e" }).bindTooltip(String(index + 1), { permanent: true }).addTo(targetMarkers);
      const row = node("li", "", `Point ${index + 1} · pixel ${control.source.map(Math.round).join(", ")} `);
      row.append(button("×", () => { restorePreview(); session.controls.splice(index, 1); refreshReferences(); }, `Remove reference point ${index + 1}`)); refList.append(row);
    });
    refInstruction.textContent = session.pending ? "Now click the matching detail on the map, or enter its coordinates." : `${session.controls.length} reference points. Click a detail on the source image.`;
    refQuality.textContent = "Use at least 3 points spread across the image. Add a 4th or more to assess fit.";
  }
  function restorePreview() {
    if (!session?.preview) return;
    if (session.original) showRaster(session.entry, session.original);
    else { removeLayer(session.entry); session.entry.placement = null; }
    session.preview = null;
  }
  function addReference(target) {
    if (!session?.pending) return notice("Choose a detail on the source image first.", true);
    if (target.some((value) => !Number.isFinite(value))) return notice("The reference coordinates are invalid.", true);
    restorePreview();
    session.controls.push({ source: session.pending, target }); session.pending = null; refreshReferences();
  }
  function startReference(entry) {
    if (session) cancelReference();
    document.querySelector("#map-pan-mode").click();
    session = { entry, original: entry.placement, controls: (entry.controls || []).map((p) => ({ source: [...p.source], target: [...p.target] })), pending: null, preview: null };
    entry.visible = true;
    if (entry.layer && !map.hasLayer(entry.layer)) entry.layer.addTo(map);
    renderList();
    refPanel.hidden = false;
    if (!sourceMap) {
      sourceMap = L.map(refPanel.querySelector("#reference-image"), { crs: L.CRS.Simple, minZoom: -10, maxZoom: 5, attributionControl: false });
      referenceMarkers.addTo(sourceMap);
      sourceMap.on("click", (event) => {
        if (!session) return;
        const source = [event.latlng.lng, session.entry.height - event.latlng.lat];
        if (source[0] < 0 || source[1] < 0 || source[0] > session.entry.width || source[1] > session.entry.height) return;
        session.pending = source; refreshReferences();
        L.circleMarker(event.latlng, { radius: 6, color: "#2563eb" }).addTo(referenceMarkers);
      });
    }
    if (sourceImage) sourceMap.removeLayer(sourceImage);
    const bounds = [[0, 0], [entry.height, entry.width]];
    sourceImage = L.imageOverlay(entry.image.src, bounds).addTo(sourceMap);
    requestAnimationFrame(() => { sourceMap.invalidateSize(false); sourceMap.fitBounds(bounds); });
    refPanel.querySelector("#reference-x").value = ""; refPanel.querySelector("#reference-y").value = "";
    refreshReferences(); renderProperties();
    notice("Georeferencing: select matching details on the source image and map. The current alignment stays unchanged until Apply.");
  }
  function cancelReference() {
    if (!session) return;
    restorePreview(); session = null; refPanel.hidden = true; referenceMarkers.clearLayers(); targetMarkers.clearLayers();
    renderList(); renderProperties();
    notice("Manual alignment cancelled; the previous alignment was restored.");
  }
  refPanel.querySelector(".reference-actions").append(button("Fit source", () => {
    if (session) sourceMap.fitBounds([[0, 0], [session.entry.height, session.entry.width]]);
  }), button("Clear points", () => { if (session) { restorePreview(); session.controls = []; session.pending = null; refreshReferences(); } }));
  refPanel.querySelector("#reference-add-known").addEventListener("click", () => {
    const x = refPanel.querySelector("#reference-x").value, y = refPanel.querySelector("#reference-y").value;
    if (!x.trim() || !y.trim()) return notice("Enter both coordinates.", true);
    try {
      const crs = refPanel.querySelector("#reference-crs").value;
      if (crs === "EPSG:4326" && (Math.abs(Number(x)) > 180 || Math.abs(Number(y)) > 85.05112878)) throw new Error("Enter longitude then latitude within the map's bounds.");
      addReference(proj4(crs, "EPSG:3857", [Number(x), Number(y)]));
    } catch (error) { notice(error.message, true); }
  });
  refPanel.querySelector(".reference-footer").append(button("Preview alignment", () => {
    if (!session) return;
    try {
      const fit = fitReferencePoints(session.controls);
      const inverse = invertAffine(fit.transform);
      const placement = { toMercator: (p) => applyAffine(fit.transform, p), toPixel: (p) => applyAffine(inverse, p),
        corners: imageCorners(session.entry.width, session.entry.height).map((p) => applyAffine(fit.transform, p)), sourceCrs: "Manual reference points" };
      showRaster(session.entry, placement); session.preview = placement;
      fitCorners(placement.corners);
      const latitude = ll(placement.corners[0]).lat;
      const groundRms = fit.rms * Math.cos(latitude * Math.PI / 180);
      refQuality.textContent = `${session.controls.length} points · fit RMS ≈ ${groundRms.toFixed(3)} m. ${session.controls.length === 3 ? "Three points fit exactly; add more to assess alignment error." : "Fit residuals measure agreement with your reference points, not survey accuracy."}`;
      notice("Alignment preview ready. Inspect the map, then Apply or Cancel.");
    } catch (error) { notice(error.message, true); }
  }), button("Apply", () => {
    if (!session?.preview) return notice("Preview the alignment before applying it.", true);
    const entry = session.entry; entry.controls = session.controls; entry.locked = true;
    session = null; refPanel.hidden = true; referenceMarkers.clearLayers(); targetMarkers.clearLayers();
    renderList(); renderProperties(); notice(`${entry.name}: manual alignment applied and locked.`);
  }), button("Cancel", cancelReference));
  // Capture before Leaflet's event handlers: reference clicks must never place
  // fieldwork points or accidentally reuse the point-placement mode.
  map.getContainer().addEventListener("click", (event) => {
    if (!session || event.target.closest(".leaflet-control")) return;
    if (map.dragging?.moved() || map.boxZoom?.moved()) return;
    event.stopImmediatePropagation(); event.preventDefault();
    const p = L.CRS.EPSG3857.project(map.mouseEventToLatLng(event));
    addReference([p.x, p.y]);
  }, true);
  document.querySelectorAll("[data-point-type]").forEach((el) => el.addEventListener("click", () => { if (session) cancelReference(); }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && session) cancelReference(); });

  const originalCapture = planner.capturePlan.bind(planner);
  planner.capturePlan = async () => {
    if (planner.isIncluded() && (session || importing)) throw new Error("Finish or cancel the plan import/georeferencing before exporting.");
    const pending = entries.filter((e) => e.visible && !e.placement);
    if (planner.isIncluded() && pending.length) throw new Error(`Place or hide these plans before exporting: ${pending.map((e) => e.name).join(", ")}`);
    // The Export tab hides the map. Reveal and resize it before measuring the
    // A1 frame or html2canvas will capture a zero-sized element.
    if (planner.isIncluded() && panel.hidden) {
      tabs.children[0].click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const loading = [];
    map.eachLayer((layer) => {
      if (layer.isLoading?.()) loading.push(new Promise((resolve) => {
        const done = () => { clearTimeout(timeout); layer.off("load", done); resolve(); };
        const timeout = setTimeout(done, 8000); layer.once("load", done);
      }));
    });
    await Promise.all(loading);
    const plan = await originalCapture();
    if (plan) plan.planLayers = entries.filter((e) => e.visible && e.placement).map((e) => ({ name: e.name, sourceCrs: e.placement.sourceCrs, opacity: e.opacity }));
    return plan;
  };
  const originalHasContent = planner.hasContent.bind(planner);
  planner.hasContent = () => originalHasContent() || entries.some((e) => e.visible && e.placement);
  const originalQa = planner.getQaWarnings?.bind(planner) || (() => []);
  planner.getQaWarnings = () => originalQa().filter((warning) =>
    warning !== "No online or uploaded aerial background is visible." || !entries.some((e) => e.kind === "raster" && e.visible && e.placement),
  );
  renderList(); renderProperties();
  return planner;
}
