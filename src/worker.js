const GEOCODER = "https://nominatim.openstreetmap.org/search";
const CONTACT = "https://fieldwork-plan-generator.matthewraison.workers.dev";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
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
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

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

  const body = await upstream.text();
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/geocode") return geocode(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
