/**
 * Parser for Lutron Integration Reports.
 *
 * Lutron HomeWorks QSX / Athena / RadioRA 3 produce an "Integration Report" PDF
 * containing every Device, Zone (light load / shade / blind), HVAC Zone, Area,
 * Shade Group and Area Scene addressable through the LEAP API. The report uses
 * href paths like `/zone/5384`, `/area/785`, `/areascene/789`, `/button/8435`,
 * `/led/8430`, `/device/8423`.
 *
 * This parser accepts the report as plain text (extracted from the PDF) and
 * returns a normalized structure that the platform stores in SystemSettings
 * and renders in the Lighting page. The structure is intentionally vendor
 * neutral: the Lutron LEAP adapter dispatches based on the same hrefs.
 */

const SECTION_PATTERNS = {
  device: /^Device\s+name\s+Model\s+href\s+Component/i,
  zone: /^Zone\s+Name\s+href/i,
  hvacZone: /^HVAC\s+Zone\s+Name\s+href/i,
  area: /^Area\s+Name\s+href/i,
  shadeGroup: /^Shade\s+Group\s+Name\s+href/i,
  areaScene: /^Area\s+Scene\s+Name\s+href/i,
};

const IGNORED_LINE_PATTERNS = [
  /^Integration Report$/i,
  /^File Name:.*Sheet:\s*\d+\s+of\s+\d+\s*$/i,
  /^--\s*\d+\s+of\s+\d+\s*--$/,
];

const HREF_RE = /\/(button|led|device|zone|area|areascene|shadegroup|hvaczone)\/(\d+)/;

function shouldIgnore(line) {
  if (!line) return true;
  return IGNORED_LINE_PATTERNS.some((re) => re.test(line));
}

function detectSection(line) {
  for (const [section, re] of Object.entries(SECTION_PATTERNS)) {
    if (re.test(line)) return section;
  }
  return null;
}

function pathSegments(rawPath) {
  return String(rawPath || "")
    .split("\\")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Heuristic for what kind of load a zone is. Useful for grouping the UI by
 * light vs shade vs blind.
 *
 * Window-treatment naming varies a lot between Lutron Designer projects —
 * the same physical drape can be tagged "DRAPE", "DRAPERY", "SHEER",
 * "VOILE", "ROLLER", "ZEBRA", "SILHOUETTE", "HONEYCOMB", "CELLULAR",
 * "SHUTTER" or simply "MOTOR". We classify them all into the existing
 * shade-family kinds (shade / blind / blackout) so they end up on the
 * Shades tab with Open/Close/Stop controls instead of getting dropped
 * into "load" and falling out to the Lights tab.
 *
 * Many Designer projects also strip the leaf zone name down to a bare
 * index ("1", "2", "3") inside an area like `…\Curtains\1`. To catch
 * those we accept an optional `context` string (the area name or full
 * path) and apply the same keyword test against it. A leaf name that
 * already matches wins over the context.
 */
export function classifyZoneKind(name = "", context = "") {
  const test = (str) => {
    const n = String(str || "").toLowerCase();
    if (!n) return null;
    if (/blackout/.test(n)) return "blackout";
    if (/\b(shades?|curtains?|drapes?|drapery|draperies|sheers?|voile|rollers?|zebra|silhouettes?|honeycombs?|cellulars?|skylight\s*shades?|skylight-shades?|shadeband|skybands?)\b/.test(n)) return "shade";
    if (/\b(blinds?|romans?|venetians?|shutters?|panel\s*tracks?|panel-tracks?)\b/.test(n)) return "blind";
    if (/pendant|niche|coffer|skylight|cabinet|strip|uplight|wall lamp|wall light|downlight|spot|chandelier|light/.test(n)) return "light";
    return null;
  };
  return test(name) || test(context) || "load";
}

function buildArea(fullPath, href) {
  const parts = pathSegments(fullPath);
  const floor = parts[0] || "Unassigned";
  const name = parts.slice(1).join(" · ") || fullPath || href;
  return {
    href,
    id: hrefId(href),
    fullPath: fullPath || "",
    floor,
    name,
  };
}

function hrefId(href) {
  const m = HREF_RE.exec(String(href || ""));
  return m ? m[2] : href || "";
}

function buildZone(fullPath, href) {
  const parts = pathSegments(fullPath);
  const floor = parts[0] || "Unassigned";
  const areaName = parts[1] || "Area";
  const zoneName = parts[parts.length - 1] || "Zone";
  const areaFullPath = parts.slice(0, parts.length - 1).join("\\");
  // Combine every path segment except the floor as classification
  // context so a zone named just "1" inside `…\Curtains\1` still
  // resolves to "shade".
  const context = parts.slice(1).join(" ");
  return {
    href,
    id: hrefId(href),
    fullPath: fullPath || "",
    floor,
    area: areaName,
    areaFullPath,
    name: zoneName,
    kind: classifyZoneKind(zoneName, context),
  };
}

function buildScene(fullPath, href) {
  const parts = pathSegments(fullPath);
  const floor = parts[0] || "Unassigned";
  const areaName = parts[1] || "Area";
  const sceneName = parts[parts.length - 1] || "Scene";
  const areaFullPath = parts.slice(0, parts.length - 1).join("\\");
  return {
    href,
    id: hrefId(href),
    fullPath: fullPath || "",
    floor,
    area: areaName,
    areaFullPath,
    name: sceneName,
  };
}

/**
 * Lutron device blocks span multiple lines. After PDF extraction each block
 * looks like:
 *
 *   <path-start>\t<model> /device/<id>\t<Button|Led> N /<type>/<cid> [name]
 *   <path-continuation>
 *   <path-continuation>
 *   Button N /button/<cid> [name]
 *   Led N /led/<cid>
 *   ...
 *
 * The trailing "Component Name" engraving (e.g. "WELCOME", "ALL OFF") is
 * preserved when present.
 */
function joinPath(segments) {
  return segments
    .filter(Boolean)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\\")
    .replace(/\\+/g, "\\");
}

function parseComponentRest(rest) {
  return String(rest || "")
    .replace(/\t.*$/, "")
    .trim() || null;
}

function makeComponent(kindToken, indexStr, hrefType, hrefIdStr, rest) {
  return {
    kind: String(kindToken).toLowerCase(),
    index: Number(indexStr) || 0,
    href: `/${hrefType}/${hrefIdStr}`,
    componentName: parseComponentRest(rest),
  };
}

function appendComponent(device, kindToken, indexStr, hrefType, hrefIdStr, rest) {
  const node = makeComponent(kindToken, indexStr, hrefType, hrefIdStr, rest);
  if (hrefType === "button") device.buttons.push(node);
  else if (hrefType === "led") device.leds.push(node);
}

function parseDevices(lines) {
  const byHref = new Map();
  const order = [];
  let current = null;
  let pathParts = [];

  const finalizePath = () => {
    if (!current) return;
    const path = joinPath(pathParts);
    if (path && !current.fullPath) {
      current.fullPath = path;
      const segs = pathSegments(path);
      current.floor = segs[0] || "";
      current.area = segs[1] || "";
      current.location = segs.slice(2).join(" · ");
    } else if (path && current.fullPath && !current.fullPath.includes(path)) {
      const merged = `${current.fullPath}\\${path}`.replace(/\\+/g, "\\");
      current.fullPath = merged;
      const segs = pathSegments(merged);
      current.floor = segs[0] || current.floor;
      current.area = segs[1] || current.area;
      current.location = segs.slice(2).join(" · ");
    }
    pathParts = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, " ").trimEnd();
    if (!line.trim()) continue;
    if (shouldIgnore(line)) continue;

    // A line that introduces (or continues) a device anchor.
    //   "Sub Basement\SB.01 STAIR\t2 Column (2B-2B) /device/8423\tButton 1 /button/8435"
    //   "Sub Basement\SB.02 CINEMA 2 Column (2B-2B) /device/4403 Led 5 /led/4413"
    const deviceAnchor = /\/device\/(\d+)/.exec(line);
    if (deviceAnchor) {
      // Finalize previous device's path before starting new one.
      finalizePath();
      // Split the line into 3 columns by tab if tabs exist; otherwise we
      // need to identify the model + path manually.
      const cols = line.split(/\t+/);
      let leftPath = "";
      let modelChunk = "";
      let rightComp = "";
      const MODEL_RE =
        /(\d+\s+Column\s*\([^)]*\)|Phantom Keypad|PK\d[\w-]*|PJ\d[\w-]*|HQR[\w-]*|HWI-[\w-]+|SeeTouch[\w- ]*|Hybrid[\w- ]*)/i;

      if (cols.length >= 2) {
        const middleIdx = cols.findIndex((c) => /\/device\/\d+/.test(c));
        leftPath = cols.slice(0, middleIdx).join(" ").trim();
        modelChunk = cols[middleIdx] || "";
        rightComp = cols.slice(middleIdx + 1).join(" ").trim();
        // Sometimes both path + model live in the middle column (no separating
        // tab between path and model).
        const beforeDevice = modelChunk.replace(/\/device\/\d+.*$/, "").trim();
        const m = MODEL_RE.exec(beforeDevice);
        if (m && m.index > 0) {
          // Everything before the model token is path.
          leftPath = `${leftPath} ${beforeDevice.slice(0, m.index).trim()}`.trim();
          modelChunk = `${m[1]} ${modelChunk.slice(modelChunk.indexOf("/device/"))}`.trim();
        } else if (m) {
          // modelChunk starts with the model — keep as is.
        } else {
          // No recognizable model — also check leftPath in case the whole
          // model leaked into the left column.
          const ml = MODEL_RE.exec(leftPath);
          if (ml) {
            modelChunk = `${ml[1]} ${modelChunk}`.trim();
            leftPath = leftPath.slice(0, ml.index).trim();
          }
        }
      } else {
        // Try splitting by the device href occurrence.
        const idx = line.search(/\/device\/\d+/);
        const beforeHref = line.slice(0, idx).trim();
        const tail = line.slice(idx).trim();
        const modelMatch = MODEL_RE.exec(beforeHref);
        if (modelMatch) {
          leftPath = beforeHref.slice(0, modelMatch.index).trim();
          modelChunk = `${modelMatch[1].trim()} ${tail.match(/^\/device\/\d+\S*/)?.[0] || ""}`.trim();
          rightComp = tail.replace(/^\/device\/\d+\s*/, "").trim();
        } else {
          leftPath = beforeHref;
          modelChunk = tail;
        }
      }

      // Extract the bare model name from modelChunk (strip the href and any
      // trailing component anchor).
      const modelOnly = modelChunk
        .replace(/\/device\/\d+.*$/, "")
        .trim()
        .replace(/[\s,;]+$/, "");

      const href = `/device/${deviceAnchor[1]}`;
      if (byHref.has(href)) {
        // Continuation of a previously-seen device (e.g. carried over from
        // a previous page).
        current = byHref.get(href);
      } else {
        current = {
          href,
          id: hrefId(href),
          model: modelOnly,
          fullPath: "",
          floor: "",
          area: "",
          location: "",
          buttons: [],
          leds: [],
        };
        byHref.set(href, current);
        order.push(current);
      }

      if (modelOnly && !current.model) current.model = modelOnly;
      if (leftPath) pathParts.push(leftPath);

      // Right column may carry the first component for this device.
      if (rightComp) {
        const rc = /^(Button|Led)\s+(\d+)\s+\/(button|led)\/(\d+)\s*(.*)$/.exec(rightComp);
        if (rc) appendComponent(current, rc[1], rc[2], rc[3], rc[4], rc[5]);
      }
      continue;
    }

    // Component line attached to the *current* device.
    const compMatch = /^(Button|Led)\s+(\d+)\s+\/(button|led)\/(\d+)\s*(.*)$/.exec(line);
    if (compMatch) {
      if (current) appendComponent(current, compMatch[1], compMatch[2], compMatch[3], compMatch[4], compMatch[5]);
      continue;
    }

    // Pure path continuation.
    if (current) {
      pathParts.push(line);
    }
  }

  finalizePath();
  // Dedupe components by href in case continuation pages repeat them.
  for (const dev of order) {
    dev.buttons = dedupeBy(dev.buttons, "href");
    dev.leds = dedupeBy(dev.leds, "href");
  }
  return order;
}

function dedupeBy(arr, key) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = item?.[key];
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function parseList(lines, builder) {
  const out = [];
  let pending = "";
  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, " ").trim();
    if (!line || shouldIgnore(line)) continue;
    const m = HREF_RE.exec(line);
    if (m) {
      // The href can appear in the middle; the path is everything before it.
      const idx = line.lastIndexOf(`/${m[1]}/`);
      const left = line.slice(0, idx).trim();
      const fullPath = `${pending} ${left}`.replace(/\s+/g, " ").trim();
      const href = `/${m[1]}/${m[2]}`;
      out.push(builder(fullPath, href));
      pending = "";
    } else {
      pending = `${pending} ${line}`.replace(/\s+/g, " ").trim();
    }
  }
  return out;
}

/**
 * Split the report text into sections by header row.
 * Each header row resets the current section; remaining lines belong to it.
 */
function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = {
    device: [],
    zone: [],
    hvacZone: [],
    area: [],
    shadeGroup: [],
    areaScene: [],
  };
  let active = "device";
  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, " ");
    if (shouldIgnore(line.trim())) continue;
    const section = detectSection(line.trim());
    if (section) {
      active = section;
      continue;
    }
    sections[active].push(line);
  }
  return sections;
}

/**
 * Top-level parser. Accepts the integration report as text and returns a
 * normalized house structure.
 *
 * @param {string} text
 * @param {Object} options
 * @param {string} [options.fileName]
 * @param {string} [options.processorId]   Optional equipment ID this report belongs to.
 * @returns {Object}
 */
export function parseLutronIntegrationReport(text, options = {}) {
  if (!text || typeof text !== "string") {
    throw new Error("Lutron integration report text is required");
  }

  const sections = splitSections(text);

  const devices = parseDevices(sections.device);
  const zones = parseList(sections.zone, buildZone);
  const hvacZones = parseList(sections.hvacZone, (fullPath, href) => ({
    href,
    id: hrefId(href),
    fullPath,
    name: pathSegments(fullPath).pop() || href,
  }));
  const areas = parseList(sections.area, buildArea);
  const shadeGroups = parseList(sections.shadeGroup, (fullPath, href) => ({
    href,
    id: hrefId(href),
    fullPath,
    name: pathSegments(fullPath).pop() || href,
  }));
  const scenes = parseList(sections.areaScene, buildScene);

  // Build an areas-by-fullPath lookup and infer any area referenced by a zone
  // but not declared (defensive — Lutron reports always include the area).
  const areaByPath = new Map(areas.map((a) => [a.fullPath, a]));
  for (const z of zones) {
    if (!areaByPath.has(z.areaFullPath)) {
      const inferred = buildArea(z.areaFullPath, "");
      areaByPath.set(z.areaFullPath, inferred);
      areas.push(inferred);
    }
    z.area_id = areaByPath.get(z.areaFullPath).id;
  }
  for (const s of scenes) {
    const area = areaByPath.get(s.areaFullPath);
    s.area_id = area?.id || "";
  }

  return {
    house: {
      fileName: options.fileName || "Lutron Integration Report",
      processorId: options.processorId || null,
      parsedAt: new Date().toISOString(),
      counts: {
        areas: areas.length,
        zones: zones.length,
        scenes: scenes.length,
        devices: devices.length,
        buttons: devices.reduce((s, d) => s + d.buttons.length, 0),
        leds: devices.reduce((s, d) => s + d.leds.length, 0),
        hvacZones: hvacZones.length,
        shadeGroups: shadeGroups.length,
      },
    },
    areas: areas.sort((a, b) =>
      `${a.floor}\\${a.name}`.localeCompare(`${b.floor}\\${b.name}`)
    ),
    zones,
    scenes,
    devices,
    hvacZones,
    shadeGroups,
  };
}

/** Group zones by area (returns areaId → zones[]). */
export function groupZonesByArea(house) {
  const map = new Map();
  for (const z of house?.zones || []) {
    const key = z.area_id || z.areaFullPath || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(z);
  }
  return map;
}

/** Group scenes by area. */
export function groupScenesByArea(house) {
  const map = new Map();
  for (const s of house?.scenes || []) {
    const key = s.area_id || s.areaFullPath || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return map;
}
