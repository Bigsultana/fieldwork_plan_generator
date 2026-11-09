import L from "leaflet";

// Render only visible tiles from the original image; zooming never depends on
// the basemap's native zoom or a reduced-resolution overview.
export function createPlanRasterLayer(entry, placement, pane) {
  const Raster = L.GridLayer.extend({
    createTile(coords) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d");
      const at = (x, y) => {
        const ll = this._map.unproject([coords.x * 256 + x, coords.y * 256 + y], coords.z);
        const p = L.CRS.EPSG3857.project(ll);
        return placement.toPixel([p.x, p.y]);
      };
      function triangle(source, target) {
        const [s0, s1, s2] = source;
        const [t0, t1, t2] = target;
        const sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1];
        const sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1];
        const det = sx1 * sy2 - sx2 * sy1;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-15) return;
        if (Math.max(...source.map((p) => p[0])) < 0 || Math.min(...source.map((p) => p[0])) > entry.width ||
            Math.max(...source.map((p) => p[1])) < 0 || Math.min(...source.map((p) => p[1])) > entry.height) return;
        const tx1 = t1[0] - t0[0], ty1 = t1[1] - t0[1];
        const tx2 = t2[0] - t0[0], ty2 = t2[1] - t0[1];
        const a = (tx1 * sy2 - tx2 * sy1) / det;
        const b = (ty1 * sy2 - ty2 * sy1) / det;
        const c = (tx2 * sx1 - tx1 * sx2) / det;
        const d = (ty2 * sx1 - ty1 * sx2) / det;
        context.save();
        context.beginPath();
        context.moveTo(...t0); context.lineTo(...t1); context.lineTo(...t2); context.closePath();
        context.clip();
        context.setTransform(a, b, c, d, t0[0] - a * s0[0] - c * s0[1], t0[1] - b * s0[0] - d * s0[1]);
        if (entry.cropBounds) {
          const { left, top, width, height } = entry.cropBounds;
          context.drawImage(entry.image, left, top, width, height, left, top, width, height);
        } else context.drawImage(entry.image, 0, 0);
        context.restore();
      }
      // Reproject a mesh rather than stretching a geographic bounding box.
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        const target = [[x, y], [x + 64, y], [x + 64, y + 64], [x, y + 64]];
        const source = target.map(([px, py]) => at(px, py));
        triangle([source[0], source[1], source[2]], [target[0], target[1], target[2]]);
        triangle([source[0], source[2], source[3]], [target[0], target[2], target[3]]);
      }
      return canvas;
    },
  });
  const bounds = L.latLngBounds(placement.corners.map(([x, y]) => L.CRS.EPSG3857.unproject(L.point(x, y))));
  return new Raster({ pane, tileSize: 256, bounds, noWrap: true, minZoom: 0, maxZoom: 26, keepBuffer: 1,
    opacity: entry.opacity ?? 1, updateWhenIdle: true });
}
