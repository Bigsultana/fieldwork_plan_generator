function createSection(title, description, open = false) {
  const details = document.createElement("details");
  details.className = "map-tool-section";
  details.open = open;
  details.innerHTML = `<summary><span>${title}</span><small>${description}</small></summary><div class="map-tool-section-body"></div>`;
  return details;
}

function heading(group) {
  return String(group.querySelector("h3")?.textContent || "").trim().toLowerCase();
}

function matches(group, phrases) {
  const title = heading(group);
  return phrases.some((phrase) => title.includes(phrase));
}

function addImportGuide(body) {
  const guide = document.createElement("div");
  guide.className = "import-format-guide";
  guide.innerHTML = `
    <strong>Choose the source that matches the data:</strong>
    <span><b>Image + world file</b> — Nearmap, MetroMap or plan image with .jgw/.pgw/.wld.</span>
    <span><b>GeoTIFF</b> — one raster file with embedded or selected coordinates.</span>
    <span><b>DXF</b> — georeferenced CAD linework with a confirmed CRS.</span>`;
  body.prepend(guide);
}

export function organiseMapTools(mapPlanner) {
  const tools = document.querySelector(".map-tools");
  if (!tools || tools.dataset.organised === "true") return mapPlanner;
  tools.dataset.organised = "true";
  tools.classList.add("map-tools-organised");

  const groups = [...tools.children].filter((child) => child.classList.contains("tool-group"));
  const locate = createSection("1. Locate and frame", "Find the site, choose the background and set the exact A1 map view.", true);
  const locations = createSection("2. Add fieldwork locations", "Place locations manually or import a coordinate file.", true);
  const imports = createSection("3. Import site overlays", "Add georeferenced imagery, raster plans or CAD linework.", false);
  const output = createSection("4. Display, QA and export", "Control layers, review warnings and download GIS outputs.", false);

  const locateBody = locate.querySelector(".map-tool-section-body");
  const locationsBody = locations.querySelector(".map-tool-section-body");
  const importsBody = imports.querySelector(".map-tool-section-body");
  const outputBody = output.querySelector(".map-tool-section-body");

  groups.forEach((group) => {
    if (matches(group, ["background", "map mode", "precise map framing"])) locateBody.append(group);
    else if (matches(group, ["place fieldwork", "import coordinate"])) locationsBody.append(group);
    else if (matches(group, ["georeferenced plan", "georeferenced aerial", "georeferenced dxf", "geotiff"])) importsBody.append(group);
    else outputBody.append(group);
  });

  const geoTiffGroup = [...importsBody.querySelectorAll(":scope > .tool-group")].find((group) => heading(group).includes("georeferenced plan"));
  if (geoTiffGroup) {
    const title = geoTiffGroup.querySelector("h3");
    if (title) title.textContent = "GeoTIFF raster";
    const helper = geoTiffGroup.querySelector("small");
    if (helper) helper.textContent = "Use a GeoTIFF when the raster already contains georeferencing, or select its source CRS manually.";
  }

  addImportGuide(importsBody);
  tools.replaceChildren(locate, locations, imports, output);
  return mapPlanner;
}
