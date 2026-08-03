import { createMapPlanner as createBaseMapPlanner } from "./map-planner-v2.js";
import { enhanceMapPlanner } from "./map-enhancements.js";
import { enhanceMapLayers } from "./map-layer-upgrade.js";

export function createMapPlanner(options = {}) {
  const planner = createBaseMapPlanner(options);
  const withOverlays = enhanceMapPlanner(planner, options);
  return enhanceMapLayers(withOverlays, options);
}
