import html2canvas from "html2canvas";
import { FIELDWORK_TYPES, MAP_CONTENT_RATIO } from "./map-model.js";
import { assignLabelOffsets } from "./map-point-layout.js";
import { normaliseExportStyle } from "./export-style.js";

function scaleNumber(value) {
  const match = String(value || "").match(/1\s*:\s*([\d,]+)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function distanceText(metres) {
  const value = Number(metres);
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  if (value >= 100) return `${Math.round(value)} m`;
  if (value >= 10) return `${Math.round(value)} m`;
  return `${value.toFixed(1)} m`;
}

function pointType(point) {
  return point.type || String(point.label || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
}

function usedDefinitions(points = []) {
  const seen = new Set();
  const definitions = [];
  points.forEach((point) => {
    const type = pointType(point);
    if (!type || seen.has(type) || !FIELDWORK_TYPES[type]) return;
    seen.add(type);
    definitions.push(FIELDWORK_TYPES[type]);
  });
  return definitions;
}

function twoFrames() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function haloText(context, text, x, y, options = {}) {
  context.save();
  context.font = options.font;
  context.textAlign = options.align || "left";
  context.textBaseline = options.baseline || "middle";
  context.lineJoin = "round";
  context.miterLimit = 2;
  context.strokeStyle = options.halo || "rgba(255,255,255,0.98)";
  context.lineWidth = options.haloWidth || 7;
  context.strokeText(String(text), x, y);
  context.fillStyle = options.fill || "#172033";
  context.fillText(String(text), x, y);
  context.restore();
}

function drawSymbol(context, definition, x, y, size, fontFamily) {
  haloText(context, definition.symbol, x, y, {
    font: `800 ${size}px ${fontFamily}, Arial, sans-serif`,
    align: "center",
    baseline: "middle",
    fill: `#${definition.color}`,
    haloWidth: Math.max(5, size * 0.15),
  });
}

function drawFieldworkPoints(context, mapPlanner, plan, frame, width, height, style) {
  const map = mapPlanner.map;
  const points = plan.points || [];
  if (!map || !points.length) return;
  const scaleX = width / frame.width;
  const scaleY = height / frame.height;
  const projected = (point) => {
    const pixel = map.latLngToContainerPoint([Number(point.latitude), Number(point.longitude)]);
    return { x: pixel.x - frame.left, y: pixel.y - frame.top };
  };
  const layout = assignLabelOffsets(points, projected);
  const symbolSize = Math.max(34, style.markerLabelSize * 1.9) * scaleX;
  const labelSize = style.markerLabelSize * scaleX;

  points.forEach((point) => {
    const type = pointType(point);
    const definition = FIELDWORK_TYPES[type];
    if (!definition) return;
    const pixel = projected(point);
    const x = pixel.x * scaleX;
    const y = pixel.y * scaleY;
    const offset = layout.offsets.get(point.id) || { x: 0, y: 24 };
    drawSymbol(context, definition, x, y, symbolSize, style.fontFamily);
    haloText(context, point.label, x + Number(offset.x) * scaleX, y + Number(offset.y) * scaleY, {
      font: `${style.markerLabelWeight} ${labelSize}px ${style.fontFamily}, Arial, sans-serif`,
      align: "center",
      baseline: "middle",
      fill: "#111827",
      haloWidth: Math.max(6, labelSize * 0.18),
    });
  });
}

function drawSingleScale(context, width, height, denominator, style) {
  if (!denominator) return;
  const padding = Math.round(width * 0.014);
  const barWidth = Math.round(width * 0.15);
  const segmentWidth = barWidth / 4;
  const barHeight = Math.max(14, Math.round(height * 0.014));
  const x = padding;
  const y = height - padding - barHeight;
  const fontSize = Math.max(18, Math.round(width * 0.0115));
  const totalMetres = denominator * 0.1;

  context.save();
  context.font = `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`;
  for (let index = 0; index < 4; index += 1) {
    context.fillStyle = index % 2 === 0 ? "#172033" : "#FFFFFF";
    context.strokeStyle = "#172033";
    context.lineWidth = Math.max(2, width / 1800);
    context.fillRect(x + index * segmentWidth, y, segmentWidth, barHeight);
    context.strokeRect(x + index * segmentWidth, y, segmentWidth, barHeight);
  }
  haloText(context, "0", x, y - fontSize * 0.32, {
    font: `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`,
    align: "left",
    baseline: "bottom",
    haloWidth: Math.max(5, fontSize * 0.22),
  });
  for (let index = 1; index <= 4; index += 1) {
    haloText(context, distanceText((totalMetres * index) / 4), x + segmentWidth * index, y - fontSize * 0.32, {
      font: `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`,
      align: "center",
      baseline: "bottom",
      haloWidth: Math.max(5, fontSize * 0.22),
    });
  }
  context.restore();
}

function drawMatchingLegend(context, width, height, points, style) {
  const definitions = usedDefinitions(points);
  if (!definitions.length) return;
  const padding = Math.round(width * 0.014);
  const fontSize = Math.max(18, Math.round((style.legendFontSize / 14) * width * 0.0115));
  const symbolSize = Math.round(fontSize * 1.7);
  const rowHeight = Math.max(symbolSize + 10, Math.round(height * 0.055));
  const textWidth = Math.round(width * 0.22);
  const x = width - textWidth - padding;
  const startY = height - padding - definitions.length * rowHeight + rowHeight / 2;

  definitions.forEach((definition, index) => {
    const cy = startY + index * rowHeight;
    drawSymbol(context, definition, x + symbolSize * 0.62, cy, symbolSize, style.fontFamily);
    haloText(context, `${definition.code} – ${definition.name}`, x + symbolSize * 1.25, cy, {
      font: `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`,
      align: "left",
      baseline: "middle",
      haloWidth: Math.max(5, fontSize * 0.2),
    });
  });
}

function drawNorthArrow(context, width, height, style) {
  const padding = Math.round(width * 0.014);
  const x = width - padding * 2.1;
  const y = padding * 2.5;
  const size = Math.round(width * 0.022);
  context.save();
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.strokeStyle = "#172033";
  context.lineWidth = Math.max(2, width / 1600);
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + size * 0.55, y + size * 0.65);
  context.lineTo(x, y + size * 0.25);
  context.lineTo(x - size * 0.55, y + size * 0.65);
  context.closePath();
  context.fill();
  context.stroke();
  haloText(context, "N", x, y - size * 1.35, {
    font: `800 ${Math.round(size * 0.8)}px ${style.fontFamily}, Arial, sans-serif`,
    align: "center",
    baseline: "middle",
    haloWidth: Math.max(4, size * 0.16),
  });
  context.restore();
}

function drawAttribution(context, width, height, plan, style) {
  const basemap = plan.layerSummary?.basemap;
  const text = basemap === "satellite"
    ? "Imagery © Esri and contributors"
    : basemap === "street"
      ? "© OpenStreetMap contributors"
      : "";
  if (!text) return;
  const size = Math.max(12, Math.round(width * 0.006));
  haloText(context, text, width - Math.round(width * 0.01), height - Math.round(height * 0.008), {
    font: `500 ${size}px ${style.fontFamily}, Arial, sans-serif`,
    align: "right",
    baseline: "bottom",
    fill: "#374151",
    haloWidth: Math.max(3, size * 0.18),
  });
}

async function captureCleanMap(mapPlanner, plan, style) {
  const map = mapPlanner.map;
  const mapElement = map?.getContainer?.() || document.querySelector("#site-map");
  const frameElement = document.querySelector("#map-print-frame");
  if (!mapElement || !frameElement) return plan.image;

  const mapRect = mapElement.getBoundingClientRect();
  const frameRect = frameElement.getBoundingClientRect();
  const frame = {
    left: frameRect.left - mapRect.left,
    top: frameRect.top - mapRect.top,
    width: frameRect.width,
    height: frameRect.height,
  };
  const statusElement = document.querySelector("#map-status");
  const controls = mapElement.querySelector(".leaflet-control-container");
  const previousPointVisibility = mapPlanner.getLayerState?.().points !== false;
  const previousStyles = [frameElement, statusElement, controls].map((element) => ({
    element,
    visibility: element?.style.visibility || "",
  }));

  try {
    map.closePopup?.();
    if (previousPointVisibility) mapPlanner.setPointVisibility?.(false);
    previousStyles.forEach(({ element }) => {
      if (element) element.style.visibility = "hidden";
    });
    await twoFrames();
    const captureScale = Math.min(4, Math.max(2, 2 * style.mapResolutionScale));
    const source = await html2canvas(mapElement, {
      backgroundColor: "#FFFFFF",
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 12000,
      scale: captureScale,
    });
    const sourceScaleX = source.width / mapElement.clientWidth;
    const sourceScaleY = source.height / mapElement.clientHeight;
    const sx = Math.max(0, Math.round(frame.left * sourceScaleX));
    const sy = Math.max(0, Math.round(frame.top * sourceScaleY));
    const sw = Math.min(source.width - sx, Math.round(frame.width * sourceScaleX));
    const sh = Math.min(source.height - sy, Math.round(frame.height * sourceScaleY));
    const width = Math.round(2400 * style.mapResolutionScale);
    const height = Math.round(width / MAP_CONTENT_RATIO);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

    if (previousPointVisibility) drawFieldworkPoints(context, mapPlanner, plan, frame, width, height, style);
    drawNorthArrow(context, width, height, style);
    drawSingleScale(context, width, height, scaleNumber(plan.sheet?.scale), style);
    drawMatchingLegend(context, width, height, previousPointVisibility ? plan.points : [], style);
    drawAttribution(context, width, height, plan, style);

    return {
      data: output.toDataURL("image/png"),
      width,
      height,
    };
  } finally {
    previousStyles.forEach(({ element, visibility }) => {
      if (element) element.style.visibility = visibility;
    });
    if (previousPointVisibility) mapPlanner.setPointVisibility?.(true);
  }
}

export function enhanceMapExportStyle(mapPlanner) {
  if (!mapPlanner || mapPlanner.__exportStyleEnhanced) return mapPlanner;
  mapPlanner.__exportStyleEnhanced = true;
  const baseCapture = mapPlanner.capturePlan.bind(mapPlanner);

  mapPlanner.capturePlan = async (requestedStyle = {}) => {
    const style = normaliseExportStyle(requestedStyle);
    const plan = await baseCapture();
    if (!plan?.image?.data) return plan;
    const image = await captureCleanMap(mapPlanner, plan, style);
    return {
      ...plan,
      exportStyle: style,
      image,
    };
  };

  return mapPlanner;
}
