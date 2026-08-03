const GEOCODER = "https://nominatim.openstreetmap.org/search";
const TILE_SERVER = "https://tile.openstreetmap.org";
const CONTACT = "https://fieldwork-plan-generator.matthewraison.workers.dev";
const TILE_PATH = /^\/api\/tiles\/(\d{1,2})\/(\d+)\/(\d+)\.png$/;

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
          "User-Agent": `FieldworkPlanGenerator/2.1 (+${CONTACT})`,
        },
      });
      if (!upstream.ok) {
        return json({ error: `Geocoder returned ${upstream.status}.` }, 502);
      }

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
  const zoom = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const tileCount = 2 ** zoom;
  if (zoom < 0 || zoom > 19 || x < 0 || y < 0 || x >= tileCount || y >= tileCount) return null;
  return { zoom, x, y };
}

async function mapTile(request, ctx, tile) {
  const requestUrl = new URL(request.url);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
  return cachedResponse(
    cacheKey,
    async () => {
      const upstreamUrl = `${TILE_SERVER}/${tile.zoom}/${tile.x}/${tile.y}.png`;
      const upstream = await fetch(upstreamUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
          "User-Agent": `FieldworkPlanGenerator/2.1 (+${CONTACT})`,
        },
      });
      if (!upstream.ok) {
        return new Response("Map tile unavailable", { status: upstream.status === 404 ? 404 : 502 });
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "content-type": upstream.headers.get("content-type") || "image/png",
          "cache-control": "public, max-age=604800, stale-while-revalidate=86400",
          "access-control-allow-origin": "*",
        },
      });
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
