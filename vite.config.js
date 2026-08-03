import { defineConfig } from "vite";

const inlineMapStyle = `const MAP_STYLE = {
  version: 8,
  name: "Fieldwork Plan Generator basemap",
  sources: {
    basemap: {
      type: "raster",
      tiles: [\`${"${window.location.origin}"}/api/tiles/{z}/{x}/{y}.png\`],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap", minzoom: 0, maxzoom: 22 }],
};`;

export default defineConfig({
  plugins: [
    {
      name: "fieldwork-map-bootstrap",
      transformIndexHtml(html) {
        return html.replace(
          '<script type="module" src="/src/app.js"></script>',
          '<script type="module" src="/src/map-bootstrap.js"></script>\n    <script type="module" src="/src/app.js"></script>',
        );
      },
      transform(code, id) {
        if (!id.replaceAll("\\", "/").endsWith("/src/map-planner.js")) return null;
        const next = code.replace(
          'const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";',
          inlineMapStyle,
        );
        if (next === code) throw new Error("Map style declaration was not found during the build.");
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
