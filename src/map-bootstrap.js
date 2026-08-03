const PRIMARY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const GEOCODE_PATH = "/api/geocode";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function normaliseOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return "https://example.invalid";
  }
}

export function createMapStyle(origin = globalThis.location?.origin) {
  const appOrigin = normaliseOrigin(origin || "https://example.invalid");
  return {
    version: 8,
    name: "Fieldwork Plan Generator basemap",
    sources: {
      basemap: {
        type: "raster",
        tiles: [`${appOrigin}/api/tiles/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export const FALLBACK_MAP_STYLE = Object.freeze(createMapStyle("https://example.invalid"));

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input?.url || "";
}

export function isPrimaryStyleRequest(input) {
  return requestUrl(input).replace(/\/$/, "") === PRIMARY_STYLE_URL;
}

export function isGeocodeRequest(input) {
  try {
    const url = new URL(requestUrl(input), globalThis.location?.origin || "https://example.invalid");
    return url.pathname === GEOCODE_PATH;
  } catch {
    return false;
  }
}

function mapStyleResponse() {
  return new Response(JSON.stringify(createMapStyle(window.location.origin)), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function directGeocode(originalFetch, input) {
  const submitted = new URL(requestUrl(input), window.location.origin);
  const query = String(submitted.searchParams.get("q") || "").trim();
  if (!query) return null;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "au");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("q", query);
  return originalFetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-AU,en",
    },
  });
}

function installFetchFallbacks() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    // MapLibre still requests the original style URL, but the returned style now
    // contains an absolute tile route on the current Cloudflare deployment.
    if (isPrimaryStyleRequest(input)) return mapStyleResponse();

    if (isGeocodeRequest(input)) {
      try {
        const response = await originalFetch(input, init);
        if (response.ok) return response;
      } catch {
        // Retry directly from the browser below.
      }
      const fallback = await directGeocode(originalFetch, input);
      if (fallback) return fallback;
    }
    return originalFetch(input, init);
  };
}

function installAutomaticBestMatch() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const attach = () => {
    const results = document.querySelector("#search-results");
    if (!results || results.dataset.autoCentreInstalled === "true") return;
    results.dataset.autoCentreInstalled = "true";
    let lastButton = null;
    const observer = new MutationObserver(() => {
      const first = results.querySelector("button.search-result");
      if (!first || first === lastButton) return;
      lastButton = first;
      queueMicrotask(() => first.click());
    });
    observer.observe(results, { childList: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
}

installFetchFallbacks();
installAutomaticBestMatch();
