import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "fieldwork-map-enhancements",
      transform(code, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/app.js")) return null;
        const next = code.replace(
          'from "./map-planner.js";',
          'from "./map-planner-enhanced.js";',
        );
        if (next === code) throw new Error("Map planner import was not found during the build.");
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
