import { FIELDWORK_TYPES } from "./map-model.js";
import { normaliseExportStyle } from "./export-style.js";

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare the styled map preview."));
    image.src = dataUrl;
  });
}

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

function usedDefinitions(points = []) {
  const seen = new Set();
  const definitions = [];
  points.forEach((point) => {
    const type = point.type || String(point.label || "").match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
    if (!type || seen.has(type) || !FIELDWORK_TYPES[type]) return;
    seen.add(type);
    definitions.push(FIELDWORK_TYPES[type]);
  });
  return definitions;
}

function drawSingleScale(context, width, height, denominator, style) {
  if (!denominator) return;
  const padding = Math.round(width * 0.014);
  const barWidth = Math.round(width * 0.15);
  const segmentWidth = barWidth / 4;
  const barHeight = Math.max(14, Math.round(height * 0.014));
  const x = padding;
  const y = height - padding - barHeight - Math.round(height * 0.018);
  const fontSize = Math.max(18, Math.round(width * 0.0115));
  const totalMetres = denominator * 0.1;

  context.save();
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.strokeStyle = "rgba(23,32,51,0.62)";
  context.lineWidth = 2;
  context.fillRect(x - 10, y - fontSize - 11, barWidth + 20, barHeight + fontSize + 23);
  context.strokeRect(x - 10, y - fontSize - 11, barWidth + 20, barHeight + fontSize + 23);
  context.font = `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`;
  context.textBaseline = "bottom";
  context.textAlign = "left";
  context.fillStyle = "#172033";
  context.fillText("0", x, y - 5);

  for (let index = 0; index < 4; index += 1) {
    context.fillStyle = index % 2 === 0 ? "#172033" : "#FFFFFF";
    context.strokeStyle = "#172033";
    context.fillRect(x + index * segmentWidth, y, segmentWidth, barHeight);
    context.strokeRect(x + index * segmentWidth, y, segmentWidth, barHeight);
  }

  context.fillStyle = "#172033";
  context.textAlign = "center";
  for (let index = 1; index <= 4; index += 1) {
    context.fillText(distanceText((totalMetres * index) / 4), x + segmentWidth * index, y - 5);
  }
  context.restore();
}

function drawMatchingLegend(context, width, height, points, style) {
  const definitions = usedDefinitions(points);
  if (!definitions.length) return;

  const padding = Math.round(width * 0.014);
  const fontSize = Math.max(18, Math.round((style.legendFontSize / 14) * width * 0.0115));
  const symbolSize = Math.round(fontSize * 1.65);
  const rowHeight = Math.max(symbolSize + 10, Math.round(height * 0.055));
  const boxWidth = Math.round(width * 0.235);
  const boxHeight = definitions.length * rowHeight + padding * 1.35;
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;

  context.save();
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.strokeStyle = "rgba(23,32,51,0.62)";
  context.lineWidth = 2;
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeRect(x, y, boxWidth, boxHeight);
  context.textBaseline = "middle";

  definitions.forEach((definition, index) => {
    const cy = y + padding * 0.65 + rowHeight * (index + 0.5);
    context.font = `800 ${symbolSize}px ${style.fontFamily}, Arial, sans-serif`;
    context.fillStyle = `#${definition.color}`;
    context.textAlign = "center";
    context.fillText(definition.symbol, x + padding * 1.45, cy);
    context.font = `700 ${fontSize}px ${style.fontFamily}, Arial, sans-serif`;
    context.fillStyle = "#172033";
    context.textAlign = "left";
    context.fillText(`${definition.code} – ${definition.name}`, x + padding * 2.45, cy);
  });
  context.restore();
}

async function restyleMapImage(plan, settings) {
  if (!plan?.image?.data) return plan;
  const source = await loadImage(plan.image.data);
  const canvas = document.createElement("canvas");
  canvas.width = source.naturalWidth || plan.image.width;
  canvas.height = source.naturalHeight || plan.image.height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const padding = Math.round(canvas.width * 0.012);
  const legacyScaleWidth = Math.round(canvas.width * 0.22);
  const legacyScaleHeight = Math.round(canvas.height * 0.13);
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.fillRect(0, canvas.height - legacyScaleHeight, legacyScaleWidth, legacyScaleHeight);

  const definitions = usedDefinitions(plan.points);
  if (definitions.length) {
    const legacyLegendWidth = Math.round(canvas.width * 0.25);
    const legacyLegendHeight = Math.min(
      Math.round(canvas.height * 0.48),
      definitions.length * Math.round(canvas.height * 0.065) + padding * 2,
    );
    context.fillRect(
      canvas.width - legacyLegendWidth,
      canvas.height - legacyLegendHeight,
      legacyLegendWidth,
      legacyLegendHeight,
    );
  }

  drawSingleScale(context, canvas.width, canvas.height, scaleNumber(plan.sheet?.scale), settings);
  drawMatchingLegend(context, canvas.width, canvas.height, plan.points, settings);

  return {
    ...plan,
    exportStyle: settings,
    image: {
      data: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    },
  };
}

export function enhanceMapExportStyle(mapPlanner) {
  if (!mapPlanner || mapPlanner.__exportStyleEnhanced) return mapPlanner;
  mapPlanner.__exportStyleEnhanced = true;
  const baseCapture = mapPlanner.capturePlan.bind(mapPlanner);

  mapPlanner.capturePlan = async (requestedStyle = {}) => {
    const style = normaliseExportStyle(requestedStyle);
    const mapElement = document.querySelector("#site-map");
    const previous = {
      family: mapElement?.style.getPropertyValue("--export-label-font"),
      size: mapElement?.style.getPropertyValue("--export-label-size"),
      weight: mapElement?.style.getPropertyValue("--export-label-weight"),
    };
    mapElement?.style.setProperty("--export-label-font", style.fontFamily);
    mapElement?.style.setProperty("--export-label-size", `${style.markerLabelSize}px`);
    mapElement?.style.setProperty("--export-label-weight", String(style.markerLabelWeight));

    try {
      const plan = await baseCapture();
      return await restyleMapImage(plan, style);
    } finally {
      if (mapElement) {
        if (previous.family) mapElement.style.setProperty("--export-label-font", previous.family);
        else mapElement.style.removeProperty("--export-label-font");
        if (previous.size) mapElement.style.setProperty("--export-label-size", previous.size);
        else mapElement.style.removeProperty("--export-label-size");
        if (previous.weight) mapElement.style.setProperty("--export-label-weight", previous.weight);
        else mapElement.style.removeProperty("--export-label-weight");
      }
    }
  };

  return mapPlanner;
}
