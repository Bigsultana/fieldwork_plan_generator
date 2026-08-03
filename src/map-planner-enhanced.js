import { createMapPlanner as createBaseMapPlanner } from "./map-planner-v2.js";
import { enhanceMapPlanner } from "./map-enhancements-v2.js";

export function createMapPlanner(options = {}) {
  const planner = createBaseMapPlanner(options);
  return enhanceMapPlanner(planner, options);
}
