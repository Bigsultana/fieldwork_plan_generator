import { createMapPlanner as createBaseMapPlanner } from "./map-planner.js";
import { enhanceMapPlanner } from "./map-enhancements.js";

export function createMapPlanner(options = {}) {
  const planner = createBaseMapPlanner(options);
  return enhanceMapPlanner(planner, options);
}
