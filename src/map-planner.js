import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import {
  FIELDWORK_TYPES,
  MAP_CONTENT_RATIO,
  coordinateRecord,
  haversineDistanceMetres,
  renumberPoints,
  scaleFromFrameWidth,
} from "./map-model.js";
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

function drawMarkerCanvas(definition, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const centre = size / 2;
  const radius = size * 0.28;
  context.clearRect(0, 0, size, size);
  context.strokeStyle = `#${definition.color}`;
  context.fillStyle = "#FFFFFF";
  context.lineWidth = Math.max(4, size * 0.075);
  context.lineJoin = "round";
  context.lineCap = "round";

  if (definition.code === "TP") {
    context.beginPath();
    context.rect(centre - radius, centre - radius, radius * 2, radius * 2);
    context.fill();
    context.stroke();
  } else if (definition.code === "CPT") {
    context.beginPath();
    context.moveTo(centre, centre - radius * 1.25);
    context.lineTo(centre + radius * 1.25, centre);
    context.lineTo(centre, centre + radius * 1.25);
    context.lineTo(centre - radius * 1.25, centre);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (definition.code === "DCP") {
    context.beginPath();
    context.moveTo(centre, centre - radius * 1.35);
    context.lineTo(centre + radius * 1.25, centre + radius);
    context.lineTo(centre - radius * 1.25, centre + radius);
    context.closePath();
    context.fill();
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
    context.fill();
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

function pointIcon(point) {
  const definition = FIELDWORK_TYPES[point.type] || {
    code: point.type,
    symbol: "●",
    color: "333333",
  };
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;min-width:72px;transform:translate(-20px,-12px);pointer-events:none">
      <span style="display:grid;place-items:center;width:30px;height:30px;color:#${definition.color};background:#fff;border:3px solid #${definition.color};border-radius:${definition.code === "TP" ? "3px" : "50%"};font:800 18px/1 Arial,sans-serif;box-shadow:0 1px 5px rgba(0,0,0,.35)">${definition.symbol}</span>
      <span style="margin-top:2px;padding:1px 4px;color:#111827;background:rgba(255,255,255,.92);border-radius:3px;font:800 13px/1.3 Arial,sans-serif;white-space:nowrap;text-shadow:0 0 2px #fff">${point.label}</span>
    </div>`;
  return L.divIcon({
    className: "fieldwork-leaflet-marker",
    html,
    iconSize: [32, 48],
    iconAnchor: [16, 16],
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
  const searchCache = new Map();

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

  L.control.scale({ metric: true, imperial: false, maxWidth: 130 }).addTo(map);
  const pointLayer = L.layerGroup().addTo(map);

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

  function updateScale() {
    if (!loaded) return;
    const pixels = framePixels();
    const west = map.containerPointToLatLng([pixels.left, pixels.top + pixels.height / 2]);
    const east = map.containerPointToLatLng([pixels.right, pixels.top + pixels.height / 2]);
    const groundWidth = haversineDistanceMetres([west.lng, west.lat], [east.lng, east.lat]);
    latestScale = scaleFromFrameWidth(groundWidth);
    const tileWarning = tileErrors ? " · some background tiles were unavailable" : "";
    setMapStatus(`A1 map frame · approximately 1:${latestScale.toLocaleString("en-AU")} · pan and zoom inside the blue outline${tileWarning}`);
  }

  function updatePointLayer() {
    pointLayer.clearLayers();
    points.forEach((point) => {
      L.marker([point.latitude, point.longitude], {
        icon: pointIcon(point),
        interactive: false,
        keyboard: false,
        pane: "markerPane",
      }).addTo(pointLayer);
    });
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
        record.label,
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
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.textContent = "×";
      remove.title = `Remove ${record.label}`;
      remove.addEventListener("click", () => {
        points = renumberPoints(points.filter((candidate) => candidate.id !== point.id));
        updatePointLayer();
        renderPointTable();
      });
      actionCell.append(remove);
      row.append(noteCell, actionCell);
      pointTableBody.append(row);
    });
  }

  function addPoint(type, longitude, latitude) {
    const definition = FIELDWORK_TYPES[type];
    points = renumberPoints([
      ...points,
      {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type,
        longitude,
        latitude,
        notes: "",
        symbol: definition.symbol,
        color: definition.color,
      },
    ]);
    updatePointLayer();
    renderPointTable();
    const added = points.at(-1);
    setStatus(`${added.label} placed at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}.`);
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

    if (latestScale) {
      const text = `Approximate scale 1:${latestScale.toLocaleString("en-AU")} at A1`;
      context.font = `600 ${Math.round(width * 0.011)}px Arial`;
      const textWidth = context.measureText(text).width;
      context.fillStyle = "rgba(255,255,255,0.9)";
      context.fillRect(padding, height - padding * 2.4, textWidth + padding, padding * 1.5);
      context.fillStyle = "#172033";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(text, padding * 1.5, height - padding * 1.65);
    }
    context.restore();
  }

  async function captureMap() {
    await waitForTiles();
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
    const image = await captureMap();
    return {
      image,
      sheet: {
        sheetNumber: mapSheetNumber.value.trim() || "001",
        drawingTitle1: mapTitle.value.trim() || "Proposed Fieldwork Plan",
        drawingTitle2: mapSubtitle.value.trim() || project.projectAddress || "",
        drawingTitle3: `${points.length} proposed fieldwork location${points.length === 1 ? "" : "s"}`,
        scale: latestScale ? `1:${latestScale.toLocaleString("en-AU")}` : "NTS",
        revision: "-",
      },
      points: points.map(coordinateRecord),
      frameCorners: frameCorners(),
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
  });
  map.on("moveend zoomend", updateScale);
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
    points = renumberPoints(points.slice(0, -1));
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
    isIncluded: () => includeMap.checked,
    hasContent: () => points.length > 0 || Boolean(overlay),
    map,
  };
}
