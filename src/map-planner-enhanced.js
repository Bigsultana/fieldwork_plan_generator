import { createMapPlanner as createBaseMapPlanner } from "./map-planner-v2.js";
import { enhanceMapPlanner } from "./map-enhancements.js";
import { enhanceMapLayers } from "./map-layer-upgrade.js";
import { enhanceMapViewControls } from "./map-view-controls.js";
import { enhanceCoordinateImport } from "./map-coordinate-importer.js";
import { organiseMapTools } from "./map-tool-organizer.js";

export function createMapPlanner(options = {}) {
  const planner = createBaseMapPlanner(options);
  const withOverlays = enhanceMapPlanner(planner, options);
  const withLayers = enhanceMapLayers(withOverlays, options);
  const withViewControls = enhanceMapViewControls(withLayers, options);
  const withCoordinateImport = enhanceCoordinateImport(withViewControls, options);
  return organiseMapTools(withCoordinateImport, options);
}
