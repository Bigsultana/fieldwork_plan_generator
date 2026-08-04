const GEOCODER = "https://nominatim.openstreetmap.org/search";
const CONTACT = "https://fieldwork-plan-generator.matthewraison.workers.dev";
const TILE_PATH = /^\/api\/tiles\/(?:(street|satellite)\/)?(\d{1,2})\/(\d+)\/(\d+)\.(?:png|jpe?g)$/;

const TILE_SOURCES = {
  street: [
    (tile) => `https://basemaps.cartocdn.com/light_all/${tile.zoom}/${tile.x}/${tile.y}.png`,
    (tile) => `https://tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png`,
  ],
  satellite: [
    (tile) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.zoom}/${tile.y}/${tile.x}`,
    (tile) => `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.zoom}/${tile.y}/${tile.x}`,
  ],
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function cachedResponse(cacheKey, producer, ctx) {
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const response = await producer();
  if (response.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function geocode(request, ctx) {
  const requestUrl = new URL(request.url);
  const query = String(requestUrl.searchParams.get("q") || "").trim();
  if (query.length < 3 || query.length > 200) {
    return json({ error: "Enter between 3 and 200 characters." }, 400);
  }

  const cacheUrl = new URL(requestUrl.origin + "/api/geocode");
  cacheUrl.searchParams.set("q", query.toLowerCase());
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

  return cachedResponse(
    cacheKey,
    async () => {
      const upstreamUrl = new URL(GEOCODER);
      upstreamUrl.searchParams.set("format", "jsonv2");
      upstreamUrl.searchParams.set("limit", "5");
      upstreamUrl.searchParams.set("countrycodes", "au");
      upstreamUrl.searchParams.set("addressdetails", "0");
      upstreamUrl.searchParams.set("q", query);

      const upstream = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-AU,en",
          "User-Agent": `FieldworkPlanGenerator/2.2 (+${CONTACT})`,
        },
      });
      if (!upstream.ok) return json({ error: `Geocoder returned ${upstream.status}.` }, 502);

      return new Response(await upstream.text(), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=86400",
        },
      });
    },
    ctx,
  );
}

export function parseTilePath(pathname) {
  const match = TILE_PATH.exec(pathname);
  if (!match) return null;
  const source = match[1] || "street";
  const zoom = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  const tileCount = 2 ** zoom;
  if (!TILE_SOURCES[source] || zoom < 0 || zoom > 19 || x < 0 || y < 0 || x >= tileCount || y >= tileCount) return null;
  return { source, zoom, x, y };
}

async function fetchTile(upstreamUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
        "User-Agent": `FieldworkPlanGenerator/2.2 (+${CONTACT})`,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function mapTile(request, ctx, tile) {
  const requestUrl = new URL(request.url);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
  return cachedResponse(
    cacheKey,
    async () => {
      for (const buildUrl of TILE_SOURCES[tile.source]) {
        const upstreamUrl = buildUrl(tile);
        try {
          const upstream = await fetchTile(upstreamUrl);
          if (!upstream.ok) continue;
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type": upstream.headers.get("content-type") || (tile.source === "satellite" ? "image/jpeg" : "image/png"),
              "cache-control": "public, max-age=604800, stale-while-revalidate=86400",
              "access-control-allow-origin": "*",
              "x-fieldwork-tile-source": new URL(upstreamUrl).hostname,
              "x-fieldwork-basemap": tile.source,
            },
          });
        } catch {
          // Try the next configured source.
        }
      }
      return new Response("Map tile unavailable", { status: 502, headers: { "cache-control": "no-store" } });
    },
    ctx,
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/geocode") return geocode(request, ctx);
    const tile = parseTilePath(url.pathname);
    if (tile) return mapTile(request, ctx, tile);
    return env.ASSETS.fetch(request);
  },
};
