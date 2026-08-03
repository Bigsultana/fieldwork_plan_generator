import { defineConfig } from "vite";

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
    },
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
});
