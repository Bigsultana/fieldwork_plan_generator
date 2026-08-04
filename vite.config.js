import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "fieldwork-runtime-enhancements",
      transform(code, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/app.js")) return null;
        let next = code.replace(
          'from "./model.js";',
          'from "./model-final.js";',
        );
        next = next.replace(
          'from "./map-planner.js";',
          'from "./map-planner-enhanced.js";',
        );
        next = next.replace(
          'from "./presentation.js";',
          'from "./presentation-final.js";',
        );
        if (!next.includes('from "./model-final.js";')) {
          throw new Error("Project model import was not found during the build.");
        }
        if (!next.includes('from "./map-planner-enhanced.js";')) {
          throw new Error("Map planner import was not found during the build.");
        }
        if (!next.includes('from "./presentation-final.js";')) {
          throw new Error("Presentation import was not found during the build.");
        }
        return { code: next, map: null };
      },
    },
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
});
