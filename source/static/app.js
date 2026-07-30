const form = document.querySelector('#generator-form');
const imagesInput = document.querySelector('#images');
const rowsBody = document.querySelector('#sheet-rows');
const sheetArea = document.querySelector('#sheet-area');
const emptyState = document.querySelector('#empty-state');
const generateButton = document.querySelector('#generate-button');
const imageCount = document.querySelector('#image-count');
const message = document.querySelector('#message');
const csvInput = document.querySelector('#csv-import');
const settingsKey = 'fieldwork-plan-generator:settings:v1';
let selectedFiles = [];
let objectUrls = [];

const projectFieldIds = [
  'project_title', 'project_address', 'project_number', 'client_name',
  'drawn_by', 'designed_by', 'approved_by', 'date', 'drawing_status',
  'sheet_prefix', 'company_name', 'company_address', 'company_phone',
  'company_email', 'company_website'
];

function todayDisplay() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(date.getFullYear()).slice(-2)}`;
}

function saveSettings() {
  const settings = Object.fromEntries(projectFieldIds.map(id => [id, document.querySelector(`#${id}`).value]));
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function loadSettings() {
  document.querySelector('#date').value = todayDisplay();
  document.querySelector('#sheet_prefix').value = 'F';
  try {
    const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    projectFieldIds.forEach(id => {
      if (settings[id] !== undefined) document.querySelector(`#${id}`).value = settings[id];
    });
  } catch (_) {
    // Ignore invalid local settings.
  }
}

function titleFromFilename(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function clearObjectUrls() {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls = [];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function rowTemplate(file, index, existing = {}) {
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  const sheetNumber = existing.sheet_number || String(index + 1).padStart(3, '0');
  const primaryTitle = existing.drawing_title_1 || titleFromFilename(file.name) || `Plan ${sheetNumber}`;
  return `
    <tr data-index="${index}">
      <td><img class="preview" src="${url}" alt="Preview of ${escapeHtml(file.name)}"></td>
      <td><input data-key="sheet_number" value="${escapeHtml(sheetNumber)}" maxlength="20" aria-label="Sheet number"></td>
      <td><input data-key="drawing_title_1" value="${escapeHtml(primaryTitle)}" maxlength="200" aria-label="Primary title"></td>
      <td><input data-key="drawing_title_2" value="${escapeHtml(existing.drawing_title_2 || '')}" maxlength="200" aria-label="Subtitle"></td>
      <td><input data-key="scale" value="${escapeHtml(existing.scale || 'NTS')}" maxlength="40" aria-label="Scale"></td>
      <td><input data-key="revision" value="${escapeHtml(existing.revision || '-')}" maxlength="20" aria-label="Revision"></td>
      <td><button type="button" class="remove-row" aria-label="Remove ${escapeHtml(file.name)}">×</button></td>
    </tr>`;
}

function renderRows(existingRows = []) {
  clearObjectUrls();
  rowsBody.innerHTML = selectedFiles
    .map((file, index) => rowTemplate(file, index, existingRows[index] || {}))
    .join('');
  const hasImages = selectedFiles.length > 0;
  sheetArea.hidden = !hasImages;
  emptyState.hidden = hasImages;
  generateButton.disabled = !hasImages;
  imageCount.textContent = `${selectedFiles.length} image${selectedFiles.length === 1 ? '' : 's'}`;
}

function collectSheets() {
  return [...rowsBody.querySelectorAll('tr')].map(row => {
    const values = {};
    row.querySelectorAll('input[data-key]').forEach(input => {
      values[input.dataset.key] = input.value.trim();
    });
    return values;
  });
}

function collectProjectConfig() {
  return Object.fromEntries(
    projectFieldIds.map(id => [id, document.querySelector(`#${id}`).value.trim()])
  );
}

function showMessage(text, type) {
  message.hidden = false;
  message.className = `message ${type}`;
  message.textContent = text;
  message.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function clearMessage() {
  message.hidden = true;
  message.textContent = '';
  message.className = 'message';
}

function validateClientSide() {
  if (!document.querySelector('#project_title').value.trim()) return 'Enter a project title.';
  if (!selectedFiles.length) return 'Select at least one image.';
  const sheets = collectSheets();
  const seen = new Set();
  for (let index = 0; index < sheets.length; index += 1) {
    if (!sheets[index].sheet_number) return `Row ${index + 1}: enter a sheet number.`;
    if (seen.has(sheets[index].sheet_number)) {
      return `Row ${index + 1}: sheet number ${sheets[index].sheet_number} is duplicated.`;
    }
    seen.add(sheets[index].sheet_number);
    if (!sheets[index].drawing_title_1) return `Row ${index + 1}: enter a primary title.`;
  }
  return null;
}

imagesInput.addEventListener('change', () => {
  selectedFiles = [...imagesInput.files].slice(0, 60);
  renderRows();
  clearMessage();
});

rowsBody.addEventListener('click', event => {
  const button = event.target.closest('.remove-row');
  if (!button) return;
  const row = button.closest('tr');
  const index = Number(row.dataset.index);
  const existing = collectSheets().filter((_, itemIndex) => itemIndex !== index);
  selectedFiles.splice(index, 1);
  renderRows(existing);
});

csvInput.addEventListener('change', async () => {
  const file = csvInput.files[0];
  if (!file) return;
  const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    showMessage('The CSV file does not contain any sheet rows.', 'error');
    return;
  }
  const headers = lines[0].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
  const parsed = lines.slice(1).map(line => {
    const cells = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
  if (!selectedFiles.length) {
    showMessage('Select images before importing a CSV register.', 'error');
    return;
  }
  renderRows(parsed);
  showMessage(`Imported ${Math.min(parsed.length, selectedFiles.length)} CSV row(s).`, 'success');
});

projectFieldIds.forEach(id => {
  document.querySelector(`#${id}`).addEventListener('change', saveSettings);
});

document.querySelector('#clear-settings').addEventListener('click', () => {
  localStorage.removeItem(settingsKey);
  projectFieldIds.forEach(id => { document.querySelector(`#${id}`).value = ''; });
  document.querySelector('#date').value = todayDisplay();
  document.querySelector('#sheet_prefix').value = 'F';
  document.querySelector('#drawing_status').value = 'FOR INFORMATION';
  showMessage('Saved browser details cleared.', 'success');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  const error = validateClientSide();
  if (error) {
    showMessage(error, 'error');
    return;
  }

  saveSettings();
  const data = new FormData();
  data.set('project_config', JSON.stringify(collectProjectConfig()));
  data.set('sheets', JSON.stringify(collectSheets()));
  selectedFiles.forEach(file => data.append('images', file, file.name));
  const logo = document.querySelector('#logo').files[0];
  const template = document.querySelector('#template').files[0];
  if (logo) data.set('logo', logo, logo.name);
  if (template) data.set('template', template, template.name);

  generateButton.disabled = true;
  generateButton.classList.add('is-loading');
  document.querySelector('.button-label').textContent = 'Generating…';

  try {
    const response = await fetch('/api/generate', {method: 'POST', body: data});
    if (!response.ok) {
      const payload = await response.json().catch(() => ({detail: 'Generation failed.'}));
      const detail = Array.isArray(payload.detail) ? payload.detail.join(' ') : payload.detail;
      throw new Error(detail || 'Generation failed.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const encodedMatch = disposition.match(/filename\*=utf-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = encodedMatch
      ? decodeURIComponent(encodedMatch[1])
      : (plainMatch ? plainMatch[1] : 'fieldwork-plan.pptx');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    showMessage(
      `Generated ${response.headers.get('x-fieldwork-slides') || selectedFiles.length} plan sheet(s).`,
      'success'
    );
  } catch (requestError) {
    showMessage(requestError.message, 'error');
  } finally {
    generateButton.disabled = selectedFiles.length === 0;
    generateButton.classList.remove('is-loading');
    document.querySelector('.button-label').textContent = 'Generate fieldwork plan';
  }
});

loadSettings();
