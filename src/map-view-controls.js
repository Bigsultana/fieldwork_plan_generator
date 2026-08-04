import "./map-view-controls.css";

function createGroup(html) {
  const group = document.createElement("div");
  group.className = "tool-group precision-map-controls";
  group.innerHTML = html;
  return group;
}

function zoomLabel(value) {
  return `Zoom ${Number(value).toFixed(2)}`;
}

export function enhanceMapViewControls(mapPlanner) {
  const map = mapPlanner?.map;
  const tools = document.querySelector(".map-tools");
  if (!map || !tools || tools.dataset.precisionView === "true") return mapPlanner;
  tools.dataset.precisionView = "true";

  map.options.zoomSnap = 0.05;
  map.options.zoomDelta = 0.25;
  map.options.wheelPxPerZoomLevel = 120;
  map.options.wheelDebounceTime = 30;

  const group = createGroup(`
    <h3>Precise map framing</h3>
    <div class="precision-zoom-row">
      <button id="precision-zoom-out" type="button" title="Zoom out by 0.25">−</button>
      <input id="precision-zoom-slider" type="range" min="1" max="20" step="0.05" value="${map.getZoom()}" />
      <output id="precision-zoom-value">${zoomLabel(map.getZoom())}</output>
    </div>
    <div class="precision-button-row">
      <button id="precision-zoom-out-small" type="button">−0.10</button>
      <button id="precision-zoom-reset" type="button">Round zoom</button>
      <button id="precision-zoom-in-small" type="button">+0.10</button>
    </div>
    <div class="precision-nudge-wrap">
      <div class="precision-nudge-grid" aria-label="Nudge map position">
        <button class="up" type="button" data-nudge-x="0" data-nudge-y="-1" title="Move map up">↑</button>
        <button class="left" type="button" data-nudge-x="-1" data-nudge-y="0" title="Move map left">←</button>
        <button class="centre" type="button" tabindex="-1" aria-hidden="true">•</button>
        <button class="right" type="button" data-nudge-x="1" data-nudge-y="0" title="Move map right">→</button>
        <button class="down" type="button" data-nudge-x="0" data-nudge-y="1" title="Move map down">↓</button>
      </div>
      <label>Nudge step
        <select id="precision-nudge-step">
          <option value="5">5 px</option>
          <option value="10" selected>10 px</option>
          <option value="25">25 px</option>
          <option value="50">50 px</option>
        </select>
      </label>
    </div>
    <small class="enhancement-note">Mouse-wheel and +/− zoom now use fractional steps. Use the arrows for exact positioning inside the blue A1 frame. Alt + arrow keys also nudges the map.</small>`);

  const backgroundGroup = [...tools.children].find((child) => child.textContent.includes("Background"));
  if (backgroundGroup) backgroundGroup.after(group);
  else tools.prepend(group);

  const slider = group.querySelector("#precision-zoom-slider");
  const output = group.querySelector("#precision-zoom-value");
  const nudgeStep = group.querySelector("#precision-nudge-step");

  function setZoom(value) {
    const next = Math.min(20, Math.max(1, Number(value)));
    map.setZoom(next, { animate: false });
  }

  function syncZoom() {
    const zoom = map.getZoom();
    slider.value = String(zoom);
    output.value = zoomLabel(zoom);
    output.textContent = zoomLabel(zoom);
  }

  slider.addEventListener("input", () => setZoom(slider.value));
  group.querySelector("#precision-zoom-out").addEventListener("click", () => setZoom(map.getZoom() - 0.25));
  group.querySelector("#precision-zoom-out-small").addEventListener("click", () => setZoom(map.getZoom() - 0.1));
  group.querySelector("#precision-zoom-in-small").addEventListener("click", () => setZoom(map.getZoom() + 0.1));
  group.querySelector("#precision-zoom-reset").addEventListener("click", () => setZoom(Math.round(map.getZoom())));

  group.querySelectorAll("[data-nudge-x]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(nudgeStep.value) || 10;
      const dx = Number(button.dataset.nudgeX) * step;
      const dy = Number(button.dataset.nudgeY) * step;
      map.panBy([dx, dy], { animate: false });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.defaultPrevented) return;
    const activeTag = document.activeElement?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
    const step = Number(nudgeStep.value) || 10;
    const directions = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    map.panBy(directions[event.key], { animate: false });
  });

  map.on("zoom zoomend", syncZoom);
  syncZoom();
  return mapPlanner;
}
