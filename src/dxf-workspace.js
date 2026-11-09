import L from "leaflet";
import { dxfComponents, dxfScopeMatches, dxfComponentAppearance } from "./model.js";
import { workspaceElement as node, workspaceButton as button } from "./workspace-controls.js";

const PAGE_SIZE = 40;

function itemName(item) {
  return item.category === "text" ? `${item.entityType}: ${item.text}` : `${item.entityType} · #${item.handle || item.id}`;
}

export function createDxfWorkspace(entry, { map, onSelect, onChange, onPick, notice, fitBounds }) {
  let components = [], groups = new Map(), rendered = new Map();
  let selection = null, picking = false, highlightHidden = false;
  const undo = [];
  const ui = { open: true, query: "", layers: new Set(), categories: new Set(), pages: new Map() };
  entry.layerStyles = new Map();
  entry.textVisible = true;
  entry.textSize = 11;
  const pane = map.getPane(entry.pane);
  pane.classList.add("dxf-plan-pane");
  if (!map.getPane("dxfSelectionPane")) {
    const highlightPane = map.createPane("dxfSelectionPane");
    highlightPane.style.zIndex = "630";
    highlightPane.style.pointerEvents = "none";
  }
  const highlight = L.layerGroup().addTo(map);

  const selectedItems = () => components.filter((item) => dxfScopeMatches(item, selection || {}));
  function layerSettings(name) {
    if (!entry.layerStyles.has(name)) entry.layerStyles.set(name, {});
    return entry.layerStyles.get(name);
  }
  function scopeSettings() {
    if (selection.id != null) return components.find((item) => item.id === selection.id).style;
    const settings = layerSettings(selection.layer);
    if (!selection.category) return settings;
    return settings[selection.category] ||= {};
  }
  function scopeTitle() {
    if (selection?.id != null) return itemName(components.find((item) => item.id === selection.id));
    return selection ? `${selection.layer}${selection.category ? ` / ${selection.category === "text" ? "Text" : "Geometry"}` : ""}` : entry.name;
  }
  function updateHighlight() {
    highlight.clearLayers();
    if (highlightHidden || selection?.id == null) return;
    const item = components.find((part) => part.id === selection.id);
    if (!item || !dxfComponentAppearance(item, entry).visible) return;
    const options = { color: "#00a6d6", weight: 6, opacity: .65, fill: false, interactive: false, pane: "dxfSelectionPane" };
    if (item.coordinate) L.circleMarker([item.coordinate[1], item.coordinate[0]], { ...options, radius: 10 }).addTo(highlight);
    else L.polyline(item.coordinates.map(([x,y]) => [y,x]), options).addTo(highlight);
  }
  function refresh(items = components) {
    for (const item of items) {
      const layer = rendered.get(item.id);
      const appearance = dxfComponentAppearance(item, entry);
      if (!appearance.visible) { entry.layer.removeLayer(layer); continue; }
      if (!entry.layer.hasLayer(layer)) entry.layer.addLayer(layer);
      if (item.category === "text") {
        const text = layer.getElement()?.querySelector(".workspace-dxf-label") || layer.options.icon.options.html;
        text.style.color = appearance.color;
        text.style.fontSize = `${appearance.textSize}px`;
      } else layer.setStyle({ color: appearance.color, fillColor: appearance.color, weight: appearance.weight });
    }
    updateHighlight();
  }
  function select(scope, fromMap = false) {
    selection = scope;
    if (scope?.id != null) {
      const item = components.find((part) => part.id === scope.id);
      ui.open = true; ui.layers.add(item.layer); ui.categories.add(`${item.layer}\0${item.category}`);
      if (fromMap) ui.query = "";
      const siblings = groups.get(item.layer).filter((part) => !part.deleted && part.category === item.category && matchesQuery(part));
      ui.pages.set(`${item.layer}\0${item.category}`, Math.floor(siblings.indexOf(item) / PAGE_SIZE));
    }
    updateHighlight(); onSelect();
  }
  function install(parsed) {
    if (entry.layer) map.removeLayer(entry.layer);
    components = dxfComponents(parsed, components);
    groups = new Map(); rendered = new Map();
    entry.layer = L.layerGroup();
    for (const item of components) {
      if (!groups.has(item.layer)) groups.set(item.layer, []);
      groups.get(item.layer).push(item);
      const options = { pane: entry.pane, interactive: true, bubblingMouseEvents: false, fill: false };
      let layer;
      if (item.category === "text") {
        const text = node("span", "workspace-dxf-label", item.text);
        layer = L.marker([item.coordinate[1], item.coordinate[0]], { ...options, keyboard: false,
          icon: L.divIcon({ className: "dxf-text-marker", html: text, iconSize: null }) });
      } else if (item.kind === "point") layer = L.circleMarker([item.coordinate[1], item.coordinate[0]], { ...options, radius: 3 });
      else layer = L.polyline(item.coordinates.map(([x,y]) => [y,x]), options);
      layer.on("click", (event) => {
        if (!picking) return;
        L.DomEvent.stop(event.originalEvent);
        select({ id: item.id }, true);
      });
      rendered.set(item.id, layer);
    }
    refresh();
    if (entry.visible) entry.layer.addTo(map);
  }
  function matchesQuery(item) {
    return !ui.query || `${item.layer} ${item.entityType} ${item.handle} ${item.id} ${item.text || ""}`.toLowerCase().includes(ui.query.toLowerCase());
  }
  function checkbox(label, checked, change) {
    const input = node("input"); input.type = "checkbox"; input.checked = checked;
    input.setAttribute("aria-label", label); input.addEventListener("change", () => change(input.checked));
    return input;
  }
  function branch(label, open, toggle) {
    const details = node("details", "dxf-branch"); details.open = open;
    details.append(node("summary", "", label));
    details.addEventListener("toggle", () => toggle(details.open));
    return details;
  }
  function renderTree() {
    const activeCount = components.filter((item) => !item.deleted).length;
    const tree = branch(`CAD layers & parts (${activeCount.toLocaleString()})`, ui.open, (open) => { ui.open = open; });
    tree.classList.add("dxf-tree");
    tree.addEventListener("dragstart", (event) => { event.preventDefault(); event.stopPropagation(); });
    const search = node("input", "dxf-search"); search.type = "search"; search.placeholder = "Find layer, text or entity…";
    search.setAttribute("aria-label", `Find parts in ${entry.name}`); search.value = ui.query;
    search.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
    const content = node("div", "dxf-tree-content");
    tree.append(search, content);
    function draw() {
      content.replaceChildren();
      let matches = 0;
      for (const [name, all] of groups) {
        const items = all.filter((item) => !item.deleted && matchesQuery(item));
        if (!items.length) continue;
        matches += items.length;
        const settings = layerSettings(name);
        const layerBranch = branch(`${name} (${items.length.toLocaleString()})`, Boolean(ui.query) || ui.layers.has(name), (open) => {
          if (open) ui.layers.add(name); else ui.layers.delete(name);
        });
        const layerRow = node("div", "dxf-tree-row");
        const selectLayer = button("Layer settings", () => select({ layer: name }));
        selectLayer.setAttribute("aria-label", `Edit CAD layer ${name}`);
        layerRow.append(checkbox(`Show CAD layer ${name}`, settings.visible !== false, (value) => {
          settings.visible = value; refresh(all); onChange();
        }), selectLayer);
        layerBranch.append(layerRow);
        for (const category of ["geometry", "text"]) {
          const parts = items.filter((item) => item.category === category);
          if (!parts.length) continue;
          const key = `${name}\0${category}`, title = category === "text" ? "Text" : "Geometry";
          const categorySettings = settings[category] ||= {};
          const categoryBranch = branch(`${title} (${parts.length.toLocaleString()})`, Boolean(ui.query) || ui.categories.has(key), (open) => {
            if (open) ui.categories.add(key); else ui.categories.delete(key);
          });
          const categoryRow = node("div", "dxf-tree-row");
          const selectCategory = button(`${title} settings`, () => select({ layer: name, category }));
          selectCategory.setAttribute("aria-label", `Edit ${category} on ${name}`);
          categoryRow.append(checkbox(`Show ${category} on ${name}`, categorySettings.visible !== false, (value) => {
            categorySettings.visible = value; refresh(all); onChange();
          }), selectCategory);
          categoryBranch.append(categoryRow);
          const partList = node("div", "dxf-parts"); categoryBranch.append(partList);
          let populated = false;
          function drawPage() {
            populated = true; partList.replaceChildren();
            const page = Math.max(0, Math.min(ui.pages.get(key) || 0, Math.ceil(parts.length / PAGE_SIZE) - 1));
            ui.pages.set(key, page);
            for (const item of parts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
              const row = node("div", `dxf-tree-row dxf-part${selection?.id === item.id ? " selected" : ""}`);
              const name = itemName(item), choose = button(name, () => select({ id: item.id }));
              choose.className = "dxf-part-name"; choose.title = name;
              choose.setAttribute("aria-pressed", String(selection?.id === item.id));
              row.append(checkbox(`Show ${name}`, item.visible, (value) => { item.visible = value; refresh([item]); onChange(); }), choose);
              partList.append(row);
            }
            if (parts.length > PAGE_SIZE) {
              const paging = node("div", "dxf-paging");
              const previous = button("‹", () => { ui.pages.set(key, page - 1); drawPage(); }, `Previous ${category} on ${name}`);
              const next = button("›", () => { ui.pages.set(key, page + 1); drawPage(); }, `Next ${category} on ${name}`);
              previous.disabled = page === 0; next.disabled = (page + 1) * PAGE_SIZE >= parts.length;
              paging.append(previous, node("small", "", `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, parts.length)} / ${parts.length.toLocaleString()}`), next);
              partList.append(paging);
            }
          }
          // Thousands of TIN faces should not create thousands of DOM rows.
          categoryBranch.addEventListener("toggle", () => { if (categoryBranch.open && !populated) drawPage(); });
          if (categoryBranch.open) drawPage();
          layerBranch.append(categoryBranch);
        }
        content.append(layerBranch);
      }
      if (!matches) content.append(node("p", "workspace-help", activeCount ? "No matching parts." : "All components deleted. Use Undo delete to restore them."));
    }
    search.addEventListener("input", () => { ui.query = search.value; ui.pages.clear(); draw(); });
    draw(); return tree;
  }
  function addStyleControls(container, target, items, categories, parent = false) {
    const sample = items[0] ? dxfComponentAppearance(items[0], entry) : entry;
    const colourLabel = node("label", "", "Colour"), colour = node("input");
    colour.type = "color"; colour.value = target.color || sample.color;
    colour.addEventListener("input", () => { target.color = colour.value; refresh(items); });
    colourLabel.append(colour); container.append(colourLabel);
    if (categories.has("geometry")) {
      const label = node("label", "", "Line width"), width = node("input");
      width.type = "range"; width.min = ".5"; width.max = "8"; width.step = ".5"; width.value = target.weight || sample.weight;
      width.setAttribute("aria-label", "Line width");
      width.addEventListener("input", () => { target.weight = Number(width.value); refresh(items); });
      label.append(width); container.append(label);
    }
    if (categories.has("text")) {
      const label = node("label", "", "Text size (px)"), size = node("input");
      size.type = "number"; size.min = "6"; size.max = "72"; size.step = "1"; size.value = target.textSize || sample.textSize;
      size.addEventListener("change", () => {
        if (!size.checkValidity() || !size.value) { size.reportValidity(); return; }
        target.textSize = Number(size.value); refresh(items);
      });
      label.append(size); container.append(label);
    }
    if (parent) container.append(node("p", "workspace-help", "Styles apply to parts that inherit them. Individual overrides are retained."));
    else container.append(button("Use parent style", () => {
      delete target.color; delete target.weight; delete target.textSize; refresh(items); onChange();
    }));
  }
  function renderProperties(container) {
    const items = selectedItems().filter((item) => !item.deleted);
    if (selection) {
      container.append(button("Whole DXF", () => select(null)));
      container.append(node("strong", "dxf-selection-title", scopeTitle()));
      container.append(node("p", "workspace-help", `${items.length.toLocaleString()} selected · ${items.filter((item) => dxfComponentAppearance(item, entry).visible).length.toLocaleString()} visible`));
      const target = scopeSettings();
      const visibilityTarget = selection.id != null ? items[0] : target;
      const label = node("label", "inline-check", "Show selected");
      label.prepend(checkbox("Show selected", visibilityTarget.visible !== false, (value) => {
        visibilityTarget.visible = value; refresh(items); onChange();
      })); container.append(label);
      addStyleControls(container, target, items, new Set(items.map((item) => item.category)), selection.id == null);
      container.append(button("Zoom to selection", () => {
        const coordinates = items.flatMap((item) => item.coordinates || [item.coordinate]);
        if (coordinates.length) fitBounds(L.latLngBounds(coordinates.map(([x,y]) => [y,x])));
      }));
      if (items.some((item) => !dxfComponentAppearance(item, entry).visible) && visibilityTarget.visible !== false) {
        container.append(node("p", "workspace-help", "Hidden parts may also be disabled by their parent layer, geometry/text group or All text setting."));
      }
    } else {
      addStyleControls(container, entry, components, new Set(components.map((item) => item.category)), true);
      const label = node("label", "inline-check", "All text");
      label.prepend(checkbox("All text", entry.textVisible, (value) => { entry.textVisible = value; refresh(); onChange(); })); container.append(label);
    }
    const pick = button(picking ? "Finish selecting parts" : "Select parts on map", () => onPick(!picking));
    pick.setAttribute("aria-pressed", String(picking)); container.append(pick);
    if (undo.length) container.append(button("Undo delete", () => {
      const ids = new Set(undo.pop());
      for (const item of components) if (ids.has(item.id)) item.deleted = false;
      refresh(); onChange(); notice(`${ids.size.toLocaleString()} DXF components restored.`);
    }));
  }
  return {
    install, refresh, renderTree, renderProperties,
    selectFile: () => { selection = null; updateHighlight(); },
    hasSelection: () => Boolean(selection),
    selectionTitle: scopeTitle,
    setPicking(value) {
      picking = value;
      pane.style.pointerEvents = value ? "auto" : "none";
      pane.classList.toggle("dxf-picking", value);
    },
    deleteSelection() {
      if (!selection) return;
      const items = selectedItems().filter((item) => !item.deleted);
      if (!items.length) return;
      undo.push(items.map((item) => item.id)); items.forEach((item) => { item.deleted = true; });
      selection = null; refresh(items); onChange(); notice(`${items.length.toLocaleString()} DXF components deleted. Undo delete restores them.`);
    },
    hideHighlight(value) {
      highlightHidden = value;
      // Hide the renderer as well: a canvas redraw may still be queued when
      // the export clones the map, even after its selection layers are removed.
      map.getPane("dxfSelectionPane").style.visibility = value ? "hidden" : "";
      updateHighlight();
    },
    destroy() { highlight.clearLayers(); map.removeLayer(highlight); pane.classList.remove("dxf-picking"); },
  };
}
