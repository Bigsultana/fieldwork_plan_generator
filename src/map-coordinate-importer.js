import L from "leaflet";
import "./coordinate-import.css";
import {
  coordinateTemplateCsv,
  detectCoordinateMapping,
  parseDelimitedText,
  prepareCoordinateImport,
} from "./coordinate-import.js";
import { FIELDWORK_TYPES } from "./map-model.js";

const CRS_OPTIONS = `
  <option value="EPSG:4326" selected>WGS84 latitude / longitude</option>
  <option value="EPSG:7856">GDA2020 / MGA Zone 56</option>
  <option value="EPSG:7855">GDA2020 / MGA Zone 55</option>
  <option value="EPSG:28356">GDA94 / MGA Zone 56</option>
  <option value="EPSG:28355">GDA94 / MGA Zone 55</option>
  <option value="EPSG:32756">WGS84 / UTM Zone 56S</option>
  <option value="EPSG:32755">WGS84 / UTM Zone 55S</option>`;

function createGroup() {
  const group = document.createElement("div");
  group.className = "tool-group coordinate-import-group";
  group.innerHTML = `
    <h3>Import coordinate points</h3>
    <label>Coordinate file
      <input id="coordinate-import-file" type="file" accept=".csv,.txt,text/csv,text/plain" />
    </label>
    <div class="coordinate-import-grid">
      <label class="span-two">Source coordinate system<select id="coordinate-import-crs">${CRS_OPTIONS}</select></label>
      <label>Default type<select id="coordinate-import-default-type">
        ${Object.values(FIELDWORK_TYPES).map((type) => `<option value="${type.code}">${type.name}</option>`).join("")}
      </select></label>
      <label class="overlay-check"><input id="coordinate-import-replace" type="checkbox" /> Replace existing locations</label>
    </div>
    <div id="coordinate-import-mapping" class="coordinate-import-grid" hidden>
      <label>ID / label<select data-map-field="id"></select></label>
      <label>Type<select data-map-field="type"></select></label>
      <label id="coordinate-x-label">Longitude<select data-map-field="x"></select></label>
      <label id="coordinate-y-label">Latitude<select data-map-field="y"></select></label>
      <label class="span-two">Notes<select data-map-field="notes"></select></label>
    </div>
    <div id="coordinate-import-preview" class="coordinate-import-preview" hidden></div>
    <p id="coordinate-import-summary" class="coordinate-import-summary">Select a CSV or delimited text file. Column names are detected automatically and can be remapped before import.</p>
    <div class="coordinate-import-actions">
      <button id="coordinate-import-run" class="button secondary" type="button" disabled>Import locations</button>
      <button id="coordinate-import-template" class="button secondary" type="button">Download template</button>
      <button id="coordinate-import-clear" class="button danger" type="button">Clear file</button>
    </div>
    <small class="enhancement-note">Supports the app's exported coordinate CSV plus common survey columns such as Point ID, Type, Latitude, Longitude, Easting, Northing and Notes. Maximum 500 locations per import.</small>`;
  return group;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function optionMarkup(headers, selected, optional = true) {
  const options = [];
  if (optional) options.push(`<option value="">Not used</option>`);
  headers.forEach((header) => {
    const escaped = String(header)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    options.push(`<option value="${escaped}"${header === selected ? " selected" : ""}>${escaped}</option>`);
  });
  return options.join("");
}

function mappingFromControls(group) {
  return Object.fromEntries(
    [...group.querySelectorAll("[data-map-field]")].map((select) => [select.dataset.mapField, select.value]),
  );
}

function setSummary(element, message, tone = "neutral") {
  element.textContent = message;
  element.dataset.tone = tone;
}

function fitImportedPoints(map, points) {
  if (!points.length) return;
  const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
  map.fitBounds(bounds, { padding: [70, 70], maxZoom: 19, animate: true });
}

async function applyPointMetadata(mapPlanner, point) {
  const layers = mapPlanner.getPointLayer?.().getLayers?.() || [];
  const marker = layers.at(-1);
  if (!marker || (!point.customLabel && !point.notes)) return;
  marker.fire("click");
  await nextFrame();
  const form = document.querySelector(".leaflet-popup-pane .fieldwork-point-editor");
  if (!form) throw new Error("The imported point editor could not be opened.");
  const labelInput = form.elements.namedItem("customLabel");
  const notesInput = form.elements.namedItem("notes");
  if (labelInput) labelInput.value = point.customLabel || "";
  if (notesInput) notesInput.value = point.notes || "";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await nextFrame();
}

async function addPreparedPoint(mapPlanner, point) {
  const button = document.querySelector(`[data-point-type="${point.type}"]`);
  if (!button) throw new Error(`Point type ${point.type} is not available.`);
  button.click();
  mapPlanner.map.fire("click", { latlng: L.latLng(point.latitude, point.longitude) });
  await nextFrame();
  await applyPointMetadata(mapPlanner, point);
}

export function enhanceCoordinateImport(mapPlanner, { setStatus = () => {} } = {}) {
  const tools = document.querySelector(".map-tools");
  if (!mapPlanner?.map || !tools || tools.dataset.coordinateImport === "true") return mapPlanner;
  tools.dataset.coordinateImport = "true";

  const group = createGroup();
  const locationGroup = [...tools.children].find((child) => child.textContent.includes("Place fieldwork locations"));
  if (locationGroup) locationGroup.after(group);
  else tools.append(group);

  const fileInput = group.querySelector("#coordinate-import-file");
  const crsSelect = group.querySelector("#coordinate-import-crs");
  const defaultType = group.querySelector("#coordinate-import-default-type");
  const replaceExisting = group.querySelector("#coordinate-import-replace");
  const mappingPanel = group.querySelector("#coordinate-import-mapping");
  const preview = group.querySelector("#coordinate-import-preview");
  const summary = group.querySelector("#coordinate-import-summary");
  const importButton = group.querySelector("#coordinate-import-run");
  const xLabel = group.querySelector("#coordinate-x-label");
  const yLabel = group.querySelector("#coordinate-y-label");

  let headers = [];
  let rows = [];
  let currentMapping = {};

  function reset() {
    fileInput.value = "";
    headers = [];
    rows = [];
    currentMapping = {};
    mappingPanel.hidden = true;
    preview.hidden = true;
    preview.replaceChildren();
    importButton.disabled = true;
    setSummary(summary, "Select a CSV or delimited text file. Column names are detected automatically and can be remapped before import.");
  }

  function renderMapping(mapping) {
    currentMapping = mapping;
    const geographic = crsSelect.value === "EPSG:4326";
    xLabel.childNodes[0].textContent = geographic ? "Longitude" : "Easting";
    yLabel.childNodes[0].textContent = geographic ? "Latitude" : "Northing";
    [...mappingPanel.querySelectorAll("[data-map-field]")].forEach((select) => {
      const field = select.dataset.mapField;
      select.innerHTML = optionMarkup(headers, mapping[field], field !== "x" && field !== "y");
    });
    mappingPanel.hidden = false;
  }

  function prepared() {
    return prepareCoordinateImport({
      headers,
      rows,
      mapping: mappingFromControls(mappingPanel),
      sourceCrs: crsSelect.value,
      defaultType: defaultType.value,
    });
  }

  function renderPreview() {
    if (!rows.length) return;
    let result;
    try {
      result = prepared();
    } catch (error) {
      preview.hidden = true;
      importButton.disabled = true;
      setSummary(summary, error.message, "error");
      return;
    }
    const visible = result.points.slice(0, 5);
    preview.innerHTML = visible.length
      ? `<table><thead><tr><th>ID</th><th>Type</th><th>Latitude</th><th>Longitude</th><th>Notes</th></tr></thead><tbody>${visible
          .map((point) => `<tr><td>${point.customLabel || "Auto"}</td><td>${point.type}</td><td>${point.latitude.toFixed(7)}</td><td>${point.longitude.toFixed(7)}</td><td>${point.notes || ""}</td></tr>`)
          .join("")}</tbody></table>`
      : "";
    preview.hidden = !visible.length;
    importButton.disabled = !result.points.length;
    const parts = [`${result.points.length} valid location${result.points.length === 1 ? "" : "s"}`];
    if (result.errors.length) parts.push(`${result.errors.length} invalid row${result.errors.length === 1 ? "" : "s"}`);
    if (result.warnings.length) parts.push(`${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
    setSummary(summary, `${parts.join(" · ")}. ${visible.length < result.points.length ? "Preview shows the first five." : ""}`.trim(), result.errors.length ? "warning" : "success");
  }

  async function readFile() {
    const file = fileInput.files?.[0];
    if (!file) return reset();
    try {
      const parsed = parseDelimitedText(await file.text());
      if (parsed.length < 2) throw new Error("The coordinate file needs a header row and at least one data row.");
      headers = parsed[0].map((header, index) => String(header || `Column ${index + 1}`).trim());
      rows = parsed.slice(1);
      renderMapping(detectCoordinateMapping(headers, crsSelect.value));
      renderPreview();
      setStatus(`${file.name} loaded for coordinate-column review.`);
    } catch (error) {
      reset();
      setSummary(summary, error.message, "error");
      setStatus(`Unable to read coordinate file: ${error.message}`, "error");
    }
  }

  fileInput.addEventListener("change", readFile);
  crsSelect.addEventListener("change", () => {
    if (!headers.length) return;
    const detected = detectCoordinateMapping(headers, crsSelect.value);
    renderMapping({ ...currentMapping, x: detected.x, y: detected.y });
    renderPreview();
  });
  defaultType.addEventListener("change", renderPreview);
  mappingPanel.addEventListener("change", renderPreview);

  importButton.addEventListener("click", async () => {
    let result;
    try {
      result = prepared();
    } catch (error) {
      setSummary(summary, error.message, "error");
      return;
    }
    if (!result.points.length) return;
    importButton.disabled = true;
    if (replaceExisting.checked) document.querySelector("#clear-points")?.click();
    setStatus(`Importing ${result.points.length} coordinate locations…`);
    try {
      for (let index = 0; index < result.points.length; index += 1) {
        await addPreparedPoint(mapPlanner, result.points[index]);
        setSummary(summary, `Importing location ${index + 1} of ${result.points.length}…`);
      }
      document.querySelector("#map-pan-mode")?.click();
      fitImportedPoints(mapPlanner.map, result.points);
      const issueText = result.errors.length || result.warnings.length
        ? ` ${result.errors.length} invalid rows and ${result.warnings.length} warnings were skipped or substituted.`
        : "";
      setSummary(summary, `${result.points.length} locations imported successfully.${issueText}`, result.errors.length ? "warning" : "success");
      setStatus(`${result.points.length} coordinate locations imported and fitted to the map.`);
    } catch (error) {
      setSummary(summary, `Import stopped: ${error.message}`, "error");
      setStatus(`Coordinate import stopped: ${error.message}`, "error");
    } finally {
      importButton.disabled = false;
    }
  });

  group.querySelector("#coordinate-import-template").addEventListener("click", () => {
    downloadText(coordinateTemplateCsv(), "fieldwork-coordinate-template.csv");
  });
  group.querySelector("#coordinate-import-clear").addEventListener("click", reset);

  return mapPlanner;
}
