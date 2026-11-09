import { createMapPlanner as createBaseMapPlanner } from "./map-planner-v2.js";
import { enhanceCoordinateImport } from "./map-coordinate-importer.js";
import { createMapWorkspace } from "./map-workspace.js";

export function createMapPlanner(options = {}) {
  const planner = createBaseMapPlanner(options);
  return createMapWorkspace(enhanceCoordinateImport(planner, options), options);
}
