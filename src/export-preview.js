import "./export-preview.css";
import {
  FONT_OPTIONS,
  MAP_RESOLUTION_OPTIONS,
  loadExportPreferences,
  normaliseExportStyle,
  saveExportPreferences,
} from "./export-style.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function styleFromForm(form) {
  const data = new FormData(form);
  return normaliseExportStyle({
    fontFamily: data.get("fontFamily"),
    markerLabelSize: data.get("markerLabelSize"),
    markerLabelWeight: data.get("markerLabelWeight"),
    coordinateFontSize: data.get("coordinateFontSize"),
    titleBlockScale: data.get("titleBlockScale"),
    legendFontSize: data.get("legendFontSize"),
    logoScale: data.get("logoScale"),
    mapResolutionScale: data.get("mapResolutionScale"),
    showCoordinateInset: data.get("showCoordinateInset") === "on",
    previewBeforeExport: data.get("previewBeforeExport") === "on",
  });
}

function setControlValues(form, style) {
  for (const [name, value] of Object.entries(style)) {
    const control = form.elements.namedItem(name);
    if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  }
}

function pointRows(points = []) {
  return points.slice(0, 5).map((point) => `
    <tr>
      <td>${escapeHtml(point.label)}</td>
      <td>${escapeHtml(point.typeName)}</td>
      <td>MGA ${escapeHtml(point.zone)}</td>
      <td>${escapeHtml(point.eastingText)}</td>
      <td>${escapeHtml(point.northingText)}</td>
    </tr>`).join("");
}

function titleBlockHtml(project, mapPlan, logoUrl) {
  const sheet = mapPlan?.sheet || {};
  const companyName = String(project.companyName || "").trim();
  const showName = companyName && companyName.toUpperCase() !== "COMPANY NAME";
  const contact = [project.companyPhone, project.companyEmail, project.companyWebsite]
    .filter(Boolean)
    .join("  |  ");
  const logoContent = logoUrl
    ? `<img src="${logoUrl}" alt="Company logo preview" />`
    : showName
      ? `<div class="brand-name">${escapeHtml(companyName)}</div>`
      : "";
  return `
    <div class="export-preview-block export-preview-logo">
      ${logoContent}
      ${contact ? `<div class="export-preview-contact">${escapeHtml(contact)}</div>` : ""}
    </div>
    <div class="export-preview-block export-preview-project">
      <div class="export-preview-kicker">PROJECT</div>
      <div class="export-preview-title">${escapeHtml(project.projectTitle || "Project title")}</div>
      <div class="export-preview-fields">
        <div><span>CLIENT</span><b>${escapeHtml(project.clientName)}</b></div>
        <div><span>PROJECT NO.</span><b>${escapeHtml(project.projectNumber)}</b></div>
        <div class="wide"><span>SITE</span><b>${escapeHtml(project.projectAddress)}</b></div>
      </div>
    </div>
    <div class="export-preview-block">
      <div class="export-preview-kicker">DRAWING</div>
      <div class="export-preview-title">${escapeHtml(sheet.drawingTitle1 || "Proposed Fieldwork Plan")}</div>
      <div class="export-preview-subtitle">${escapeHtml(sheet.drawingTitle2 || project.projectAddress || "")}</div>
      <div class="export-preview-subtitle">${escapeHtml(sheet.drawingTitle3 || "")}</div>
    </div>
    <div class="export-preview-block export-preview-meta">
      <div class="export-preview-meta-row">
        <div class="export-preview-meta-cell"><span>DRAWN</span><b>${escapeHtml(project.drawnBy)}</b></div>
        <div class="export-preview-meta-cell"><span>APPROVED</span><b>${escapeHtml(project.approvedBy)}</b></div>
      </div>
      <div class="export-preview-meta-row">
        <div class="export-preview-meta-cell"><span>DATE</span><b>${escapeHtml(project.date)}</b></div>
        <div class="export-preview-meta-cell"><span>SCALE @ A1</span><b>${escapeHtml(sheet.scale || "NTS")}</b></div>
        <div class="export-preview-meta-cell"><span>FIGURE NO.</span><b>${escapeHtml(`${project.sheetPrefix || "A"}${sheet.sheetNumber || "001"}`)}</b></div>
      </div>
      <div class="export-preview-revision">
        <div><span>REV</span><b>${escapeHtml(sheet.revision || project.revision || "-")}</b></div>
        <div><span>DESCRIPTION</span><b>${escapeHtml(project.revisionDescription || "ISSUED")}</b></div>
        <div><span>DATE</span><b>${escapeHtml(project.revisionDate || project.date)}</b></div>
        <div><span>BY</span><b>${escapeHtml(project.revisionBy || project.drawnBy)}</b></div>
        <div><span>SHEET</span><b>${escapeHtml(sheet.sheetNumber || "001")}</b></div>
      </div>
    </div>`;
}

function updatePreviewVisual(dialog, project, mapPlan, style, logoUrl) {
  const sheetPreview = dialog.querySelector(".export-sheet-preview");
  const mapImage = dialog.querySelector(".export-preview-map img");
  const mapEmpty = dialog.querySelector(".export-preview-map-empty");
  const coordinate = dialog.querySelector(".export-preview-coordinate");
  const titleBlock = dialog.querySelector(".export-preview-titleblock");
  sheetPreview.style.setProperty("--preview-font", style.fontFamily);
  sheetPreview.style.setProperty("--preview-title-scale", String(style.titleBlockScale));
  sheetPreview.style.setProperty("--preview-coordinate-size", `${style.coordinateFontSize}px`);
  sheetPreview.style.setProperty("--preview-logo-scale", String(style.logoScale));
  sheetPreview.style.setProperty("--preview-accent", `#${String(project.accentColor || "245B8A").replace("#", "")}`);

  if (mapPlan?.image?.data) {
    mapImage.src = mapPlan.image.data;
    mapImage.hidden = false;
    mapEmpty.hidden = true;
  } else {
    mapImage.hidden = true;
    mapEmpty.hidden = false;
  }

  coordinate.hidden = !style.showCoordinateInset || !(mapPlan?.points?.length);
  coordinate.innerHTML = `
    <strong>FIELDWORK COORDINATE SUMMARY</strong>
    <table>
      <thead><tr><th>ID</th><th>TYPE</th><th>ZONE</th><th>EASTING</th><th>NORTHING</th></tr></thead>
      <tbody>${pointRows(mapPlan?.points)}</tbody>
    </table>
    <small>Planning coordinates only. Verify survey control, datum and final set-out requirements before fieldwork.</small>`;
  titleBlock.innerHTML = titleBlockHtml(project, mapPlan, logoUrl);
}

function updateValueLabels(form) {
  form.querySelectorAll("[data-value-for]").forEach((label) => {
    const input = form.elements.namedItem(label.dataset.valueFor);
    if (!input) return;
    const suffix = label.dataset.suffix || "";
    label.textContent = `${input.value}${suffix}`;
  });
}

function setControlsLocked(form, locked) {
  form.querySelectorAll("fieldset input, fieldset select").forEach((control) => {
    if (control.name === "previewBeforeExport") return;
    control.disabled = locked;
  });
  const note = form.querySelector(".export-preview-lock-note");
  const unlock = form.querySelector(".export-unlock");
  note.hidden = !locked;
  unlock.hidden = !locked;
}

export async function showExportPreview({
  project,
  initialMapPlan = null,
  logoFile = null,
  captureMap = null,
} = {}) {
  const preferences = loadExportPreferences();
  let style = normaliseExportStyle(preferences.style);
  let mapPlan = initialMapPlan;
  const logoUrl = await fileToDataUrl(logoFile).catch(() => "");

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "export-preview-backdrop";
    backdrop.innerHTML = `
      <div class="export-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="export-preview-title">
        <section class="export-preview-main">
          <div class="export-preview-toolbar">
            <h2 id="export-preview-title">Review PowerPoint export</h2>
            <span class="export-preview-status">Adjust the appearance, then export.</span>
          </div>
          <div class="export-sheet-preview">
            <div class="export-preview-map">
              <img alt="Map export preview" />
              <div class="export-preview-map-empty">No map sheet included</div>
            </div>
            <div class="export-preview-coordinate"></div>
            <div class="export-preview-titleblock"></div>
          </div>
        </section>
        <form class="export-preview-controls">
          <h3>Export appearance</h3>
          <p class="export-preview-lock-note" hidden>These defaults are locked. Unlock them to make changes.</p>
          <fieldset>
            <label>Font
              <select name="fontFamily">${FONT_OPTIONS.map((font) => `<option value="${font}">${font}</option>`).join("")}</select>
            </label>
            <label>Map export resolution
              <select name="mapResolutionScale">${MAP_RESOLUTION_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}</select>
            </label>
            <small class="export-preview-help">Higher resolution sharpens map symbols and text but increases file size and export time.</small>
            <label>Location label size <span class="export-preview-value" data-value-for="markerLabelSize" data-suffix=" px"></span>
              <input name="markerLabelSize" type="range" min="12" max="34" step="1" />
            </label>
            <label>Location label weight
              <select name="markerLabelWeight">
                <option value="500">Medium</option>
                <option value="600">Semi-bold</option>
                <option value="700">Bold</option>
                <option value="800">Extra bold</option>
                <option value="900">Black</option>
              </select>
            </label>
            <label>Coordinate text size <span class="export-preview-value" data-value-for="coordinateFontSize" data-suffix=" pt"></span>
              <input name="coordinateFontSize" type="range" min="7" max="16" step="0.5" />
            </label>
            <label>Legend text size <span class="export-preview-value" data-value-for="legendFontSize" data-suffix=" pt"></span>
              <input name="legendFontSize" type="range" min="9" max="22" step="1" />
            </label>
            <label>Title block size <span class="export-preview-value" data-value-for="titleBlockScale" data-suffix="×"></span>
              <input name="titleBlockScale" type="range" min="0.85" max="1.35" step="0.05" />
            </label>
            <label>Company logo size <span class="export-preview-value" data-value-for="logoScale" data-suffix="×"></span>
              <input name="logoScale" type="range" min="0.65" max="1.35" step="0.05" />
            </label>
            <label class="export-preview-check"><input name="showCoordinateInset" type="checkbox" /> Show coordinate table on small map plans</label>
            <label class="export-preview-check"><input name="previewBeforeExport" type="checkbox" /> Show this preview before future exports</label>
            <label class="export-preview-check"><input name="saveDefaults" type="checkbox" checked /> Save settings as defaults</label>
            <label class="export-preview-check"><input name="lockDefaults" type="checkbox" /> Lock defaults after export</label>
          </fieldset>
          <div class="export-preview-actions">
            <button class="export-unlock" type="button" hidden>Unlock saved settings</button>
            <button class="export-cancel" type="button">Cancel</button>
            <button class="export-confirm" type="submit">Generate PowerPoint</button>
          </div>
        </form>
      </div>`;

    document.body.append(backdrop);
    const dialog = backdrop.querySelector(".export-preview-dialog");
    const form = backdrop.querySelector("form");
    const status = backdrop.querySelector(".export-preview-status");
    setControlValues(form, style);
    updateValueLabels(form);
    setControlsLocked(form, preferences.locked);
    updatePreviewVisual(dialog, project, mapPlan, style, logoUrl);

    let captureTimer = null;
    let captureSequence = 0;

    const scheduleCapture = () => {
      style = styleFromForm(form);
      updateValueLabels(form);
      updatePreviewVisual(dialog, project, mapPlan, style, logoUrl);
      if (!captureMap || !mapPlan) return;
      clearTimeout(captureTimer);
      captureTimer = setTimeout(async () => {
        const sequence = ++captureSequence;
        status.textContent = "Refreshing map preview…";
        status.dataset.tone = "busy";
        try {
          const nextPlan = await captureMap(style);
          if (sequence !== captureSequence) return;
          mapPlan = nextPlan;
          updatePreviewVisual(dialog, project, mapPlan, style, logoUrl);
          status.textContent = "Preview updated.";
          status.dataset.tone = "neutral";
        } catch (error) {
          if (sequence !== captureSequence) return;
          status.textContent = `Preview refresh failed: ${error.message}`;
          status.dataset.tone = "error";
        }
      }, 350);
    };

    form.addEventListener("input", (event) => {
      if (["saveDefaults", "lockDefaults"].includes(event.target.name)) return;
      scheduleCapture();
    });
    form.addEventListener("change", (event) => {
      if (["saveDefaults", "lockDefaults"].includes(event.target.name)) return;
      scheduleCapture();
    });

    form.querySelector(".export-unlock").addEventListener("click", () => {
      setControlsLocked(form, false);
      form.elements.lockDefaults.checked = false;
      status.textContent = "Saved settings unlocked for this export.";
      status.dataset.tone = "neutral";
    });

    const finish = (result) => {
      clearTimeout(captureTimer);
      backdrop.remove();
      resolve(result);
    };

    form.querySelector(".export-cancel").addEventListener("click", () => finish({ confirmed: false }));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish({ confirmed: false });
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      style = styleFromForm(form);
      status.textContent = "Preparing final map capture…";
      status.dataset.tone = "busy";
      try {
        if (captureMap && mapPlan) mapPlan = await captureMap(style);
        if (form.elements.saveDefaults.checked) {
          saveExportPreferences(style, form.elements.lockDefaults.checked);
        }
        finish({ confirmed: true, style, mapPlan });
      } catch (error) {
        status.textContent = `Unable to prepare the export: ${error.message}`;
        status.dataset.tone = "error";
      }
    });
  });
}
