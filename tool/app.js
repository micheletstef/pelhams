import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);

const els = {
  fileInput: $("file-input"),
  fileLabel: $("file-label"),
  pdfPage: $("pdf-page"),
  sourceDpi: $("source-dpi"),
  vessel: $("vessel"),
  bottleStats: $("bottle-stats"),
  labelWidth: $("label-width"),
  labelHeight: $("label-height"),
  labelArcReadout: $("label-arc-readout"),
  curvature: $("curvature"),
  edgeWarp: $("edge-warp"),
  vBow: $("v-bow"),
  perspective: $("perspective"),
  scaleX: $("scale-x"),
  scaleY: $("scale-y"),
  rotate: $("rotate"),
  offsetX: $("offset-x"),
  offsetY: $("offset-y"),
  edgeFade: $("edge-fade"),
  fadeStart: $("fade-start"),
  crop: $("crop"),
  clipCylinder: $("clip-cylinder"),
  showGuides: $("show-guides"),
  showMockup: $("show-mockup"),
  matchAspect: $("match-aspect"),
  knockoutWhite: $("knockout-white"),
  artColor: $("art-color"),
  outW: $("out-w"),
  outH: $("out-h"),
  bgMode: $("bg-mode"),
  bgColor: $("bg-color"),
  pathDetail: $("path-detail"),
  btnReset: $("btn-reset"),
  btnExport: $("btn-export"),
  btnExportPdf: $("btn-export-pdf"),
  btnExportSvg: $("btn-export-svg"),
  btnFit: $("btn-fit"),
  btnRedraw: $("btn-redraw"),
  status: $("status"),
  preview: $("preview"),
  topview: $("topview"),
  topviewStats: $("topview-stats"),
  frontview: $("frontview"),
  frontviewStats: $("frontview-stats"),
  curvatureVal: $("curvature-val"),
  edgeWarpVal: $("edge-warp-val"),
  vBowVal: $("v-bow-val"),
  perspectiveVal: $("perspective-val"),
  scaleXVal: $("scale-x-val"),
  scaleYVal: $("scale-y-val"),
  rotateVal: $("rotate-val"),
  offsetXVal: $("offset-x-val"),
  offsetYVal: $("offset-y-val"),
  edgeFadeVal: $("edge-fade-val"),
  fadeStartVal: $("fade-start-val"),
  cropVal: $("crop-val"),
};

/**
 * Selectable vessels. Each has physical mm dims + a photo mockup calibration.
 * Can: standard EU 330 ml (Ø66.2 × 115.2 mm). Bottle: Univerre Rheinwein 75cl.
 */
const VESSELS = {
  bottle75cl: {
    id: "bottle75cl",
    name: "Rheinwein BVS30H60 75cl",
    kind: "bottle",
    diameter: 77.7,
    height: 349,
    labelPanel: 105,
    frontSrc: "assets/rhine-bottle-front.png",
    frontNote: "Outline from Univerre PDF",
    bodyTopFrac: (349 - 12 - 105) / 349,
    bodyBotFrac: (349 - 8) / 349,
    defaultLabelWidth: 120,
    defaultLabelHeight: 105,
    defaultOutW: 424,
    defaultOutH: 2068,
    mockup: {
      src: "assets/bottle-mockup-hr.png",
      // Calibrated from SM_CiderBottle_Cutout_HR.png (848×4136)
      bodyTopFrac: 0.676,
      bodyBotFrac: 0.977,
      bodyLeftFrac: 0.01,
      bodyRightFrac: 0.99,
      highlightStrength: 0.4,
      bgKnockoutLum: 14,
    },
  },
  can330: {
    id: "can330",
    name: "330 ml aluminum can",
    kind: "can",
    diameter: 66.2,
    height: 115.2,
    // Parallel body band on SM_Aluminum_Can_HR.png
    labelPanel: 91,
    frontSrc: "assets/can-mockup-hr.png",
    frontNote: "Standard 330 ml can mockup",
    bodyTopFrac: 0.132,
    bodyBotFrac: 0.924,
    // Full wrap ≈ π × Ø
    defaultLabelWidth: 208,
    defaultLabelHeight: 91,
    defaultOutW: 794,
    defaultOutH: 1504,
    mockup: {
      src: "assets/can-mockup-hr.png",
      bodyTopFrac: 0.132,
      bodyBotFrac: 0.924,
      bodyLeftFrac: 0.001,
      bodyRightFrac: 0.997,
      highlightStrength: 0.5,
      bgKnockoutLum: 14,
    },
  },
};

const DEFAULT_VESSEL_ID = "bottle75cl";

function activeVessel() {
  return VESSELS[els.vessel?.value] || VESSELS[DEFAULT_VESSEL_ID];
}

function activeMockup() {
  return activeVessel().mockup;
}

const DEFAULTS = {
  vessel: DEFAULT_VESSEL_ID,
  labelWidth: 120,
  labelHeight: 105,
  curvature: 1,
  edgeWarp: 1,
  vBow: 0,
  perspective: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  offsetX: 0,
  offsetY: 0,
  edgeFade: 0,
  fadeStart: 60,
  crop: 0,
  clipCylinder: true,
  showGuides: false,
  showMockup: true,
  matchAspect: true,
  knockoutWhite: true,
  artColor: "#000000",
  outW: 424,
  outH: 2068,
  bgMode: "transparent",
  bgColor: "#808080",
  pdfPage: 1,
  sourceDpi: 300,
  pathDetail: 12,
};

const STORAGE_KEY = "pelham-cylinder-wrap-v1";
const MM_TO_PT = 72 / 25.4;

/** @type {HTMLCanvasElement | null} */
let sourceCanvas = null;
/** @type {ImageData | null} */
let sourceData = null;
/** @type {pdfjsLib.PDFDocumentProxy | null} */
let pdfDoc = null;
/** @type {ArrayBuffer | null} */
let sourcePdfBytes = null;
/** @type {string | null} */
let sourceSvgText = null;
/** @type {{ w: number, h: number } | null} */
let sourceVectorSize = null;
let sourceKind = ""; // "pdf" | "svg"
let sourceName = "";
let renderToken = 0;
let rafPending = 0;

/** @type {HTMLImageElement | null} */
let mockupImage = null;
/** @type {HTMLCanvasElement | null} */
let mockupHighlights = null;

const previewCtx = els.preview.getContext("2d", { alpha: true });

function mockupSize(img) {
  return {
    w: img.naturalWidth || img.width,
    h: img.naturalHeight || img.height,
  };
}

function loadMockup() {
  const mockup = activeMockup();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Prefer the asset's own alpha (true cutout). Only matte black if opaque.
      mockupImage = imageHasAlpha(img) ? rasterizeImage(img) : cutoutBlackBackground(img);
      mockupHighlights = buildHighlightLayer(img);
      resolve(mockupImage);
    };
    img.onerror = () => {
      console.warn("Mockup failed to load:", mockup.src);
      mockupImage = null;
      mockupHighlights = null;
      resolve(null);
    };
    img.src = mockup.src;
  });
}

/** Apply vessel-specific label size + output defaults (keeps warp knobs). */
function applyVesselLabelDefaults(vessel = activeVessel()) {
  els.labelWidth.value = String(vessel.defaultLabelWidth);
  els.labelHeight.value = String(vessel.defaultLabelHeight);
  els.outW.value = String(vessel.defaultOutW);
  els.outH.value = String(vessel.defaultOutH);
}

async function switchVessel(vesselId, { applyLabelDefaults = true } = {}) {
  if (!VESSELS[vesselId]) vesselId = DEFAULT_VESSEL_ID;
  els.vessel.value = vesselId;
  if (applyLabelDefaults) applyVesselLabelDefaults();
  setStatus(`Loading ${activeVessel().name}…`);
  await loadMockup();
  saveSettings();
  scheduleRender();
  setStatus(`Ready — ${activeVessel().name}`);
}

function rasterizeImage(img) {
  const { w, h } = mockupSize(img);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

function imageHasAlpha(img) {
  const { w, h } = mockupSize(img);
  const c = document.createElement("canvas");
  // Sample a few edge pixels — cutouts are transparent in the corners
  c.width = Math.min(8, w);
  c.height = Math.min(8, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 250) return true;
  }
  return false;
}

/** Remove solid studio black so the bottle sits on a white (or solid) backdrop. */
function cutoutBlackBackground(img) {
  const c = rasterizeImage(img);
  const ctx = c.getContext("2d");
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  const lim = activeMockup().bgKnockoutLum;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < lim && r < lim + 6 && g < lim + 6 && b < lim + 6) {
      // Soft edge: fade near-black fringe instead of a hard matte
      d[i + 3] = Math.round(255 * (lum / lim));
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** Extract specular highlights from the bottle photo for glass realism. */
function buildHighlightLayer(img) {
  const { w, h } = mockupSize(img);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Keep only bright specular; crush the rest to black for screen blend
    const t = Math.max(0, (lum - 140) / 115);
    const v = Math.round(255 * t * t);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = lum > 8 ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function setStatus(msg) {
  els.status.textContent = msg;
}

/** Physical vessel + label geometry derived from mm inputs. */
function bottleGeometry(controls) {
  const vessel = activeVessel();
  const diameter = vessel.diameter;
  const radius = diameter / 2;
  const circumference = Math.PI * diameter;
  const bottleHeight = vessel.height;
  const labelWidth = Math.max(0.1, controls.labelWidth);
  const labelHeight = Math.max(0.1, controls.labelHeight);
  const labelArcRad = labelWidth / radius;
  const labelArcDeg = (labelArcRad * 180) / Math.PI;
  const coverage = labelWidth / circumference;
  // Visible front chord of the label (orthographic), capped by bottle width
  const halfArc = Math.min(Math.PI / 2, labelArcRad / 2);
  const visibleLabelWidth = 2 * radius * Math.sin(halfArc);
  return {
    diameter,
    width: diameter,
    radius,
    circumference,
    bottleHeight,
    labelWidth,
    labelHeight,
    labelArcRad,
    labelArcDeg,
    coverage,
    visibleLabelWidth,
  };
}

function collectSettings() {
  return {
    vessel: els.vessel.value,
    labelWidth: els.labelWidth.value,
    labelHeight: els.labelHeight.value,
    curvature: els.curvature.value,
    edgeWarp: els.edgeWarp.value,
    vBow: els.vBow.value,
    perspective: els.perspective.value,
    scaleX: els.scaleX.value,
    scaleY: els.scaleY.value,
    rotate: els.rotate.value,
    offsetX: els.offsetX.value,
    offsetY: els.offsetY.value,
    edgeFade: els.edgeFade.value,
    fadeStart: els.fadeStart.value,
    crop: els.crop.value,
    clipCylinder: els.clipCylinder.checked,
    showGuides: els.showGuides.checked,
    showMockup: els.showMockup.checked,
    matchAspect: els.matchAspect.checked,
    knockoutWhite: els.knockoutWhite.checked,
    artColor: els.artColor.value,
    outW: els.outW.value,
    outH: els.outH.value,
    bgMode: els.bgMode.value,
    bgColor: els.bgColor.value,
    pdfPage: els.pdfPage.value,
    sourceDpi: els.sourceDpi.value,
    pathDetail: els.pathDetail.value,
  };
}

function applySettings(s) {
  if (!s || typeof s !== "object") return;
  const setVal = (el, key) => {
    if (s[key] != null && el) el.value = String(s[key]);
  };
  const setCheck = (el, key) => {
    if (typeof s[key] === "boolean" && el) el.checked = s[key];
  };
  if (s.vessel && VESSELS[s.vessel]) els.vessel.value = s.vessel;
  setVal(els.labelWidth, "labelWidth");
  setVal(els.labelHeight, "labelHeight");
  setVal(els.curvature, "curvature");
  setVal(els.edgeWarp, "edgeWarp");
  setVal(els.vBow, "vBow");
  setVal(els.perspective, "perspective");
  setVal(els.scaleX, "scaleX");
  setVal(els.scaleY, "scaleY");
  setVal(els.rotate, "rotate");
  setVal(els.offsetX, "offsetX");
  setVal(els.offsetY, "offsetY");
  setVal(els.edgeFade, "edgeFade");
  setVal(els.fadeStart, "fadeStart");
  setVal(els.crop, "crop");
  setCheck(els.clipCylinder, "clipCylinder");
  setCheck(els.showGuides, "showGuides");
  setCheck(els.showMockup, "showMockup");
  setCheck(els.matchAspect, "matchAspect");
  setCheck(els.knockoutWhite, "knockoutWhite");
  setVal(els.artColor, "artColor");
  setVal(els.outW, "outW");
  setVal(els.outH, "outH");
  setVal(els.bgMode, "bgMode");
  setVal(els.bgColor, "bgColor");
  setVal(els.pdfPage, "pdfPage");
  setVal(els.sourceDpi, "sourceDpi");
  setVal(els.pathDetail, "pathDetail");
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSettings()));
  } catch {
    /* ignore quota / private mode */
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    applySettings(JSON.parse(raw));
  } catch {
    /* ignore corrupt data */
  }
}

function readControls() {
  return {
    labelWidth: Number(els.labelWidth.value) || DEFAULTS.labelWidth,
    labelHeight: Number(els.labelHeight.value) || DEFAULTS.labelHeight,
    wrap: Number(els.curvature.value),
    edgeSquash: Number(els.edgeWarp.value),
    hCurve: Number(els.vBow.value),
    perspective: Number(els.perspective.value),
    scaleX: Number(els.scaleX.value),
    scaleY: Number(els.scaleY.value),
    rotateDeg: Number(els.rotate.value),
    offsetX: Number(els.offsetX.value) / 100,
    offsetY: Number(els.offsetY.value) / 100,
    edgeFade: Number(els.edgeFade.value),
    fadeStart: Number(els.fadeStart.value) / 100,
    crop: Number(els.crop.value) / 100,
    clipCylinder: els.clipCylinder.checked,
    showGuides: els.showGuides.checked,
    showMockup: els.showMockup.checked,
    matchAspect: els.matchAspect.checked,
    knockoutWhite: els.knockoutWhite.checked,
    artColor: els.artColor.value || DEFAULTS.artColor,
    outW: Math.max(64, Math.round(Number(els.outW.value) || DEFAULTS.outW)),
    outH: Math.max(64, Math.round(Number(els.outH.value) || DEFAULTS.outH)),
    bgMode: els.bgMode.value,
    bgColor: els.bgColor.value,
    pathDetail: Math.max(4, Math.min(40, Math.round(Number(els.pathDetail.value) || DEFAULTS.pathDetail))),
  };
}

function updateLabels() {
  const c = readControls();
  const g = bottleGeometry(c);
  els.curvatureVal.textContent = c.wrap.toFixed(2);
  els.edgeWarpVal.textContent = c.edgeSquash.toFixed(2);
  els.vBowVal.textContent = c.hCurve.toFixed(2);
  els.perspectiveVal.textContent = c.perspective.toFixed(2);
  els.scaleXVal.textContent = c.scaleX.toFixed(2);
  els.scaleYVal.textContent = c.scaleY.toFixed(2);
  els.rotateVal.textContent = `${c.rotateDeg.toFixed(1)}°`;
  els.offsetXVal.textContent = `${(c.offsetX * 100).toFixed(1)}%`;
  els.offsetYVal.textContent = `${(c.offsetY * 100).toFixed(1)}%`;
  els.edgeFadeVal.textContent = c.edgeFade.toFixed(2);
  els.fadeStartVal.textContent = `${Math.round(c.fadeStart * 100)}%`;
  els.cropVal.textContent = `${(c.crop * 100).toFixed(1)}%`;
  els.bgColor.disabled = c.bgMode !== "solid";
  const vessel = activeVessel();
  els.bottleStats.textContent =
    `${vessel.name} · Ø${vessel.diameter} × ${vessel.height} mm · circ. ${g.circumference.toFixed(1)} mm`;
  els.labelArcReadout.textContent = `→ ${g.labelArcDeg.toFixed(1)}° around vessel (${(g.coverage * 100).toFixed(0)}% of circumference)`;
}

/**
 * Screen X → cylinder angle θ (radians from front center).
 * Orthographic: x = R·sin(θ) ⇒ θ = asin(nx). wrap blends flat↔cylinder.
 */
function screenXToTheta(nx, wrap, edgeSquash, labelArcRad) {
  const x = Math.max(-1, Math.min(1, nx));
  const halfArc = labelArcRad / 2;
  const flat = x * halfArc; // linear across label arc
  let cyl = Math.asin(x); // physical foreshortening on visible front
  // Remap asin range so |x|=1 lands at ±min(π/2, halfArc) feel — keep true asin for bottle
  // Artistic edge squash
  if (edgeSquash !== 1) {
    const s = Math.max(0.2, edgeSquash);
    const t = Math.sign(cyl) * Math.pow(Math.abs(cyl) / (Math.PI / 2), s) * (Math.PI / 2);
    cyl = t;
  }
  return flat * (1 - wrap) + cyl * wrap;
}

function thetaToScreenX(theta, wrap, edgeSquash, labelArcRad) {
  // Inverse via binary search
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const val = screenXToTheta(mid, wrap, edgeSquash, labelArcRad);
    if (val < theta) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Vertical offset for horizontal lines (elliptical arc on the cylinder face).
 * 0 at center, max at left/right edges. Magnitude is a fraction of label-band height
 * and matches the front-view label overlay bow.
 */
function horizontalCurveOffset(nx, hCurve) {
  if (!hCurve) return 0;
  const x = Math.max(-1, Math.min(1, nx));
  const cosTheta = Math.sqrt(Math.max(0, 1 - x * x));
  // ~0.18 of band height at the rim when hCurve = 1 (same visual weight as front view)
  return hCurve * 0.18 * (1 - cosTheta);
}

function cylinderDepth(nx) {
  const x = Math.max(-1, Math.min(1, nx));
  return Math.sqrt(Math.max(0, 1 - x * x));
}

function edgeFadeAlpha(nx, edgeFade, fadeStart) {
  if (edgeFade <= 0) return 1;
  const absX = Math.min(1, Math.abs(nx));
  const start = Math.max(0, Math.min(0.99, fadeStart));
  if (absX <= start) return 1;
  const t = (absX - start) / (1 - start);
  const smooth = t * t * (3 - 2 * t);
  return 1 - edgeFade * smooth;
}

function sampleBilinear(data, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) {
    // soft edge clamp with transparency outside
    if (x < -1 || y < -1 || x > w || y > h) return [0, 0, 0, 0];
    x = Math.max(0, Math.min(w - 1.0001, x));
    y = Math.max(0, Math.min(h - 1.0001, y));
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const idx = (ix, iy) => {
    const i = (iy * w + ix) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const c00 = idx(x0, y0);
  const c10 = idx(Math.min(x1, w - 1), y0);
  const c01 = idx(x0, Math.min(y1, h - 1));
  const c11 = idx(Math.min(x1, w - 1), Math.min(y1, h - 1));

  const out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const top = c00[k] * (1 - fx) + c10[k] * fx;
    const bot = c01[k] * (1 - fx) + c11[k] * fx;
    out[k] = top * (1 - fy) + bot * fy;
  }
  return out;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Treat light paper as transparent ink; recolor remaining marks with artColor.
 * Soft luminance → alpha so anti-aliased type stays clean.
 */
function styleArtworkSample(rgba, controls) {
  if (!controls.knockoutWhite) return rgba;
  const lum = 0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2];
  // White → 0 ink, black → full ink
  let ink = 1 - lum / 255;
  // Crush near-white so paper fully disappears
  ink = Math.max(0, (ink - 0.04) / 0.96);
  const [cr, cg, cb] = hexToRgb(controls.artColor);
  return [cr, cg, cb, rgba[3] * ink];
}

/**
 * Core bottle wrap.
 *
 * Output X maps to cylinder angle via asin (edge foreshortening).
 * Output Y maps straight down the bottle (no vertical stretch by default).
 * Label arc controls how much of the flat artwork spans the visible front.
 */
function warpToImageData(src, controls, width, height) {
  const { data: srcPixels, width: sw, height: sh } = src;
  const out = new ImageData(width, height);
  const dst = out.data;

  const crop = controls.crop;
  const usableHalf = Math.max(0.01, 1 - crop);

  const [br, bg, bb] = hexToRgb(controls.bgColor);
  const solidBg = controls.bgMode === "solid";

  for (let py = 0; py < height; py++) {
    const ny = (py + 0.5) / height; // 0..1

    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const nxRaw = ((px + 0.5) / width) * 2 - 1; // -1..1 across canvas
      const absX = Math.abs(nxRaw);

      if (controls.clipCylinder && absX > usableHalf) {
        if (solidBg) {
          dst[i] = br;
          dst[i + 1] = bg;
          dst[i + 2] = bb;
          dst[i + 3] = 255;
        }
        continue;
      }

      // x on the cylinder face (-1..1)
      const nx = nxRaw / usableHalf;
      if (Math.abs(nx) > 1) {
        if (solidBg) {
          dst[i] = br;
          dst[i + 1] = bg;
          dst[i + 2] = bb;
          dst[i + 3] = 255;
        }
        continue;
      }

      const { u, v } = sampleSourceUV(nx, ny, controls);

      const sx = u * sw;
      const sy = v * sh;
      const rgba = styleArtworkSample(sampleBilinear(srcPixels, sw, sh, sx, sy), controls);

      let a = rgba[3] * edgeFadeAlpha(nx, controls.edgeFade, controls.fadeStart);

      if (solidBg) {
        const alpha = a / 255;
        dst[i] = rgba[0] * alpha + br * (1 - alpha);
        dst[i + 1] = rgba[1] * alpha + bg * (1 - alpha);
        dst[i + 2] = rgba[2] * alpha + bb * (1 - alpha);
        dst[i + 3] = 255;
      } else {
        dst[i] = rgba[0];
        dst[i + 1] = rgba[1];
        dst[i + 2] = rgba[2];
        dst[i + 3] = a;
      }
    }
  }

  return out;
}

function drawGuides(ctx, width, height, controls) {
  if (!controls.showGuides) return;
  const crop = controls.crop;
  const usableHalf = Math.max(0.01, 1 - crop);
  const left = width * crop;
  const right = width * (1 - crop);
  // Fade start as distance from center on the cylinder face
  const fadeX = (controls.fadeStart * usableHalf + 1) / 2;
  const fadeLeft = (1 - fadeX) * width;
  const fadeRight = fadeX * width;

  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = Math.max(1, width * 0.0015);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left, height);
  ctx.moveTo(right, 0);
  ctx.lineTo(right, height);
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  if (controls.edgeFade > 0) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.moveTo(fadeLeft, 0);
    ctx.lineTo(fadeLeft, height);
    ctx.moveTo(fadeRight, 0);
    ctx.lineTo(fadeRight, height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeRect(left, 0, right - left, height);
  ctx.restore();
}

function mockupBodyRect(width, height, controls) {
  const g = bottleGeometry(controls);
  const mockup = activeMockup();
  const vessel = activeVessel();
  const panelTop = height * mockup.bodyTopFrac;
  const panelBot = height * mockup.bodyBotFrac;
  const panelH = Math.max(1, panelBot - panelTop);
  const panelLeft = width * mockup.bodyLeftFrac;
  const panelRight = width * mockup.bodyRightFrac;
  const panelW = Math.max(1, panelRight - panelLeft);

  // Label height as fraction of the physical label panel
  const labelH = Math.min(
    panelH * 1.15,
    panelH * (g.labelHeight / vessel.labelPanel) * controls.scaleY
  );
  const visFrac = Math.min(1, g.visibleLabelWidth / g.width);
  const labelW = Math.min(panelW, panelW * visFrac * controls.scaleX);

  let lx = panelLeft + (panelW - labelW) / 2 + controls.offsetX * panelW;
  let ly = panelTop + (panelH - labelH) / 2 + controls.offsetY * panelH;
  lx = Math.max(panelLeft, Math.min(panelRight - labelW, lx));
  ly = Math.max(panelTop - labelH * 0.15, Math.min(panelBot - labelH * 0.85, ly));

  return {
    panelLeft,
    panelTop,
    panelW,
    panelH,
    lx,
    ly,
    labelW: Math.max(2, labelW),
    labelH: Math.max(2, labelH),
  };
}

/** Draw bottle photo + warped label into ctx at width×height. */
function paintMockup(ctx, width, height, labelImage, controls) {
  ctx.clearRect(0, 0, width, height);

  if (controls.bgMode === "solid") {
    ctx.fillStyle = controls.bgColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Cutout bottle on a white studio backdrop
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }

  if (mockupImage) {
    ctx.drawImage(mockupImage, 0, 0, width, height);
  }

  if (!labelImage) return;

  const rect = mockupBodyRect(width, height, controls);
  const lw = labelImage.width;
  const lh = labelImage.height;

  const tmp = document.createElement("canvas");
  tmp.width = lw;
  tmp.height = lh;
  tmp.getContext("2d").putImageData(labelImage, 0, 0);

  ctx.save();
  // Ink-only artwork on the body, then restore glass speculars
  ctx.drawImage(tmp, rect.lx, rect.ly, rect.labelW, rect.labelH);

  if (mockupHighlights) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = activeMockup().highlightStrength;
    ctx.beginPath();
    ctx.rect(rect.lx, rect.ly, rect.labelW, rect.labelH);
    ctx.clip();
    ctx.drawImage(mockupHighlights, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function scheduleRender() {
  updateLabels();
  const controls = readControls();
  syncOutputAspect(controls);
  drawTopView(readControls());
  drawFrontView(readControls());
  if (rafPending) cancelAnimationFrame(rafPending);
  rafPending = requestAnimationFrame(() => {
    rafPending = 0;
    renderPreview();
  });
}

function renderPreview() {
  const controls = readControls();
  if (!sourceData && !(controls.showMockup && mockupImage)) return;

  const token = ++renderToken;

  // High-res preview: match output size (cap only for very large exports)
  const maxPreview = 4000;
  const scale = Math.min(1, maxPreview / Math.max(controls.outW, controls.outH));
  const w = Math.max(64, Math.round(controls.outW * scale));
  const h = Math.max(64, Math.round(controls.outH * scale));

  setStatus("Rendering…");
  setTimeout(() => {
    if (token !== renderToken) return;
    const t0 = performance.now();

    els.preview.width = w;
    els.preview.height = h;

    if (controls.showMockup && mockupImage) {
      let labelImage = null;
      if (sourceData) {
        const rect = mockupBodyRect(w, h, controls);
        const lw = Math.max(64, Math.round(rect.labelW));
        const lh = Math.max(64, Math.round(rect.labelH));
        // scaleY already sizes the band on the bottle — keep UV at 1 so art isn't cropped
        labelImage = warpToImageData(sourceData, { ...controls, scaleY: 1 }, lw, lh);
      }
      if (token !== renderToken) return;
      paintMockup(previewCtx, w, h, labelImage, controls);
      if (sourceData) drawGuidesOnMockup(previewCtx, w, h, controls);
    } else if (sourceData) {
      const image = warpToImageData(sourceData, controls, w, h);
      if (token !== renderToken) return;
      previewCtx.putImageData(image, 0, 0);
      drawGuides(previewCtx, w, h, controls);
    }

    const ms = Math.round(performance.now() - t0);
    setStatus(
      `${sourceName || "mockup"} · ${controls.outW}×${controls.outH} · preview ${w}×${h} · ${ms}ms`
    );
    setExportBusy(false);
    els.btnFit.disabled = !sourceData;
    els.btnRedraw.disabled = !sourceData && !mockupImage;
  }, 0);
}

function drawGuidesOnMockup(ctx, width, height, controls) {
  if (!controls.showGuides) return;
  const rect = mockupBodyRect(width, height, controls);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, width * 0.003);
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rect.panelLeft, rect.panelTop, rect.panelW, rect.panelH);
  ctx.strokeStyle = "rgba(255,200,80,0.7)";
  ctx.strokeRect(rect.lx, rect.ly, rect.labelW, rect.labelH);
  ctx.setLineDash([]);
  ctx.restore();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function exportBaseName() {
  return sourceName.replace(/\.[^.]+$/, "") || "wrap";
}

/**
 * Vertical safe pad inside the label band (fraction of band height).
 * Keeps ascenders / letter tops off the hard top edge of the warp.
 */
const ART_V_PAD = 0.03;

/**
 * Map output (nx, ny) → source UV.
 *
 * Horiz. curve matches the front-view label bow:
 *   ny = v*(1-2h) + h   where h = horizontalCurveOffset(nx)
 * so top/bottom edges sit lower/higher at the sides (∩ top, ∪ bottom).
 */
function sampleSourceUV(nx, ny, controls) {
  const g = bottleGeometry(controls);
  const rotateRad = (controls.rotateDeg * Math.PI) / 180;
  const theta = screenXToTheta(nx, controls.wrap, controls.edgeSquash, g.labelArcRad);
  // Label centered at rotate=0 covers [-α/2, α/2]
  const u = (theta - rotateRad) / (g.labelArcRad / controls.scaleX) + 0.5 + controls.offsetX;

  const depth = cylinderDepth(nx);
  const perspScale = 1 + controls.perspective * (1 - depth);
  // Map label-band Y → normalized t (0 at top, 1 at bottom).
  // Offset Y only positions the band on the bottle (mockupBodyRect), not UV.
  const t = 0.5 + (ny - 0.5) / (controls.scaleY * perspScale);
  const pad = ART_V_PAD;
  const span = Math.max(0.2, 1 - 2 * pad);
  const tArt = (t - pad) / span;

  const h = Math.min(0.4, Math.max(0, horizontalCurveOffset(nx, controls.hCurve)));
  const denom = Math.max(0.2, 1 - 2 * h);
  // Invert ny = v*(1-2h)+h  →  v = (ny - h) / (1-2h)
  const v = (tArt - h) / denom;
  return { u, v, theta };
}

/** Inverse: source UV → output pixel XY (for vector path warping). */
function sourceUVToOutputXY(u, v, controls, outW, outH) {
  const g = bottleGeometry(controls);
  const rotateRad = (controls.rotateDeg * Math.PI) / 180;
  const theta = (u - 0.5 - controls.offsetX) * (g.labelArcRad / controls.scaleX) + rotateRad;
  const nx = thetaToScreenX(theta, controls.wrap, controls.edgeSquash, g.labelArcRad);

  const depth = cylinderDepth(nx);
  const perspScale = 1 + controls.perspective * (1 - depth);
  const h = Math.min(0.4, Math.max(0, horizontalCurveOffset(nx, controls.hCurve)));
  // ny_band = v*(1-2h) + h
  const tArt = v * (1 - 2 * h) + h;
  const pad = ART_V_PAD;
  const span = Math.max(0.2, 1 - 2 * pad);
  const t = pad + tArt * span;
  const ny = (t - 0.5) * controls.scaleY * perspScale + 0.5;

  const usableHalf = Math.max(0.01, 1 - controls.crop);
  const x = ((nx * usableHalf + 1) / 2) * outW;
  const y = ny * outH;
  return { x, y, nx, fade: edgeFadeAlpha(nx, controls.edgeFade, controls.fadeStart) };
}

function polar(cx, cy, r, canvasAng) {
  return {
    x: cx + Math.cos(canvasAng) * r,
    y: cy + Math.sin(canvasAng) * r,
  };
}

function svgArcPath(cx, cy, r, startAng, endAng) {
  // SVG arc from startAng to endAng (canvas convention: 0 = right, CW positive like canvas)
  // Convert to SVG: same math with large-arc / sweep
  let delta = endAng - startAng;
  while (delta < 0) delta += Math.PI * 2;
  while (delta > Math.PI * 2) delta -= Math.PI * 2;
  const large = delta > Math.PI ? 1 : 0;
  const sweep = 1; // clockwise in screen coords
  const s = polar(cx, cy, r, startAng);
  const e = polar(cx, cy, r, endAng);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Draw top-down bottle diagram as SVG DOM. */
function drawTopView(controls) {
  const g = bottleGeometry(controls);
  const w = 280;
  const h = 300;
  const cx = w / 2;
  const cy = h / 2 - 8;
  const r = Math.min(w, h) * 0.34;

  const rot = (controls.rotateDeg * Math.PI) / 180;
  const half = g.labelArcRad / 2;
  const startWorld = -half + rot;
  const endWorld = half + rot;
  const toCanvas = (worldAng) => Math.PI / 2 + worldAng;
  const startA = toCanvas(startWorld);
  const endA = toCanvas(endWorld);
  const strokeW = Math.max(6, r * 0.12);

  const tick = (worldAng) => {
    const a = toCanvas(worldAng);
    const i = polar(cx, cy, r - 8, a);
    const o = polar(cx, cy, r + 10, a);
    return `<line x1="${i.x.toFixed(1)}" y1="${i.y.toFixed(1)}" x2="${o.x.toFixed(1)}" y2="${o.y.toFixed(1)}" stroke="#000" stroke-width="1.5"/>`;
  };

  const dimY = cy - r - 16;

  els.topview.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f0f0f0" stroke="#000" stroke-width="1.5"/>
      <path d="${svgArcPath(cx, cy, r, startA, endA)}" fill="none" stroke="#000" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="butt"/>
      ${tick(startWorld)}
      ${tick(endWorld)}
      <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#666" stroke-width="1" stroke-dasharray="4 3"/>
      <polygon points="${cx},${cy + r + 18} ${cx - 7},${cy + r + 6} ${cx + 7},${cy + r + 6}" fill="#000"/>
      <text x="${cx}" y="${cy + r + 32}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif">front</text>
      <line x1="${cx - 5}" y1="${cy}" x2="${cx + 5}" y2="${cy}" stroke="#999" stroke-width="1"/>
      <line x1="${cx}" y1="${cy - 5}" x2="${cx}" y2="${cy + 5}" stroke="#999" stroke-width="1"/>
      <line x1="${cx - r}" y1="${dimY}" x2="${cx + r}" y2="${dimY}" stroke="#000" stroke-width="1"/>
      <line x1="${cx - r}" y1="${dimY - 4}" x2="${cx - r}" y2="${dimY + 4}" stroke="#000" stroke-width="1"/>
      <line x1="${cx + r}" y1="${dimY - 4}" x2="${cx + r}" y2="${dimY + 4}" stroke="#000" stroke-width="1"/>
      <text x="${cx}" y="${dimY - 6}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif">Ø ${g.width} mm</text>
    </svg>`;

  els.topviewStats.innerHTML =
    `Label arc <b>${g.labelArcDeg.toFixed(1)}°</b><br>` +
    `Wraps <b>${(g.coverage * 100).toFixed(0)}%</b> of circumference<br>` +
    `Vessel width <b>${g.width} mm</b><br>` +
    `Label <b>${g.labelWidth}×${g.labelHeight} mm</b>`;
}

/** Front elevation: vessel outline + label band overlay. */
function drawFrontView(controls) {
  const g = bottleGeometry(controls);
  const vessel = activeVessel();
  const H = vessel.height;
  const R = vessel.diameter / 2;

  // Overlay uses a normalized 100×100 viewBox mapped to the vessel image
  const bodyTop = vessel.bodyTopFrac * 100;
  const bodyBot = vessel.bodyBotFrac * 100;
  const bodyH = bodyBot - bodyTop;

  const lhMm = Math.min(H * 0.9, g.labelHeight * controls.scaleY);
  const lh = (lhMm / H) * 100;
  const bodyMid = (bodyTop + bodyBot) / 2;
  let ly = bodyMid - lh / 2 + controls.offsetY * 50;
  ly = Math.max(bodyTop - 5, Math.min(bodyBot - lh + 5, ly));
  const ly2 = ly + lh;

  const visFrac = Math.min(1, g.visibleLabelWidth / (R * 2));
  const halfVis = (visFrac * 100) / 2;
  // Body fills most of image width; inset slightly for stroke padding in crop
  const inset = 4;
  const cx = 50 + controls.offsetX * 40;
  let lx = cx - halfVis;
  lx = Math.max(inset, Math.min(100 - inset - halfVis * 2, lx));
  const lx2 = lx + halfVis * 2;
  // Same bow model as the artwork warp (fraction of label height at the rim)
  const bow = horizontalCurveOffset(1, controls.hCurve) * lh;

  const labelPath =
    `M ${lx.toFixed(2)} ${(ly + bow).toFixed(2)}` +
    ` Q ${((lx + lx2) / 2).toFixed(2)} ${(ly - bow).toFixed(2)} ${lx2.toFixed(2)} ${(ly + bow).toFixed(2)}` +
    ` L ${lx2.toFixed(2)} ${(ly2 - bow).toFixed(2)}` +
    ` Q ${((lx + lx2) / 2).toFixed(2)} ${(ly2 + bow).toFixed(2)} ${lx.toFixed(2)} ${(ly2 - bow).toFixed(2)} Z`;

  els.frontview.innerHTML = `
    <div class="bottle-diagram">
      <img src="${vessel.frontSrc}" alt="${vessel.name} outline" draggable="false" />
      <svg class="label-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="${inset}" y="${bodyTop.toFixed(2)}" width="${(100 - inset * 2).toFixed(2)}" height="${bodyH.toFixed(2)}"
          fill="none" stroke="#999" stroke-width="0.4" stroke-dasharray="1.5 1.5" vector-effect="non-scaling-stroke"/>
        <path d="${labelPath}" fill="rgba(0,0,0,0.12)" stroke="#000" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
        <text x="${cx.toFixed(2)}" y="${((ly + ly2) / 2).toFixed(2)}" text-anchor="middle" dominant-baseline="middle"
          font-size="4" font-family="system-ui,sans-serif" fill="#000">label</text>
      </svg>
    </div>
    <p class="dim-readout">Ø ${vessel.diameter} mm · ${vessel.height} mm</p>`;

  els.frontviewStats.innerHTML =
    `${vessel.frontNote}<br>` +
    `Label panel ≈ <b>${vessel.labelPanel} mm</b> on body<br>` +
    `Visible label width ≈ <b>${g.visibleLabelWidth.toFixed(1)} mm</b>`;
}

function syncOutputAspect(controls) {
  if (!controls.matchAspect) return;
  const h = controls.outH;
  let aspect;
  if (controls.showMockup && mockupImage) {
      const { w: mw, h: mh } = mockupSize(mockupImage);
      aspect = mw / mh;
    } else {
      const g = bottleGeometry(controls);
      // Label-only artboard: bottle width × label height
      aspect = g.width / g.labelHeight;
    }
  const outW = Math.max(64, Math.round(h * aspect));
  if (Number(els.outW.value) !== outW) {
    els.outW.value = String(outW);
    saveSettings();
  }
}

function setExportBusy(busy) {
  els.btnExport.disabled = busy || !sourceData;
  els.btnExportPdf.disabled = busy || !sourceData;
  els.btnExportSvg.disabled = busy || !sourceData;
}

async function exportPng() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting PNG…");
  setExportBusy(true);

  await new Promise((r) => setTimeout(r, 20));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = controls.outW;
    canvas.height = controls.outH;
    const ctx = canvas.getContext("2d");

    if (controls.showMockup && mockupImage) {
      const rect = mockupBodyRect(controls.outW, controls.outH, controls);
      const lw = Math.max(64, Math.round(rect.labelW));
      const lh = Math.max(64, Math.round(rect.labelH));
      const labelImage = warpToImageData(sourceData, { ...controls, scaleY: 1 }, lw, lh);
      paintMockup(ctx, controls.outW, controls.outH, labelImage, controls);
    } else {
      const image = warpToImageData(sourceData, controls, controls.outW, controls.outH);
      ctx.putImageData(image, 0, 0);
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG export failed");
    const suffix = controls.showMockup ? "mockup" : "cylinder";
    downloadBlob(blob, `${exportBaseName()}-${suffix}-${exportStamp()}.png`);
    setStatus(`Exported ${controls.outW}×${controls.outH} PNG`);
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "PNG export failed");
  } finally {
    setExportBusy(false);
  }
}

function parseSvgSize(svgText) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = parsed.documentElement;
  const vb = root.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3], root, parsed };
    }
  }
  const w = parseFloat(root.getAttribute("width")) || 1024;
  const h = parseFloat(root.getAttribute("height")) || 1024;
  return { w, h, root, parsed };
}

function fmt(n) {
  return (Math.round(n * 1000) / 1000).toString();
}

function mulMat(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMat(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function colorToCss(args) {
  if (!args || !args.length) return "#000";
  if (args.length === 1) {
    const g = Math.round(args[0] * 255);
    return `rgb(${g},${g},${g})`;
  }
  if (args.length >= 3) {
    return `rgb(${Math.round(args[0] * 255)},${Math.round(args[1] * 255)},${Math.round(args[2] * 255)})`;
  }
  return "#000";
}

/**
 * Extract filled/stroked vector paths from a PDF page via pdf.js operator list.
 * Coordinates are converted to SVG top-left space (Y flipped).
 */
async function extractPdfVectorPaths(pdfBytes, pageNum) {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const page = await doc.getPage(Math.max(1, pageNum));
  const viewport = page.getViewport({ scale: 1 });
  const pageW = viewport.width;
  const pageH = viewport.height;
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;

  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let fillColor = "#000";
  let strokeColor = "#000";
  let fillAlpha = 1;
  let strokeAlpha = 1;
  let lineWidth = 1;
  /** @type {{ d: string, fill: string|null, stroke: string|null, fillRule: string, strokeWidth: number }[]} */
  const paths = [];

  const toSvg = (x, y) => {
    const p = applyMat(ctm, x, y);
    // PDF y-up → SVG y-down
    return { x: p.x, y: pageH - p.y };
  };

  const emitPath = (ops, args, paint) => {
    const parts = [];
    let j = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i] | 0;
      if (op === OPS.rectangle) {
        const rx = args[j++];
        const ry = args[j++];
        const rw = args[j++];
        const rh = args[j++];
        const p0 = toSvg(rx, ry);
        const p1 = toSvg(rx + rw, ry);
        const p2 = toSvg(rx + rw, ry + rh);
        const p3 = toSvg(rx, ry + rh);
        parts.push(`M${fmt(p0.x)} ${fmt(p0.y)}`);
        parts.push(`L${fmt(p1.x)} ${fmt(p1.y)}`);
        parts.push(`L${fmt(p2.x)} ${fmt(p2.y)}`);
        parts.push(`L${fmt(p3.x)} ${fmt(p3.y)} Z`);
        x = rx;
        y = ry;
      } else if (op === OPS.moveTo) {
        x = args[j++];
        y = args[j++];
        const p = toSvg(x, y);
        parts.push(`M${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.lineTo) {
        x = args[j++];
        y = args[j++];
        const p = toSvg(x, y);
        parts.push(`L${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo) {
        const x1 = args[j++];
        const y1 = args[j++];
        const x2 = args[j++];
        const y2 = args[j++];
        x = args[j++];
        y = args[j++];
        const c1 = toSvg(x1, y1);
        const c2 = toSvg(x2, y2);
        const p = toSvg(x, y);
        parts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo2) {
        const x1 = x;
        const y1 = y;
        const x2 = args[j++];
        const y2 = args[j++];
        x = args[j++];
        y = args[j++];
        const c1 = toSvg(x1, y1);
        const c2 = toSvg(x2, y2);
        const p = toSvg(x, y);
        parts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo3) {
        const x1 = args[j++];
        const y1 = args[j++];
        x = args[j++];
        y = args[j++];
        const c1 = toSvg(x1, y1);
        const p = toSvg(x, y);
        parts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(p.x)} ${fmt(p.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.closePath) {
        parts.push("Z");
      }
    }

    const d = parts.join(" ");
    if (!d) return;

    const doFill = paint.fill;
    const doStroke = paint.stroke;
    const scale = Math.hypot(ctm[0], ctm[1]) || 1;
    paths.push({
      d,
      fill: doFill ? fillColor : "none",
      stroke: doStroke ? strokeColor : "none",
      fillRule: paint.eo ? "evenodd" : "nonzero",
      fillOpacity: doFill ? fillAlpha : 1,
      strokeOpacity: doStroke ? strokeAlpha : 1,
      strokeWidth: doStroke ? Math.max(0.15, lineWidth * scale) : 0,
    });
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (fn) {
      case OPS.save:
        stack.push({
          ctm: ctm.slice(),
          fillColor,
          strokeColor,
          fillAlpha,
          strokeAlpha,
          lineWidth,
        });
        break;
      case OPS.restore: {
        const s = stack.pop();
        if (s) {
          ctm = s.ctm;
          fillColor = s.fillColor;
          strokeColor = s.strokeColor;
          fillAlpha = s.fillAlpha;
          strokeAlpha = s.strokeAlpha;
          lineWidth = s.lineWidth;
        }
        break;
      }
      case OPS.transform:
        ctm = mulMat(ctm, args);
        break;
      case OPS.setFillRGBColor:
      case OPS.setFillGray:
      case OPS.setFillColor:
        fillColor = colorToCss(args);
        break;
      case OPS.setFillCMYKColor:
        if (args?.length >= 4) {
          const [c, m, y, k] = args;
          fillColor = colorToCss([
            (1 - c) * (1 - k),
            (1 - m) * (1 - k),
            (1 - y) * (1 - k),
          ]);
        }
        break;
      case OPS.setStrokeRGBColor:
      case OPS.setStrokeGray:
      case OPS.setStrokeColor:
        strokeColor = colorToCss(args);
        break;
      case OPS.setStrokeCMYKColor:
        if (args?.length >= 4) {
          const [c, m, y, k] = args;
          strokeColor = colorToCss([
            (1 - c) * (1 - k),
            (1 - m) * (1 - k),
            (1 - y) * (1 - k),
          ]);
        }
        break;
      case OPS.setLineWidth:
        lineWidth = args[0] || 1;
        break;
      case OPS.setGState:
        if (Array.isArray(args)) {
          for (const entry of args) {
            const key = entry?.[0];
            const value = entry?.[1];
            if (key === "ca") fillAlpha = value;
            else if (key === "CA") strokeAlpha = value;
            else if (key === "LW") lineWidth = value;
          }
        }
        break;
      case OPS.constructPath: {
        // Look ahead for paint op (allow color/gstate ops in between)
        let paint = null;
        for (let k = i + 1; k < Math.min(i + 12, opList.fnArray.length); k++) {
          const next = opList.fnArray[k];
          if (
            next === OPS.fill ||
            next === OPS.eoFill ||
            next === OPS.stroke ||
            next === OPS.closeStroke ||
            next === OPS.fillStroke ||
            next === OPS.eoFillStroke ||
            next === OPS.closeFillStroke ||
            next === OPS.closeEOFillStroke
          ) {
            paint = {
              fill:
                next === OPS.fill ||
                next === OPS.eoFill ||
                next === OPS.fillStroke ||
                next === OPS.eoFillStroke ||
                next === OPS.closeFillStroke ||
                next === OPS.closeEOFillStroke,
              stroke:
                next === OPS.stroke ||
                next === OPS.closeStroke ||
                next === OPS.fillStroke ||
                next === OPS.eoFillStroke ||
                next === OPS.closeFillStroke ||
                next === OPS.closeEOFillStroke,
              eo: next === OPS.eoFill || next === OPS.eoFillStroke || next === OPS.closeEOFillStroke,
            };
            break;
          }
          if (
            next === OPS.save ||
            next === OPS.restore ||
            next === OPS.transform ||
            next === OPS.constructPath ||
            next === OPS.endPath
          ) {
            break;
          }
        }
        if (paint && (paint.fill || paint.stroke) && args?.[0] && args?.[1]) {
          emitPath(args[0], args[1], paint);
        }
        break;
      }
      default:
        break;
    }
  }

  if (!paths.length) {
    throw new Error(
      "No vector paths found in this PDF (it may be text/images only). Outline text in Illustrator first, or upload an SVG.",
    );
  }

  return { paths, w: pageW, h: pageH };
}

/**
 * Collect path `d` strings from an SVG source (with transforms baked via getCTM).
 */
function extractSvgVectorPaths(svgText, srcW, srcH) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const srcRoot = parsed.documentElement;
  if (srcRoot.querySelector("parsererror")) throw new Error("Could not parse SVG");

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;overflow:hidden;";
  const live = document.importNode(srcRoot, true);
  live.setAttribute("width", String(srcW));
  live.setAttribute("height", String(srcH));
  if (!live.getAttribute("viewBox")) live.setAttribute("viewBox", `0 0 ${srcW} ${srcH}`);
  host.appendChild(live);
  document.body.appendChild(host);

  /** @type {{ d: string, fill: string, stroke: string, fillRule: string, fillOpacity: number, strokeOpacity: number, strokeWidth: number }[]} */
  const paths = [];
  try {
    const shapes = live.querySelectorAll("path, polygon, polyline, line, rect, circle, ellipse");
    for (const el of shapes) {
      let d = "";
      const tag = el.tagName.toLowerCase();
      if (tag === "path") d = el.getAttribute("d") || "";
      else if (tag === "polygon" || tag === "polyline") {
        const pts = (el.getAttribute("points") || "")
          .trim()
          .split(/[\s,]+/)
          .map(Number)
          .filter((n) => !Number.isNaN(n));
        if (pts.length >= 2) {
          const cmds = [];
          for (let i = 0; i < pts.length; i += 2) cmds.push(`${i === 0 ? "M" : "L"}${pts[i]} ${pts[i + 1]}`);
          if (tag === "polygon") cmds.push("Z");
          d = cmds.join(" ");
        }
      } else if (tag === "line") {
        d = `M${el.getAttribute("x1") || 0} ${el.getAttribute("y1") || 0}L${el.getAttribute("x2") || 0} ${el.getAttribute("y2") || 0}`;
      } else if (tag === "rect") {
        const x = Number(el.getAttribute("x") || 0);
        const y = Number(el.getAttribute("y") || 0);
        const w = Number(el.getAttribute("width") || 0);
        const h = Number(el.getAttribute("height") || 0);
        d = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      } else if (tag === "circle" || tag === "ellipse") {
        const cx = Number(el.getAttribute("cx") || 0);
        const cy = Number(el.getAttribute("cy") || 0);
        const rx = Number(el.getAttribute(tag === "circle" ? "r" : "rx") || 0);
        const ry = Number(el.getAttribute(tag === "circle" ? "r" : "ry") || rx);
        d = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
      }
      if (!d) continue;

      // Bake local transform into path by sampling in root space
      let matrix = null;
      try {
        const ctm = el.getCTM();
        const rootCtm = live.getCTM();
        if (ctm && rootCtm) matrix = rootCtm.inverse().multiply(ctm);
      } catch {
        matrix = null;
      }

      const tmp = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tmp.setAttribute("d", d);
      const len = tmp.getTotalLength?.() || 0;
      let baked = d;
      if (matrix && len > 0) {
        const steps = Math.max(8, Math.ceil(len / 2));
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const p = tmp.getPointAtLength((i / steps) * len);
          const x = matrix.a * p.x + matrix.c * p.y + matrix.e;
          const y = matrix.b * p.x + matrix.d * p.y + matrix.f;
          pts.push(`${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`);
        }
        baked = pts.join("");
      }

      const cs = getComputedStyle(el);
      const fill = el.getAttribute("fill") || cs.fill || "#000";
      const stroke = el.getAttribute("stroke") || cs.stroke || "none";
      paths.push({
        d: baked,
        fill: fill === "none" ? "none" : fill,
        stroke: stroke === "none" || stroke === "rgba(0, 0, 0, 0)" ? "none" : stroke,
        fillRule: el.getAttribute("fill-rule") || "nonzero",
        fillOpacity: Number(el.getAttribute("fill-opacity") || cs.fillOpacity || 1),
        strokeOpacity: Number(el.getAttribute("stroke-opacity") || cs.strokeOpacity || 1),
        strokeWidth: parseFloat(el.getAttribute("stroke-width") || cs.strokeWidth || "0") || 0,
      });
    }
  } finally {
    host.remove();
  }

  if (!paths.length) throw new Error("No vector shapes found in SVG");
  return { paths, w: srcW, h: srcH };
}

/**
 * Warp path `d` (source SVG space) into output space by dense sampling.
 * Keeps each shape as one continuous path (no strips).
 */
function warpPathD(d, controls, srcW, srcH, outW, outH, detail) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);

  // Prefer segment-aware sampling when getPathData exists; else length sampling
  if (typeof path.getPathData === "function") {
    try {
      const segs = path.getPathData({ normalize: true });
      const out = [];
      let cx = 0;
      let cy = 0;
      let sx = 0;
      let sy = 0;
      const map = (x, y) => sourceUVToOutputXY(x / srcW, y / srcH, controls, outW, outH);

      const sampleCubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
        for (let i = 1; i <= detail; i++) {
          const t = i / detail;
          const mt = 1 - t;
          const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
          const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
          const p = map(x, y);
          out.push(`L${fmt(p.x)} ${fmt(p.y)}`);
        }
      };

      for (const seg of segs) {
        const v = seg.values;
        if (seg.type === "M") {
          const p = map(v[0], v[1]);
          out.push(`M${fmt(p.x)} ${fmt(p.y)}`);
          cx = sx = v[0];
          cy = sy = v[1];
        } else if (seg.type === "L") {
          const p = map(v[0], v[1]);
          out.push(`L${fmt(p.x)} ${fmt(p.y)}`);
          cx = v[0];
          cy = v[1];
        } else if (seg.type === "C") {
          sampleCubic(cx, cy, v[0], v[1], v[2], v[3], v[4], v[5]);
          cx = v[4];
          cy = v[5];
        } else if (seg.type === "Q") {
          for (let i = 1; i <= detail; i++) {
            const t = i / detail;
            const mt = 1 - t;
            const x = mt * mt * cx + 2 * mt * t * v[0] + t * t * v[2];
            const y = mt * mt * cy + 2 * mt * t * v[1] + t * t * v[3];
            const p = map(x, y);
            out.push(`L${fmt(p.x)} ${fmt(p.y)}`);
          }
          cx = v[2];
          cy = v[3];
        } else if (seg.type === "Z" || seg.type === "z") {
          out.push("Z");
          cx = sx;
          cy = sy;
        }
      }
      if (out.length) return out.join("");
    } catch {
      // fall through
    }
  }

  const len = path.getTotalLength();
  if (!len) return "";
  const steps = Math.max(16, Math.ceil(len / Math.max(0.5, 8 / detail)));
  const parts = [];
  for (let i = 0; i <= steps; i++) {
    const pt = path.getPointAtLength((i / steps) * len);
    const p = sourceUVToOutputXY(pt.x / srcW, pt.y / srcH, controls, outW, outH);
    parts.push(`${i === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`);
  }
  // Close if original path closed
  if (/[Zz]\s*$/.test(d.trim())) parts.push("Z");
  return parts.join("");
}

function buildWarpedSvgFromPaths(pathSet, controls) {
  const { paths, w: srcW, h: srcH } = pathSet;
  const outW = controls.outW;
  const outH = controls.outH;
  const detail = controls.pathDetail;

  const out = [];
  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">`,
  );
  if (controls.bgMode === "solid") {
    out.push(`<rect width="100%" height="100%" fill="${controls.bgColor}"/>`);
  }

  if (controls.edgeFade > 0) {
    const usableHalf = Math.max(0.01, 1 - controls.crop);
    const start = Math.max(0, Math.min(0.99, controls.fadeStart));
    const left = ((-usableHalf + 1) / 2) * outW;
    const right = ((usableHalf + 1) / 2) * outW;
    const x0 = ((-start * usableHalf + 1) / 2) * outW;
    const x1 = ((start * usableHalf + 1) / 2) * outW;
    const edgeAlpha = 1 - controls.edgeFade;
    const span = right - left || 1;
    out.push(`<defs><linearGradient id="edgeFadeGrad" gradientUnits="userSpaceOnUse" x1="${left}" y1="0" x2="${right}" y2="0">`);
    out.push(`<stop offset="0" stop-color="#fff" stop-opacity="${edgeAlpha.toFixed(3)}"/>`);
    out.push(`<stop offset="${((x0 - left) / span).toFixed(4)}" stop-color="#fff" stop-opacity="1"/>`);
    out.push(`<stop offset="${((x1 - left) / span).toFixed(4)}" stop-color="#fff" stop-opacity="1"/>`);
    out.push(`<stop offset="1" stop-color="#fff" stop-opacity="${edgeAlpha.toFixed(3)}"/>`);
    out.push(`</linearGradient>`);
    out.push(
      `<mask id="edgeFadeMask"><rect x="${left.toFixed(2)}" y="0" width="${span.toFixed(2)}" height="${outH}" fill="url(#edgeFadeGrad)"/></mask></defs>`,
    );
    out.push(`<g mask="url(#edgeFadeMask)">`);
  } else {
    out.push(`<g>`);
  }

  let count = 0;
  for (const src of paths) {
    const warped = warpPathD(src.d, controls, srcW, srcH, outW, outH, detail);
    if (!warped) continue;
    count++;
    let attrs = `d="${warped}"`;
    attrs += ` fill="${src.fill || "none"}"`;
    if (src.fill && src.fill !== "none" && src.fillOpacity != null && src.fillOpacity < 1) {
      attrs += ` fill-opacity="${src.fillOpacity}"`;
    }
    if (src.fillRule && src.fillRule !== "nonzero") attrs += ` fill-rule="${src.fillRule}"`;
    if (src.stroke && src.stroke !== "none") {
      attrs += ` stroke="${src.stroke}"`;
      if (src.strokeWidth) attrs += ` stroke-width="${src.strokeWidth}"`;
      if (src.strokeOpacity != null && src.strokeOpacity < 1) attrs += ` stroke-opacity="${src.strokeOpacity}"`;
    }
    out.push(`<path ${attrs}/>`);
  }
  out.push(`</g></svg>`);

  if (!count) throw new Error("Warp produced no paths");
  return out.join("");
}

function parseCssRgb(css) {
  if (!css || css === "none") return null;
  const s = String(css).trim().toLowerCase();
  if (s.startsWith("#")) {
    const n = s.slice(1);
    const hex =
      n.length === 3
        ? n
            .split("")
            .map((c) => c + c)
            .join("")
        : n;
    if (hex.length !== 6) return null;
    const v = parseInt(hex, 16);
    if (Number.isNaN(v)) return null;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function isNearWhiteCss(css) {
  const rgb = parseCssRgb(css);
  if (!rgb) return false;
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.92;
}

/** Knock out paper white and recolor remaining ink for vector export. */
function stylePathForArtworkExport(path, controls, inkColor) {
  let fill = path.fill && path.fill !== "none" ? path.fill : "none";
  let stroke = path.stroke && path.stroke !== "none" ? path.stroke : "none";
  const art = inkColor || controls.artColor || "#000000";

  if (controls.knockoutWhite) {
    if (fill !== "none" && isNearWhiteCss(fill)) fill = "none";
    if (stroke !== "none" && isNearWhiteCss(stroke)) stroke = "none";
  }

  if (fill !== "none") fill = art;
  if (stroke !== "none") stroke = art;

  return { ...path, fill, stroke };
}

/** Ink color for print PDF — light mockup colors become black so the file isn't blank. */
function printInkColor(controls) {
  const art = controls.artColor || "#000000";
  if (isNearWhiteCss(art)) return "#000000";
  const rgb = parseCssRgb(art);
  if (rgb) {
    const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    if (lum > 0.85) return "#000000";
  }
  return art;
}

/** Export frame = front-visible warped label band (not full bottle, not flat artboard). */
function warpedArtworkExportSize(controls, dpi = 300) {
  const g = bottleGeometry(controls);
  const mmW = Math.max(5, g.visibleLabelWidth * Math.max(0.2, controls.scaleX));
  const mmH = Math.max(5, g.labelHeight);
  const wPx = Math.max(64, Math.round((mmW / 25.4) * dpi));
  const hPx = Math.max(64, Math.round((mmH / 25.4) * dpi));
  return {
    mmW,
    mmH,
    wPx,
    hPx,
    pageWpt: mmW * MM_TO_PT,
    pageHpt: mmH * MM_TO_PT,
    dpi,
  };
}

function warpControlsForExport(controls) {
  return {
    ...controls,
    // Match bottle label composite: UV scaleY stays 1; band height is mmH
    scaleY: 1,
    artColor: printInkColor(controls),
    bgMode: "transparent",
    showGuides: false,
  };
}

/**
 * Cylinder-warped isolated artwork (same projection as the bottle label), rasterized.
 */
function renderWarpedArtworkCanvas(controls, dpi = 300) {
  if (!sourceData) throw new Error("No source artwork loaded");
  const size = warpedArtworkExportSize(controls, dpi);
  const image = warpToImageData(sourceData, warpControlsForExport(controls), size.wPx, size.hPx);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").putImageData(image, 0, 0);
  return { canvas, ...size };
}

/**
 * Warped vector SVG at label-band size. Styles ink like the mockup; returns null if no ink paths.
 */
function buildWarpedArtworkSvg(pathSet, controls) {
  const size = warpedArtworkExportSize(controls, 72);
  const ink = printInkColor(controls);
  const w = size.pageWpt;
  const h = size.pageHpt;
  const detail = controls.pathDetail;
  const wc = warpControlsForExport(controls);

  const out = [];
  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}">`,
  );

  let count = 0;
  const { paths, w: srcW, h: srcH } = pathSet;
  for (const src of paths) {
    const styled = stylePathForArtworkExport(src, controls, ink);
    if (styled.fill === "none" && styled.stroke === "none") continue;
    const warped = warpPathD(styled.d, wc, srcW, srcH, w, h, detail);
    if (!warped) continue;
    count++;
    let attrs = `d="${warped}"`;
    attrs += ` fill="${styled.fill}"`;
    if (styled.fill !== "none" && styled.fillOpacity != null && styled.fillOpacity < 1) {
      attrs += ` fill-opacity="${styled.fillOpacity}"`;
    }
    if (styled.fillRule && styled.fillRule !== "nonzero") attrs += ` fill-rule="${styled.fillRule}"`;
    if (styled.stroke !== "none") {
      attrs += ` stroke="${styled.stroke}"`;
      if (styled.strokeWidth) attrs += ` stroke-width="${styled.strokeWidth}"`;
    } else {
      attrs += ` stroke="none"`;
    }
    out.push(`<path ${attrs}/>`);
  }
  out.push(`</svg>`);
  if (!count) return null;
  return { svgText: out.join(""), ...size };
}

function buildWarpedArtworkSvgFromRaster(controls) {
  const dpi = Math.max(150, Math.min(600, Number(els.sourceDpi.value) || 300));
  const { canvas, pageWpt, pageHpt, mmW, mmH, dpi: usedDpi } = renderWarpedArtworkCanvas(controls, dpi);
  const dataUrl = canvas.toDataURL("image/png");
  const svgText = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(pageWpt)}" height="${fmt(pageHpt)}" viewBox="0 0 ${fmt(pageWpt)} ${fmt(pageHpt)}">`,
    `<image width="${fmt(pageWpt)}" height="${fmt(pageHpt)}" href="${dataUrl}" xlink:href="${dataUrl}"/>`,
    `</svg>`,
  ].join("");
  return { svgText, pageWpt, pageHpt, mmW, mmH, dpi: usedDpi };
}

async function exportWarpedArtworkPdfFromRaster(controls) {
  await loadScriptOnce(
    "jspdf-umd",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  );
  const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFCtor) throw new Error("jsPDF failed to load");

  const dpi = Math.max(150, Math.min(600, Number(els.sourceDpi.value) || 300));
  const { canvas, pageWpt, pageHpt, mmW, mmH, dpi: usedDpi } = renderWarpedArtworkCanvas(controls, dpi);
  const doc = new jsPDFCtor({
    unit: "pt",
    format: [Math.max(1, pageWpt), Math.max(1, pageHpt)],
    compress: true,
  });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWpt, pageHpt);
  return { blob: doc.output("blob"), dpi: usedDpi, mmW, mmH };
}

async function getVectorPathSet() {
  if (sourceKind === "pdf" && sourcePdfBytes) {
    const pageNum = Number(els.pdfPage.value) || 1;
    return extractPdfVectorPaths(sourcePdfBytes, pageNum);
  }
  if (sourceKind === "svg" && sourceSvgText && sourceVectorSize) {
    return extractSvgVectorPaths(sourceSvgText, sourceVectorSize.w, sourceVectorSize.h);
  }
  throw new Error("Reload the PDF/SVG to enable vector export");
}

async function exportSvg() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting warped artwork SVG…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));
  try {
    let result;
    let mode = "vector";
    try {
      const pathSet = await getVectorPathSet();
      result = buildWarpedArtworkSvg(pathSet, controls);
      if (!result) throw new Error("NO_VECTOR_INK");
    } catch (vecErr) {
      console.warn("Vector warp SVG unavailable, using raster:", vecErr);
      setStatus("Warping artwork (raster)…");
      result = buildWarpedArtworkSvgFromRaster(controls);
      mode = `raster ${result.dpi}dpi`;
    }
    downloadBlob(
      new Blob([result.svgText], { type: "image/svg+xml" }),
      `${exportBaseName()}-warped-${exportStamp()}.svg`,
    );
    setStatus(
      `Exported warped SVG ${result.mmW.toFixed(1)}×${result.mmH.toFixed(1)} mm (${(result.svgText.length / 1024).toFixed(0)} KB · ${mode})`,
    );
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "SVG export failed");
  } finally {
    setExportBusy(false);
  }
}

async function exportPdf() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting warped artwork PDF…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));

  try {
    let blob = null;
    let mode = "vector";
    let mmW;
    let mmH;

    try {
      const pathSet = await getVectorPathSet();
      const result = buildWarpedArtworkSvg(pathSet, controls);
      if (!result) throw new Error("NO_VECTOR_INK");
      setStatus("Writing warped vector PDF…");
      blob = await svgTextToPdfBlob(result.svgText, result.pageWpt, result.pageHpt);
      if (!blob || blob.size < 200) throw new Error("empty vector pdf");
      mmW = result.mmW;
      mmH = result.mmH;
    } catch (vecErr) {
      console.warn("Vector warp PDF unavailable, using raster:", vecErr);
      setStatus("Warping artwork (raster)…");
      const raster = await exportWarpedArtworkPdfFromRaster(controls);
      blob = raster.blob;
      mode = `raster ${raster.dpi}dpi`;
      mmW = raster.mmW;
      mmH = raster.mmH;
    }

    downloadBlob(blob, `${exportBaseName()}-warped-${exportStamp()}.pdf`);
    const inkNote = isNearWhiteCss(controls.artColor) ? " · ink black" : "";
    setStatus(
      `Exported warped PDF ${mmW.toFixed(1)}×${mmH.toFixed(1)} mm (${(blob.size / 1024).toFixed(0)} KB · ${mode}${inkNote})`,
    );
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "PDF export failed");
  } finally {
    setExportBusy(false);
  }
}

async function svgTextToPdfBlob(svgText, pageWpt, pageHpt) {
  // Load UMD builds so svg2pdf can attach to the same jsPDF instance.
  // The ESM build exports svg2pdf(el, pdf, opts) and does not reliably patch doc.svg.
  await loadScriptOnce(
    "jspdf-umd",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  );
  await loadScriptOnce(
    "svg2pdf-umd",
    "https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js",
  );

  const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
  const svg2pdfFn = window.svg2pdf;
  if (!jsPDFCtor) throw new Error("jsPDF failed to load");

  const w = Math.max(1, pageWpt);
  const h = Math.max(1, pageHpt);
  const doc = new jsPDFCtor({ unit: "pt", format: [w, h], compress: true });

  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svgEl = parsed.documentElement;
  if (!svgEl || svgEl.querySelector("parsererror") || svgEl.tagName.toLowerCase() !== "svg") {
    throw new Error("Failed to build artwork SVG");
  }
  // svg2pdf is happiest with unitless pt-sized width/height matching the page
  svgEl.setAttribute("width", String(w));
  svgEl.setAttribute("height", String(h));

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;";
  container.appendChild(document.importNode(svgEl, true));
  document.body.appendChild(container);
  const liveSvg = container.querySelector("svg");
  try {
    if (typeof doc.svg === "function") {
      await doc.svg(liveSvg, { x: 0, y: 0, width: w, height: h });
    } else if (typeof svg2pdfFn === "function") {
      await svg2pdfFn(liveSvg, doc, { x: 0, y: 0, width: w, height: h });
    } else {
      throw new Error("svg2pdf failed to load");
    }
  } finally {
    container.remove();
  }
  return doc.output("blob");
}

function loadScriptOnce(id, src) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadSvgFile(file) {
  const text = await file.text();
  sourceSvgText = text;
  sourcePdfBytes = null;
  sourceKind = "svg";

  const size = parseSvgSize(text);
  sourceVectorSize = { w: size.w, h: size.h };

  const svg = new Blob([text], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svg);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Could not decode SVG"));
      img.src = url;
    });

    let w = img.naturalWidth || size.w;
    let h = img.naturalHeight || size.h;
    w = w || 1024;
    h = h || 1024;
    sourceVectorSize = { w: size.w || w, h: size.h || h };

    // Upscale tiny SVGs so warp sampling stays sharp
    const minEdge = 1600;
    const scale = Math.max(1, minEdge / Math.min(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPdfFile(file, pageNum, dpi) {
  const buffer = await file.arrayBuffer();
  sourcePdfBytes = buffer.slice(0);
  sourceSvgText = null;
  sourceKind = "pdf";

  pdfDoc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const pageCount = pdfDoc.numPages;
  els.pdfPage.max = String(pageCount);
  const page = Math.min(Math.max(1, pageNum), pageCount);
  els.pdfPage.value = String(page);

  const pdfPage = await pdfDoc.getPage(page);
  const unscaled = pdfPage.getViewport({ scale: 1 });
  sourceVectorSize = { w: unscaled.width, h: unscaled.height };
  const scale = dpi / 72;
  const viewport = pdfPage.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.round(viewport.width);
  c.height = Math.round(viewport.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  setStatus(`PDF page ${page}/${pageCount} · ${c.width}×${c.height} @ ${dpi} DPI (native ${Math.round(unscaled.width)}×${Math.round(unscaled.height)} pt)`);
  return c;
}

async function ingestFile(file) {
  if (!file) return;
  const name = file.name || "artwork";
  const lower = name.toLowerCase();
  sourceName = name;
  els.fileLabel.textContent = name;
  setStatus(`Loading ${name}…`);
  setExportBusy(true);

  try {
    let canvas;
    if (lower.endsWith(".svg") || file.type === "image/svg+xml") {
      pdfDoc = null;
      canvas = await loadSvgFile(file);
    } else if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      canvas = await loadPdfFile(file, Number(els.pdfPage.value) || 1, Number(els.sourceDpi.value) || 300);
    } else {
      throw new Error("Please upload a PDF or SVG file");
    }

    sourceCanvas = canvas;
    sourceData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    setStatus(`Loaded ${name} · ${canvas.width}×${canvas.height}`);
    scheduleRender();
  } catch (err) {
    console.error(err);
    sourceKind = "";
    sourcePdfBytes = null;
    sourceSvgText = null;
    setStatus(err?.message || "Failed to load file");
    setExportBusy(true);
  }
}

async function reloadPdfPage() {
  if (!pdfDoc || !sourceName.toLowerCase().endsWith(".pdf")) return;
  setStatus("Reloading PDF page…");
  try {
    const page = Number(els.pdfPage.value) || 1;
    const dpi = Number(els.sourceDpi.value) || 300;
    const pdfPage = await pdfDoc.getPage(Math.min(Math.max(1, page), pdfDoc.numPages));
    const viewport = pdfPage.getViewport({ scale: dpi / 72 });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    sourceCanvas = c;
    sourceData = ctx.getImageData(0, 0, c.width, c.height);
    scheduleRender();
  } catch (err) {
    setStatus(err?.message || "Failed to reload page");
  }
}

function resetControls() {
  const vessel = activeVessel();
  els.labelWidth.value = vessel.defaultLabelWidth;
  els.labelHeight.value = vessel.defaultLabelHeight;
  els.curvature.value = DEFAULTS.curvature;
  els.edgeWarp.value = DEFAULTS.edgeWarp;
  els.vBow.value = DEFAULTS.vBow;
  els.perspective.value = DEFAULTS.perspective;
  els.scaleX.value = DEFAULTS.scaleX;
  els.scaleY.value = DEFAULTS.scaleY;
  els.rotate.value = DEFAULTS.rotate;
  els.offsetX.value = DEFAULTS.offsetX;
  els.offsetY.value = DEFAULTS.offsetY;
  els.edgeFade.value = DEFAULTS.edgeFade;
  els.fadeStart.value = DEFAULTS.fadeStart;
  els.crop.value = DEFAULTS.crop;
  els.clipCylinder.checked = DEFAULTS.clipCylinder;
  els.showGuides.checked = DEFAULTS.showGuides;
  els.showMockup.checked = DEFAULTS.showMockup;
  els.matchAspect.checked = DEFAULTS.matchAspect;
  els.knockoutWhite.checked = DEFAULTS.knockoutWhite;
  els.artColor.value = DEFAULTS.artColor;
  els.outW.value = vessel.defaultOutW;
  els.outH.value = vessel.defaultOutH;
  els.bgMode.value = DEFAULTS.bgMode;
  els.bgColor.value = DEFAULTS.bgColor;
  els.pathDetail.value = DEFAULTS.pathDetail;
  els.pdfPage.value = DEFAULTS.pdfPage;
  els.sourceDpi.value = DEFAULTS.sourceDpi;
  saveSettings();
  scheduleRender();
}

function fitOutputToSource() {
  if (!sourceCanvas) return;
  const controls = readControls();
  if (controls.matchAspect) {
    const h = Math.min(2400, Math.max(400, Math.round(sourceCanvas.height)));
    els.outH.value = h;
    let aspect;
    if (controls.showMockup && mockupImage) {
      const { w: mw, h: mh } = mockupSize(mockupImage);
      aspect = mw / mh;
    } else {
      const g = bottleGeometry(controls);
      aspect = g.width / g.labelHeight;
    }
    els.outW.value = Math.max(64, Math.round(h * aspect));
  } else {
    const maxW = 2400;
    const scale = Math.min(1, maxW / sourceCanvas.width);
    els.outW.value = Math.round(sourceCanvas.width * scale);
    els.outH.value = Math.round(sourceCanvas.height * scale);
  }
  scheduleRender();
}

function bindUi() {
  const onFile = (file) => ingestFile(file);

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) onFile(file);
  });

  ["dragenter", "dragover"].forEach((evt) => {
    document.addEventListener(evt, (e) => e.preventDefault());
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  const persistAndRender = () => {
    saveSettings();
    scheduleRender();
  };

  els.vessel.addEventListener("change", () => {
    switchVessel(els.vessel.value, { applyLabelDefaults: true });
  });

  const live = [
    els.labelWidth,
    els.labelHeight,
    els.curvature,
    els.edgeWarp,
    els.vBow,
    els.perspective,
    els.scaleX,
    els.scaleY,
    els.rotate,
    els.offsetX,
    els.offsetY,
    els.edgeFade,
    els.fadeStart,
    els.crop,
    els.clipCylinder,
    els.showGuides,
    els.showMockup,
    els.matchAspect,
    els.knockoutWhite,
    els.artColor,
    els.outW,
    els.outH,
    els.bgMode,
    els.bgColor,
    els.pathDetail,
  ];
  live.forEach((el) => {
    el.addEventListener("input", persistAndRender);
    el.addEventListener("change", persistAndRender);
  });

  els.pdfPage.addEventListener("change", () => {
    saveSettings();
    reloadPdfPage();
  });
  els.sourceDpi.addEventListener("change", () => {
    saveSettings();
    reloadPdfPage();
  });

  els.btnReset.addEventListener("click", resetControls);
  els.btnExport.addEventListener("click", exportPng);
  els.btnExportPdf.addEventListener("click", exportPdf);
  els.btnExportSvg.addEventListener("click", exportSvg);
  els.btnFit.addEventListener("click", () => {
    fitOutputToSource();
    saveSettings();
  });
  els.btnRedraw.addEventListener("click", () => {
    renderToken++;
    renderPreview();
  });

  scheduleRender();
}

loadSettings();
loadMockup().then(() => {
  bindUi();
  setStatus(`Upload a PDF or SVG — it will wrap onto the ${activeVessel().kind} mockup`);
  scheduleRender();
});
