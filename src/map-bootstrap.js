const PRIMARY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const GEOCODE_PATH = "/api/geocode";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export const FALLBACK_MAP_STYLE = Object.freeze({
  version: 8,
  name: "OpenStreetMap standard",
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

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
  return new Response(JSON.stringify(FALLBACK_MAP_STYLE), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400",
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
    // Use a simple raster style with fewer external dependencies than the original
    // vector style. This avoids a blank map when style sprites or glyphs are blocked.
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
