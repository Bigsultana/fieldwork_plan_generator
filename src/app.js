import "./styles.css";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  DEFAULT_PROJECT,
  applyCsvRows,
  normaliseHex,
  parseCsv,
  renumberSheets,
  serialisableProject,
  sheetFromFile,
  validateSheets,
} from "./model.js";
import { downloadPresentation, generatePresentation } from "./presentation.js";

const MAX_IMAGES = 60;
const PROFILE_KEY = "fieldwork-plan-generator-profile-v2";

const form = document.querySelector("#generator-form");
const imageInput = document.querySelector("#image-files");
const logoInput = document.querySelector("#logo-files");
const csvInput = document.querySelector("#csv-file");
const registerBody = document.querySelector("#sheet-register");
const registerWrapper = document.querySelector("#register-wrapper");
const emptyRegister = document.querySelector("#empty-register");
const imageCount = document.querySelector("#image-count");
const statusMessage = document.querySelector("#status-message");
const progress = document.querySelector("#progress");
const generateButton = document.querySelector("#generate");
const profileFile = document.querySelector("#profile-file");
const dropZone = document.querySelector("#drop-zone");

let sheets = [];
let logoFile = null;

function formProject() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.accentColor = normaliseHex(data.accentColor);
  return serialisableProject(data);
}

function fillProject(project) {
  const merged = { ...DEFAULT_PROJECT, ...project };
  for (const [key, value] of Object.entries(merged)) {
    const element = form.elements.namedItem(key);
    if (!element) continue;
    element.value = key === "accentColor" ? `#${normaliseHex(value)}` : value;
  }
}

function saveProjectDefaults() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(formProject()));
}

function restoreProjectDefaults(showStatus = true) {
  const saved = localStorage.getItem(PROFILE_KEY);
  fillProject(saved ? JSON.parse(saved) : DEFAULT_PROJECT);
  if (showStatus) setStatus(saved ? "Saved defaults restored." : "Default fields restored.");
}

function setStatus(message, tone = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function setBusy(busy) {
  generateButton.disabled = busy;
  form.setAttribute("aria-busy", String(busy));
  progress.hidden = !busy;
  if (!busy) progress.value = 0;
}

function updateSheet(id, key, value) {
  sheets = sheets.map((sheet) => (sheet.id === id ? { ...sheet, [key]: value } : sheet));
}

function moveSheet(id, direction) {
  const index = sheets.findIndex((sheet) => sheet.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sheets.length) return;
  const next = [...sheets];
  [next[index], next[target]] = [next[target], next[index]];
  sheets = next;
  renderRegister();
}

function registerInput(sheet, key, className = "") {
  const input = document.createElement("input");
  input.value = sheet[key] || "";
  input.className = className;
  input.setAttribute("aria-label", `${key} for ${sheet.filename}`);
  input.addEventListener("input", () => updateSheet(sheet.id, key, input.value));
  return input;
}

function actionButton(label, title, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderRegister() {
  registerBody.replaceChildren();
  const hasSheets = sheets.length > 0;
  registerWrapper.hidden = !hasSheets;
  emptyRegister.hidden = hasSheets;
  imageCount.textContent = hasSheets
    ? `${sheets.length} image${sheets.length === 1 ? "" : "s"} selected`
    : "No images selected";

  sheets.forEach((sheet, index) => {
    const row = document.createElement("tr");

    const orderCell = document.createElement("td");
    const order = document.createElement("div");
    order.className = "order-buttons";
    order.append(
      actionButton("↑", `Move ${sheet.filename} up`, () => moveSheet(sheet.id, -1), index === 0),
      actionButton(
        "↓",
        `Move ${sheet.filename} down`,
        () => moveSheet(sheet.id, 1),
        index === sheets.length - 1,
      ),
    );
    orderCell.append(order);

    const fileCell = document.createElement("td");
    fileCell.className = "filename-cell";
    fileCell.textContent = sheet.filename;
    fileCell.title = sheet.filename;

    const sheetCell = document.createElement("td");
    sheetCell.append(registerInput(sheet, "sheetNumber", "small-input"));

    const title1Cell = document.createElement("td");
    title1Cell.append(registerInput(sheet, "drawingTitle1"));

    const title2Cell = document.createElement("td");
    title2Cell.append(registerInput(sheet, "drawingTitle2"));

    const title3Cell = document.createElement("td");
    title3Cell.append(registerInput(sheet, "drawingTitle3"));

    const scaleCell = document.createElement("td");
    scaleCell.append(registerInput(sheet, "scale", "small-input"));

    const revisionCell = document.createElement("td");
    revisionCell.append(registerInput(sheet, "revision", "small-input"));

    const removeCell = document.createElement("td");
    removeCell.append(
      actionButton("×", `Remove ${sheet.filename}`, () => {
        sheets = sheets.filter((candidate) => candidate.id !== sheet.id);
        renderRegister();
      }),
    );

    row.append(
      orderCell,
      fileCell,
      sheetCell,
      title1Cell,
      title2Cell,
      title3Cell,
      scaleCell,
      revisionCell,
      removeCell,
    );
    registerBody.append(row);
  });
}

function supportedImage(file) {
  const lower = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function addFiles(fileList) {
  const files = [...fileList].filter(supportedImage);
  const room = Math.max(0, MAX_IMAGES - sheets.length);
  const accepted = files.slice(0, room);
  const start = sheets.length;
  sheets = [...sheets, ...accepted.map((file, index) => sheetFromFile(file, start + index + 1))];
  renderRegister();
  if (files.length > accepted.length) {
    setStatus(`Only the first ${MAX_IMAGES} supported images were retained.`, "warning");
  } else if (accepted.length) {
    setStatus(`${accepted.length} image${accepted.length === 1 ? "" : "s"} added.`);
  } else {
    setStatus("No supported image files were selected.", "warning");
  }
  imageInput.value = "";
}

async function applyCsv(file) {
  if (!file || sheets.length === 0) {
    setStatus("Select images before applying CSV metadata.", "warning");
    return;
  }
  const rows = parseCsv(await file.text());
  sheets = applyCsvRows(sheets, rows);
  renderRegister();
  setStatus(`CSV metadata applied to ${Math.min(rows.length, sheets.length)} sheet rows.`);
  csvInput.value = "";
}

function exportProfile() {
  const profile = {
    version: 2,
    project: formProject(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fieldwork-plan-profile.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  saveProjectDefaults();
  setStatus("Profile exported and saved as browser defaults.");
}

async function importProfile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    fillProject(parsed.project || parsed);
    saveProjectDefaults();
    setStatus("Profile imported and saved as browser defaults.");
  } catch (error) {
    setStatus(`Unable to import profile: ${error.message}`, "error");
  } finally {
    profileFile.value = "";
  }
}

async function generate(event) {
  event.preventDefault();
  const project = formProject();
  const errors = validateSheets(sheets);
  if (!project.projectTitle.trim()) errors.unshift("Project title is required.");
  if (sheets.length === 0) errors.push("Select at least one fieldwork image.");
  if (errors.length) {
    setStatus(errors.join(" "), "error");
    return;
  }

  saveProjectDefaults();
  setBusy(true);
  try {
    const result = await generatePresentation(project, sheets, logoFile, (current, total, message) => {
      progress.max = Math.max(total, 1);
      progress.value = current;
      setStatus(message);
    });
    const filename = downloadPresentation(result.buffer, project);
    const warning = result.missing.length
      ? ` ${result.missing.length} image${result.missing.length === 1 ? " was" : "s were"} replaced with a warning placeholder.`
      : "";
    setStatus(`${filename} generated.${warning}`, result.missing.length ? "warning" : "success");
  } catch (error) {
    console.error(error);
    setStatus(`PowerPoint generation failed: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

imageInput.addEventListener("change", () => addFiles(imageInput.files));
logoInput.addEventListener("change", () => {
  logoFile = logoInput.files[0] || null;
  setStatus(logoFile ? `Logo selected: ${logoFile.name}` : "Logo cleared.");
});
csvInput.addEventListener("change", () => applyCsv(csvInput.files[0]));
form.addEventListener("submit", generate);

document.querySelector("#sort-files").addEventListener("click", () => {
  sheets = [...sheets].sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  renderRegister();
  setStatus("Images sorted by filename.");
});
document.querySelector("#renumber-files").addEventListener("click", () => {
  sheets = renumberSheets(sheets);
  renderRegister();
  setStatus("Sheet numbers reset to register order.");
});
document.querySelector("#clear-files").addEventListener("click", () => {
  sheets = [];
  renderRegister();
  setStatus("All images cleared.");
});
document.querySelector("#export-profile").addEventListener("click", exportProfile);
document.querySelector("#import-profile").addEventListener("click", () => profileFile.click());
profileFile.addEventListener("change", () => importProfile(profileFile.files[0]));
document.querySelector("#restore-profile").addEventListener("click", () => restoreProjectDefaults());

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}
dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

restoreProjectDefaults(false);
renderRegister();
