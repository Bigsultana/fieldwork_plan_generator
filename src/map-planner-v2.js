import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map-point-editor.css";
import html2canvas from "html2canvas";
import {
  FIELDWORK_TYPES,
  MAP_CONTENT_RATIO,
  coordinateRecord,
  haversineDistanceMetres,
  renumberPoints,
  scaleFromFrameWidth,
} from "./map-model.js";
import { assignLabelOffsets, evaluateMapQa } from "./map-point-layout.js";
import { readGeoTiffOverlay } from "./geotiff-overlay.js";
import { downloadKml, downloadKmz } from "./kml.js";

const DEFAULT_CENTER = [-27.91, 153.312];
const SEARCH_ENDPOINT = "/api/geocode";
const TILE_URL = `${window.location.origin}/api/tiles/{z}/{x}/{y}.png`;

function element(id) {
  const found = document.querySelector(`#${id}`);
  if (!found) throw new Error(`Map planner element #${id} was not found.`);
  return found;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renumberWithCustomLabels(points) {
  return renumberPoints(points).map((point) => ({
    ...point,
    label: String(point.customLabel || "").trim() || point.label,
  }));
}

function drawMarkerCanvas(definition, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const centre = size / 2;
  const radius = size * 0.28;
  context.clearRect(0, 0, size, size);
  context.strokeStyle = `#${definition.color}`;
  context.lineWidth = Math.max(4, size * 0.075);
  context.lineJoin = "round";
  context.lineCap = "round";

  if (definition.code === "TP") {
    context.strokeRect(centre - radius, centre - radius, radius * 2, radius * 2);
  } else if (definition.code === "CPT") {
    context.beginPath();
    context.moveTo(centre, centre - radius * 1.25);
    context.lineTo(centre + radius * 1.25, centre);
    context.lineTo(centre, centre + radius * 1.25);
    context.lineTo(centre - radius * 1.25, centre);
    context.closePath();
    context.stroke();
  } else if (definition.code === "DCP") {
    context.beginPath();
    context.moveTo(centre, centre - radius * 1.35);
    context.lineTo(centre + radius * 1.25, centre + radius);
    context.lineTo(centre - radius * 1.25, centre + radius);
    context.closePath();
    context.stroke();
  } else if (definition.code === "SP") {
    context.beginPath();
    context.moveTo(centre - radius, centre);
    context.lineTo(centre + radius, centre);
    context.moveTo(centre, centre - radius);
    context.lineTo(centre, centre + radius);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(centre, centre, radius, 0, Math.PI * 2);
    context.stroke();
    if (definition.code === "BH") {
      context.beginPath();
      context.moveTo(centre - radius * 1.35, centre);
      context.lineTo(centre + radius * 1.35, centre);
      context.moveTo(centre, centre - radius * 1.35);
      context.lineTo(centre, centre + radius * 1.35);
      context.stroke();
    }
    if (definition.code === "MW") {
      context.beginPath();
      context.arc(centre, centre, radius * 0.48, 0, Math.PI * 2);
      context.stroke();
    }
  }
  return canvas;
}

function saveTextFile(text, filename, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function pointIcon(point, offset = { x: 0, y: 24 }) {
  const definition = FIELDWORK_TYPES[point.type] || {
    code: point.type,
    symbol: "●",
    color: "333333",
  };
  const squareClass = definition.code === "TP" ? " square" : "";
  const lockedClass = point.locked ? " locked" : "";
  const html = `
    <div class="fieldwork-marker-shell" style="--marker-colour:#${definition.color};--label-x:${Number(offset.x)}px;--label-y:${Number(offset.y)}px">
      <span class="fieldwork-marker-symbol${squareClass}${lockedClass}">${escapeHtml(definition.symbol)}</span>
      <span class="fieldwork-marker-label">${escapeHtml(point.label)}</span>
    </div>`;
  return L.divIcon({
    className: "fieldwork-marker-icon",
    html,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
  });
}

function overlayBounds(coordinates) {
  const latitudes = coordinates.map((coordinate) => Number(coordinate[1]));
  const longitudes = coordinates.map((coordinate) => Number(coordinate[0]));
  return L.latLngBounds(
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  );
}

function formatDistance(metres) {
  const value = Number(metres);
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  if (value >= 100) return `${Math.round(value)} m`;
  if (value >= 10) return `${Math.round(value)} m`;
  return `${value.toFixed(1)} m`;
}

export function createMapPlanner({ getProject, setStatus = () => {} } = {}) {
  const mapElement = element("site-map");
  const frameElement = element("map-print-frame");
  const mapStatus = element("map-status");
  const pointTableBody = element("point-register");
  const pointCount = element("point-count");
  const searchInput = element("site-search");
  const searchResults = element("search-results");
  const includeMap = element("include-map");
  const overlayInput = element("geotiff-file");
  const overlayCrs = element("geotiff-crs");
  const overlayOpacity = element("overlay-opacity");
  const mapSheetNumber = element("map-sheet-number");
  const mapTitle = element("map-title");
  const mapSubtitle = element("map-subtitle");

  let points = [];
  let activeType = null;
  let overlay = null;
  let overlayLayer = null;
  let loaded = false;
  let latestScale = null;
  let lastSearchAt = 0;
  let tileErrors = 0;
  let unresolvedLabels = 0;
  let pointVisible = true;
  const searchCache = new Map();
  const markerRegistry = new Map();

  frameElement.style.aspectRatio = String(MAP_CONTENT_RATIO);
  frameElement.style.zIndex = "1000";
  mapStatus.style.zIndex = "1001";

  const map = L.map(mapElement, {
    center: DEFAULT_CENTER,
    zoom: 10,
    maxZoom: 19,
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
  });

  const tileLayer = L.tileLayer(TILE_URL, {
    minZoom: 0,
    maxZoom: 19,
    maxNativeZoom: 19,
    tileSize: 256,
    detectRetina: false,
    updateWhenIdle: false,
    keepBuffer: 3,
    attribution: "© OpenStreetMap contributors © CARTO",
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false, maxWidth: 150, position: "bottomleft" }).addTo(map);
  const pointLayer = L.layerGroup().addTo(map);

  const tools = document.querySelector(".map-tools");
  const qaGroup = document.createElement("div");
  qaGroup.className = "tool-group";
  qaGroup.innerHTML = '<h3>Drawing QA</h3><ul class="map-qa-list"><li>Checking map layout…</li></ul><small>Warnings update as locations, labels and the A1 frame change.</small>';
  const qaList = qaGroup.querySelector(".map-qa-list");
  if (tools) tools.append(qaGroup);

  function setMapStatus(message) {
    mapStatus.textContent = message;
  }

  function framePixels() {
    const mapRect = mapElement.getBoundingClientRect();
    const frameRect = frameElement.getBoundingClientRect();
    return {
      left: frameRect.left - mapRect.left,
      top: frameRect.top - mapRect.top,
      right: frameRect.right - mapRect.left,
      bottom: frameRect.bottom - mapRect.top,
      width: frameRect.width,
      height: frameRect.height,
    };
  }

  function frameCorners() {
    const pixels = framePixels();
    return [
      map.containerPointToLatLng([pixels.left, pixels.top]),
      map.containerPointToLatLng([pixels.right, pixels.top]),
      map.containerPointToLatLng([pixels.right, pixels.bottom]),
      map.containerPointToLatLng([pixels.left, pixels.bottom]),
    ].map((coordinate) => [coordinate.lng, coordinate.lat]);
  }

  function getQaWarnings() {
    if (!loaded) return ["The map is still loading."];
    return evaluateMapQa(points, frameCorners(), {
      unresolvedLabels,
      scale: latestScale,
    });
  }

  function renderQa() {
    if (!qaList) return;
    qaList.replaceChildren();
    const warnings = getQaWarnings();
    if (!warnings.length) {
      const item = document.createElement("li");
      item.className = "qa-clear";
      item.textContent = "No drawing issues detected.";
      qaList.append(item);
      return;
    }
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      qaList.append(item);
    });
  }

  function updateScale() {
    if (!loaded) return;
    const pixels = framePixels();
    const west = map.containerPointToLatLng([pixels.left, pixels.top + pixels.height / 2]);
    const east = map.containerPointToLatLng([pixels.right, pixels.top + pixels.height / 2]);
    const groundWidth = haversineDistanceMetres([west.lng, west.lat], [east.lng, east.lat]);
    latestScale = scaleFromFrameWidth(groundWidth);
    const tileWarning = tileErrors ? " · some background tiles were unavailable" : "";
    setMapStatus(`A1 map frame · approximately 1:${latestScale.toLocaleString("en-AU")} · pan and zoom inside the blue outline${tileWarning}`);
    renderQa();
  }

  function updatePoint(id, patch, { renumber = false } = {}) {
    points = points.map((point) => (point.id === id ? { ...point, ...patch } : point));
    if (renumber) points = renumberWithCustomLabels(points);
    updatePointLayer();
    renderPointTable();
  }

  function deletePoint(id) {
    points = renumberWithCustomLabels(points.filter((point) => point.id !== id));
    updatePointLayer();
    renderPointTable();
  }

  function duplicatePoint(point) {
    const duplicate = {
      ...point,
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      longitude: Number(point.longitude) + 0.00001,
      latitude: Number(point.latitude) + 0.00001,
      customLabel: "",
      locked: false,
    };
    points = renumberWithCustomLabels([...points, duplicate]);
    updatePointLayer({ openId: duplicate.id });
    renderPointTable();
  }

  function pointEditor(point, marker) {
    const form = document.createElement("form");
    form.className = "fieldwork-point-editor";

    const typeOptions = Object.values(FIELDWORK_TYPES)
      .map((definition) => `<option value="${definition.code}"${definition.code === point.type ? " selected" : ""}>${escapeHtml(definition.name)}</option>`)
      .join("");

    form.innerHTML = `
      <strong>Edit ${escapeHtml(point.label)}</strong>
      <div class="editor-grid">
        <label>Type<select name="type">${typeOptions}</select></label>
        <label>Custom ID<input name="customLabel" value="${escapeHtml(point.customLabel || "")}" placeholder="Auto: ${escapeHtml(point.label)}" maxlength="18" /></label>
      </div>
      <div class="editor-grid">
        <label>Latitude<input name="latitude" type="number" step="0.0000001" value="${Number(point.latitude).toFixed(7)}" /></label>
        <label>Longitude<input name="longitude" type="number" step="0.0000001" value="${Number(point.longitude).toFixed(7)}" /></label>
      </div>
      <label>Notes<textarea name="notes">${escapeHtml(point.notes || "")}</textarea></label>
      <label class="editor-lock"><input name="locked" type="checkbox"${point.locked ? " checked" : ""} /> Lock location against dragging</label>
      <div class="editor-actions">
        <button class="save-point" type="submit">Save</button>
        <button class="duplicate-point" type="button">Duplicate</button>
        <button class="delete-point" type="button">Delete</button>
      </div>`;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const latitude = Number(data.get("latitude"));
      const longitude = Number(data.get("longitude"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        setStatus("Enter valid latitude and longitude values for the location.", "error");
        return;
      }
      const type = String(data.get("type"));
      updatePoint(
        point.id,
        {
          type,
          customLabel: String(data.get("customLabel") || "").trim(),
          latitude,
          longitude,
          notes: String(data.get("notes") || ""),
          locked: data.get("locked") === "on",
        },
        { renumber: type !== point.type || true },
      );
      map.closePopup();
      setStatus(`${point.label} updated.`);
    });
    form.querySelector(".duplicate-point").addEventListener("click", () => {
      map.closePopup();
      duplicatePoint(point);
    });
    form.querySelector(".delete-point").addEventListener("click", () => {
      map.closePopup();
      deletePoint(point.id);
    });

    marker.bindPopup(form, { closeButton: true, autoPan: true, minWidth: 270, maxWidth: 320 }).openPopup();
  }

  function updatePointLayer({ openId = null } = {}) {
    pointLayer.clearLayers();
    markerRegistry.clear();
    const layout = assignLabelOffsets(points, (point) => map.latLngToContainerPoint([point.latitude, point.longitude]));
    unresolvedLabels = layout.unresolved;

    points.forEach((point) => {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: pointIcon(point, layout.offsets.get(point.id)),
        interactive: true,
        keyboard: true,
        draggable: !point.locked,
        pane: "markerPane",
        title: `${point.label} — click to edit${point.locked ? " (locked)" : "; drag to move"}`,
        riseOnHover: true,
      }).addTo(pointLayer);
      markerRegistry.set(point.id, marker);

      marker.on("click", () => pointEditor(points.find((candidate) => candidate.id === point.id) || point, marker));
      marker.on("dragend", () => {
        const coordinate = marker.getLatLng();
        updatePoint(point.id, { longitude: coordinate.lng, latitude: coordinate.lat });
        setStatus(`${point.label} moved to ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}.`);
      });
      if (openId === point.id) pointEditor(point, marker);
    });

    if (pointVisible && !map.hasLayer(pointLayer)) pointLayer.addTo(map);
    if (!pointVisible && map.hasLayer(pointLayer)) map.removeLayer(pointLayer);
    renderQa();
  }

  function openEditorForPoint(id) {
    const point = points.find((candidate) => candidate.id === id);
    const marker = markerRegistry.get(id);
    if (point && marker) pointEditor(point, marker);
  }

  function setPointVisibility(visible) {
    pointVisible = Boolean(visible);
    if (pointVisible && !map.hasLayer(pointLayer)) pointLayer.addTo(map);
    if (!pointVisible && map.hasLayer(pointLayer)) map.removeLayer(pointLayer);
  }

  function updateActiveButtons() {
    document.querySelectorAll("[data-point-type]").forEach((button) => {
      button.classList.toggle("active", button.dataset.pointType === activeType);
    });
    element("map-pan-mode").classList.toggle("active", activeType === null);
    mapElement.style.cursor = activeType ? "crosshair" : "grab";
  }

  function renderPointTable() {
    pointTableBody.replaceChildren();
    pointCount.textContent = `${points.length} location${points.length === 1 ? "" : "s"}`;
    points.forEach((point) => {
      const record = coordinateRecord(point);
      const row = document.createElement("tr");
      const values = [
        `${record.label}${point.locked ? " •" : ""}`,
        record.typeName,
        record.latitudeText,
        record.longitudeText,
        `MGA2020 / ${record.zone}`,
        record.eastingText,
        record.northingText,
      ];
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      const noteCell = document.createElement("td");
      const note = document.createElement("input");
      note.value = point.notes || "";
      note.placeholder = "Optional notes";
      note.setAttribute("aria-label", `Notes for ${record.label}`);
      note.addEventListener("input", () => {
        points = points.map((candidate) =>
          candidate.id === point.id ? { ...candidate, notes: note.value } : candidate,
        );
      });
      noteCell.append(note);
      const actionCell = document.createElement("td");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-button";
      edit.textContent = "✎";
      edit.title = `Edit ${record.label}`;
      edit.addEventListener("click", () => openEditorForPoint(point.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.textContent = "×";
      remove.title = `Remove ${record.label}`;
      remove.addEventListener("click", () => deletePoint(point.id));
      const actions = document.createElement("div");
      actions.className = "order-buttons";
      actions.append(edit, remove);
      actionCell.append(actions);
      row.append(noteCell, actionCell);
      pointTableBody.append(row);
    });
    renderQa();
  }

  function addPoint(type, longitude, latitude) {
    const definition = FIELDWORK_TYPES[type];
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    points = renumberWithCustomLabels([
      ...points,
      {
        id,
        type,
        longitude,
        latitude,
        notes: "",
        customLabel: "",
        locked: false,
        symbol: definition.symbol,
        color: definition.color,
      },
    ]);
    updatePointLayer();
    renderPointTable();
    const added = points.find((point) => point.id === id);
    setStatus(`${added.label} placed at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}. Drag it to refine the location or click it to edit.`);
  }

  function fitCoordinates(coordinates) {
    if (!coordinates.length) return;
    const bounds = L.latLngBounds(coordinates.map(([longitude, latitude]) => [latitude, longitude]));
    const pixels = framePixels();
    map.fitBounds(bounds, {
      paddingTopLeft: [Math.max(35, pixels.left + 25), Math.max(35, pixels.top + 25)],
      paddingBottomRight: [
        Math.max(35, mapElement.clientWidth - pixels.right + 25),
        Math.max(35, mapElement.clientHeight - pixels.bottom + 25),
      ],
      maxZoom: 19,
      animate: true,
    });
  }

  async function addOverlay(file) {
    if (!file) return;
    setStatus(`Reading georeferenced plan ${file.name}…`);
    try {
      const next = await readGeoTiffOverlay(file, overlayCrs.value);
      overlay = next;
      if (overlayLayer) map.removeLayer(overlayLayer);
      overlayLayer = L.imageOverlay(next.dataUrl, overlayBounds(next.coordinates), {
        opacity: Number(overlayOpacity.value),
        interactive: false,
        pane: "overlayPane",
      }).addTo(map);
      overlayLayer.bringToFront();
      pointLayer.bringToFront?.();
      fitCoordinates(next.coordinates);
      setStatus(`${file.name} added using ${next.sourceCrs}.`);
    } catch (error) {
      overlay = null;
      overlayLayer = null;
      setStatus(`Unable to add GeoTIFF: ${error.message}`, "error");
    } finally {
      overlayInput.value = "";
    }
  }

  function clearOverlay() {
    if (overlayLayer) map.removeLayer(overlayLayer);
    overlayLayer = null;
    overlay = null;
    setStatus("Georeferenced plan overlay removed.");
  }

  function centreOnResult(result) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.flyTo([latitude, longitude], 17, { animate: true, duration: 0.7 });
    const projectAddress = document.querySelector('[name="projectAddress"]');
    if (projectAddress && !projectAddress.value.trim()) projectAddress.value = result.display_name;
  }

  function showSearchResults(results) {
    searchResults.replaceChildren();
    searchResults.hidden = results.length === 0;
    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.textContent = result.display_name;
      button.addEventListener("click", () => {
        searchResults.hidden = true;
        centreOnResult(result);
      });
      searchResults.append(button);
    });
  }

  function parsedCoordinates(query) {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(query);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
    if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
    return null;
  }

  async function searchSite(query) {
    const cleaned = String(query || "").trim();
    if (!cleaned) {
      setStatus("Enter an address, place, or latitude/longitude pair.", "warning");
      return;
    }
    const coordinate = parsedCoordinates(cleaned);
    if (coordinate) {
      map.flyTo([coordinate[1], coordinate[0]], 18, { animate: true, duration: 0.7 });
      searchResults.hidden = true;
      return;
    }
    if (searchCache.has(cleaned)) {
      const cached = searchCache.get(cleaned);
      showSearchResults(cached);
      if (cached[0]) centreOnResult(cached[0]);
      return;
    }
    const wait = Math.max(0, 1000 - (Date.now() - lastSearchAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSearchAt = Date.now();
    setStatus(`Searching for ${cleaned}…`);
    try {
      const url = new URL(SEARCH_ENDPOINT, window.location.origin);
      url.searchParams.set("q", cleaned);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`search service returned ${response.status}`);
      const results = await response.json();
      searchCache.set(cleaned, results);
      showSearchResults(results);
      if (results[0]) centreOnResult(results[0]);
      setStatus(
        results.length
          ? "Centred on the best matching site. Choose another result if needed."
          : "No matching site was found.",
        results.length ? "neutral" : "warning",
      );
    } catch (error) {
      setStatus(`Site search failed: ${error.message}. You can still enter latitude, longitude directly.`, "error");
    }
  }

  function waitForTiles(timeout = 8000) {
    return new Promise((resolve) => {
      if (!tileLayer.isLoading?.()) {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
        return;
      }
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        tileLayer.off("load", finish);
        resolve();
      };
      tileLayer.once("load", finish);
      setTimeout(finish, timeout);
    });
  }

  function drawScaleBar(context, width, height, padding) {
    if (!latestScale) return;
    const totalMetres = latestScale * 0.1;
    const barWidth = Math.round((100 / 817) * width);
    const segmentWidth = barWidth / 4;
    const barHeight = Math.max(12, Math.round(height * 0.012));
    const x = padding;
    const y = height - padding * 2.5;
    context.save();
    context.font = `600 ${Math.round(width * 0.0105)}px Arial`;
    context.textBaseline = "bottom";
    context.fillStyle = "rgba(255,255,255,0.88)";
    context.fillRect(x - 8, y - 28, barWidth + 16, barHeight + 42);
    context.fillStyle = "#172033";
    context.textAlign = "left";
    context.fillText("0", x, y - 3);
    for (let index = 0; index < 4; index += 1) {
      context.fillStyle = index % 2 === 0 ? "#172033" : "#FFFFFF";
      context.strokeStyle = "#172033";
      context.lineWidth = 2;
      context.fillRect(x + index * segmentWidth, y, segmentWidth, barHeight);
      context.strokeRect(x + index * segmentWidth, y, segmentWidth, barHeight);
    }
    context.fillStyle = "#172033";
    context.textAlign = "center";
    for (let index = 1; index <= 4; index += 1) {
      context.fillText(formatDistance((totalMetres * index) / 4), x + segmentWidth * index, y - 3);
    }
    context.textAlign = "left";
    context.fillText(`Scale approximately 1:${latestScale.toLocaleString("en-AU")} at A1`, x, y + barHeight + 20);
    context.restore();
  }

  function drawCaptureFurniture(context, width, height) {
    context.save();
    context.strokeStyle = "rgba(20, 43, 72, 0.9)";
    context.lineWidth = Math.max(3, width / 800);
    context.strokeRect(1, 1, width - 2, height - 2);

    const padding = Math.round(width * 0.012);
    const northX = width - padding * 3;
    const northY = padding * 3;
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.strokeStyle = "#172033";
    context.lineWidth = Math.max(2, width / 1100);
    context.beginPath();
    context.moveTo(northX, northY - padding * 1.5);
    context.lineTo(northX + padding, northY + padding * 1.2);
    context.lineTo(northX, northY + padding * 0.55);
    context.lineTo(northX - padding, northY + padding * 1.2);
    context.closePath();
    context.fill();
    context.stroke();
    context.font = `700 ${Math.round(width * 0.017)}px Arial`;
    context.fillStyle = "#172033";
    context.textAlign = "center";
    context.fillText("N", northX, northY - padding * 1.85);

    const used = [...new Set(points.map((point) => point.type))];
    if (used.length) {
      const rowHeight = Math.round(height * 0.047);
      const boxWidth = Math.round(width * 0.19);
      const boxHeight = rowHeight * used.length + padding * 1.4;
      const x = width - boxWidth - padding;
      const y = height - boxHeight - padding;
      context.fillStyle = "rgba(255,255,255,0.9)";
      context.strokeStyle = "rgba(23,32,51,0.65)";
      context.lineWidth = 2;
      context.fillRect(x, y, boxWidth, boxHeight);
      context.strokeRect(x, y, boxWidth, boxHeight);
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.font = `600 ${Math.round(width * 0.012)}px Arial`;
      used.forEach((type, index) => {
        const definition = FIELDWORK_TYPES[type];
        const marker = drawMarkerCanvas(definition, 64);
        const cy = y + padding * 0.7 + rowHeight * (index + 0.5);
        context.drawImage(marker, x + padding * 0.5, cy - rowHeight * 0.35, rowHeight * 0.7, rowHeight * 0.7);
        context.fillStyle = "#172033";
        context.fillText(`${definition.code} – ${definition.name}`, x + padding * 2.2, cy);
      });
    }

    drawScaleBar(context, width, height, padding);
    context.restore();
  }

  async function captureMap() {
    await waitForTiles();
    map.closePopup();
    const source = await html2canvas(mapElement, {
      backgroundColor: "#FFFFFF",
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 10000,
      scale: Math.min(2, window.devicePixelRatio || 1),
    });
    const pixels = framePixels();
    const scaleX = source.width / mapElement.clientWidth;
    const scaleY = source.height / mapElement.clientHeight;
    const sx = Math.max(0, Math.round(pixels.left * scaleX));
    const sy = Math.max(0, Math.round(pixels.top * scaleY));
    const sw = Math.min(source.width - sx, Math.round(pixels.width * scaleX));
    const sh = Math.min(source.height - sy, Math.round(pixels.height * scaleY));
    const width = 2400;
    const height = Math.round(width / MAP_CONTENT_RATIO);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d", { alpha: false });
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    drawCaptureFurniture(context, width, height);
    return { data: output.toDataURL("image/png"), width, height };
  }

  async function capturePlan() {
    if (!includeMap.checked) return null;
    if (!loaded) throw new Error("The map is not ready yet.");
    const project = getProject?.() || {};
    const warnings = getQaWarnings();
    const image = await captureMap();
    return {
      image,
      sheet: {
        sheetNumber: mapSheetNumber.value.trim() || "001",
        drawingTitle1: mapTitle.value.trim() || "Proposed Fieldwork Plan",
        drawingTitle2: mapSubtitle.value.trim() || project.projectAddress || "",
        drawingTitle3: `${points.length} proposed fieldwork location${points.length === 1 ? "" : "s"}`,
        scale: latestScale ? `1:${latestScale.toLocaleString("en-AU")}` : "NTS",
        revision: project.revision || "-",
      },
      points: points.map(coordinateRecord),
      frameCorners: frameCorners(),
      qaWarnings: warnings,
    };
  }

  function exportOptions() {
    const project = getProject?.() || {};
    return {
      projectTitle: project.projectTitle || "Fieldwork Plan",
      points,
      frameCorners: frameCorners(),
    };
  }

  function exportCsv() {
    const headers = ["ID", "Type", "Latitude", "Longitude", "MGA2020 Zone", "Easting", "Northing", "Notes"];
    const rows = points.map((point) => {
      const record = coordinateRecord(point);
      return [
        record.label,
        record.typeName,
        record.latitudeText,
        record.longitudeText,
        record.zone,
        Math.round(record.easting),
        Math.round(record.northing),
        record.notes || "",
      ];
    });
    saveTextFile(
      [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n"),
      "fieldwork-locations.csv",
    );
  }

  map.whenReady(() => {
    loaded = true;
    map.invalidateSize(false);
    updateScale();
    updatePointLayer();
  });
  map.on("moveend zoomend", () => {
    updateScale();
    updatePointLayer();
  });
  map.on("click", (event) => {
    if (activeType) addPoint(activeType, event.latlng.lng, event.latlng.lat);
  });
  tileLayer.on("load", () => {
    loaded = true;
    updateScale();
  });
  tileLayer.on("tileerror", () => {
    tileErrors += 1;
    updateScale();
  });

  new ResizeObserver(() => {
    map.invalidateSize(false);
    updateScale();
    updatePointLayer();
  }).observe(mapElement);

  document.querySelectorAll("[data-point-type]").forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.pointType;
      updateActiveButtons();
      setStatus(`Click the map to place ${FIELDWORK_TYPES[activeType].name} locations.`);
    });
  });
  element("map-pan-mode").addEventListener("click", () => {
    activeType = null;
    updateActiveButtons();
  });
  element("site-search-button").addEventListener("click", () => searchSite(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchSite(searchInput.value);
    }
  });
  element("locate-project-address").addEventListener("click", () => {
    const address = document.querySelector('[name="projectAddress"]')?.value || "";
    searchInput.value = address;
    searchSite(address);
  });
  element("use-current-location").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Location access is not supported by this browser.", "warning");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.flyTo([position.coords.latitude, position.coords.longitude], 18, {
          animate: true,
          duration: 0.7,
        });
      },
      (error) => setStatus(`Unable to use current location: ${error.message}`, "error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
  element("fit-points").addEventListener("click", () =>
    fitCoordinates(points.map((point) => [point.longitude, point.latitude])),
  );
  element("undo-point").addEventListener("click", () => {
    if (!points.length) return;
    points = renumberWithCustomLabels(points.slice(0, -1));
    updatePointLayer();
    renderPointTable();
  });
  element("clear-points").addEventListener("click", () => {
    points = [];
    updatePointLayer();
    renderPointTable();
  });
  overlayInput.addEventListener("change", () => addOverlay(overlayInput.files[0]));
  overlayOpacity.addEventListener("input", () => {
    overlayLayer?.setOpacity(Number(overlayOpacity.value));
  });
  element("remove-overlay").addEventListener("click", clearOverlay);
  element("fit-overlay").addEventListener("click", () => {
    if (overlay) fitCoordinates(overlay.coordinates);
  });
  element("export-kml").addEventListener("click", () => downloadKml(exportOptions()));
  element("export-kmz").addEventListener("click", async () => downloadKmz(exportOptions()));
  element("export-coordinate-csv").addEventListener("click", exportCsv);

  updateActiveButtons();
  updatePointLayer();
  renderPointTable();

  return {
    capturePlan,
    getPoints: () => [...points],
    getFrameCorners: frameCorners,
    getQaWarnings,
    getPointLayer: () => pointLayer,
    setPointVisibility,
    isIncluded: () => includeMap.checked,
    hasContent: () => points.length > 0 || Boolean(overlay),
    map,
  };
}
