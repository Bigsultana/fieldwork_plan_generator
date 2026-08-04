import L from "leaflet";
import "./coordinate-import.css";
import {
  coordinateTemplateCsv,
  detectCoordinateSchema,
  parseDelimitedText,
  prepareCoordinateImport,
} from "./coordinate-import.js";

const CRS_OPTIONS = `
  <option value="auto" selected>Auto — WGS84 for Lat/Long or read Zone column</option>
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
    <label>Coordinate system
      <select id="coordinate-import-crs">${CRS_OPTIONS}</select>
    </label>
    <small class="enhancement-note">For Latitude/Longitude files, leave this on Auto. For Easting/Northing files, select the MGA/UTM grid or include a Zone column with 55 or 56.</small>
    <label class="overlay-check"><input id="coordinate-import-replace" type="checkbox" /> Replace existing locations</label>
    <div id="coordinate-import-preview" class="coordinate-import-preview" hidden></div>
    <p id="coordinate-import-summary" class="coordinate-import-summary">Upload a file containing Location ID plus either Latitude/Longitude or Easting/Northing. Point type is inferred from IDs such as BH1, TP1, CPT1, DCP1, MW1 or SP1.</p>
    <div class="coordinate-import-actions">
      <button id="coordinate-import-run" class="button secondary" type="button" disabled>Import locations</button>
      <button id="coordinate-import-template" class="button secondary" type="button">Download template</button>
      <button id="coordinate-import-clear" class="button danger" type="button">Clear file</button>
    </div>
    <small class="enhancement-note">Required columns: <b>Location ID</b> and either <b>Latitude + Longitude</b> or <b>Easting + Northing</b>. Extra columns are ignored. Maximum 500 locations per import.</small>`;
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
  if (!marker || !point.customLabel) return;
  marker.fire("click");
  await nextFrame();
  const form = document.querySelector(".leaflet-popup-pane .fieldwork-point-editor");
  if (!form) throw new Error("The imported point editor could not be opened.");
  const labelInput = form.elements.namedItem("customLabel");
  if (labelInput) labelInput.value = point.customLabel;
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
  const replaceExisting = group.querySelector("#coordinate-import-replace");
  const preview = group.querySelector("#coordinate-import-preview");
  const summary = group.querySelector("#coordinate-import-summary");
  const importButton = group.querySelector("#coordinate-import-run");

  let headers = [];
  let rows = [];

  function reset() {
    fileInput.value = "";
    headers = [];
    rows = [];
    preview.hidden = true;
    preview.replaceChildren();
    importButton.disabled = true;
    setSummary(summary, "Upload a file containing Location ID plus either Latitude/Longitude or Easting/Northing. Point type is inferred from the Location ID prefix.");
  }

  function prepared() {
    return prepareCoordinateImport({ headers, rows, sourceCrs: crsSelect.value });
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
      ? `<table><thead><tr><th>Location ID</th><th>Marker</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>${visible
          .map((point) => `<tr><td>${point.customLabel}</td><td>${point.type}</td><td>${point.latitude.toFixed(7)}</td><td>${point.longitude.toFixed(7)}</td></tr>`)
          .join("")}</tbody></table>`
      : "";
    preview.hidden = !visible.length;
    importButton.disabled = !result.points.length;

    const sourceDescription = result.schema.format === "geographic"
      ? "Latitude/Longitude detected"
      : "Easting/Northing detected";
    const parts = [`${sourceDescription}`, `${result.points.length} valid location${result.points.length === 1 ? "" : "s"}`];
    if (result.errors.length) parts.push(`${result.errors.length} invalid row${result.errors.length === 1 ? "" : "s"}`);
    if (result.warnings.length) parts.push(`${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
    setSummary(
      summary,
      `${parts.join(" · ")}. ${visible.length < result.points.length ? "Preview shows the first five." : ""}`.trim(),
      result.errors.length ? "warning" : "success",
    );
  }

  async function readFile() {
    const file = fileInput.files?.[0];
    if (!file) return reset();
    try {
      const parsed = parseDelimitedText(await file.text());
      if (parsed.length < 2) throw new Error("The coordinate file needs a header row and at least one data row.");
      headers = parsed[0].map((header, index) => String(header || `Column ${index + 1}`).trim());
      rows = parsed.slice(1);
      const schema = detectCoordinateSchema(headers);
      if (!schema.id) throw new Error("The file needs a Location ID column.");
      if (!schema.format) throw new Error("The file needs Latitude and Longitude columns or Easting and Northing columns.");
      renderPreview();
      setStatus(`${file.name} loaded and its coordinate columns were detected automatically.`);
    } catch (error) {
      headers = [];
      rows = [];
      preview.hidden = true;
      importButton.disabled = true;
      setSummary(summary, error.message, "error");
      setStatus(`Unable to read coordinate file: ${error.message}`, "error");
    }
  }

  fileInput.addEventListener("change", readFile);
  crsSelect.addEventListener("change", renderPreview);

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
