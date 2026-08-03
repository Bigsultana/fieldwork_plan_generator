import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "fieldwork-runtime-enhancements",
      transform(code, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/app.js")) return null;
        let next = code.replace(
          'from "./map-planner.js";',
          'from "./map-planner-enhanced.js";',
        );
        next = next.replace(
          'from "./presentation.js";',
          'from "./presentation-enhanced.js";',
        );
        if (!next.includes('from "./map-planner-enhanced.js";')) {
          throw new Error("Map planner import was not found during the build.");
        }
        if (!next.includes('from "./presentation-enhanced.js";')) {
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
