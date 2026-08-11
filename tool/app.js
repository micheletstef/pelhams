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
  vesselFinish: $("vessel-finish"),
  vesselFinishRow: $("vessel-finish-row"),
  bottleStats: $("bottle-stats"),
  labelWidth: $("label-width"),
  labelHeight: $("label-height"),
  lockLabelSize: $("lock-label-size"),
  labelScale: $("label-scale"),
  labelScaleVal: $("label-scale-val"),
  btnNativeSize: $("btn-native-size"),
  labelArcReadout: $("label-arc-readout"),
  btnResetProjection: $("btn-reset-projection"),
  foldProjection: $("fold-projection"),
  foldShading: $("fold-shading"),
  projectionEnabled: $("projection-enabled"),
  shadingEnabled: $("shading-enabled"),
  edgeCurve: $("edge-curve"),
  innerCurve: $("inner-curve"),
  curveStart: $("curve-start"),
  curveBlend: $("curve-blend"),
  vertCurve: $("vert-curve"),
  edgeCurveVal: $("edge-curve-val"),
  innerCurveVal: $("inner-curve-val"),
  curveStartVal: $("curve-start-val"),
  curveBlendVal: $("curve-blend-val"),
  vertCurveVal: $("vert-curve-val"),
  rotate: $("rotate"),
  offsetX: $("offset-x"),
  offsetY: $("offset-y"),
  edgeFade: $("edge-fade"),
  fadeStart: $("fade-start"),
  crop: $("crop"),
  showMockup: $("show-mockup"),
  knockoutWhite: $("knockout-white"),
  artColor: $("art-color"),
  paperColor: $("paper-color"),
  artBlend: $("art-blend"),
  exportTarget: $("export-target"),
  outW: $("out-w"),
  outH: $("out-h"),
  btnReset: $("btn-reset"),
  btnExport: $("btn-export"),
  btnExportPdf: $("btn-export-pdf"),
  btnExportSvg: $("btn-export-svg"),
  btnFit: $("btn-fit"),
  btnRedraw: $("btn-redraw"),
  preview: $("preview"),
  viewport: $("viewport"),
  viewportStage: $("viewport-stage"),
  rotateVal: $("rotate-val"),
  offsetXVal: $("offset-x-val"),
  offsetYVal: $("offset-y-val"),
  edgeFadeVal: $("edge-fade-val"),
  fadeStartVal: $("fade-start-val"),
  cropVal: $("crop-val"),
};

/**
 * Selectable vessels. Each has physical mm dims + a photo mockup calibration.
 * Bottles: Univerre Rheinwein 75cl, Vetropack Keule 500ml.
 * Can: standard EU 330 ml (Ø66.2 × 115.2 mm).
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
    // Parallel body band on SM_PEL_* can mockups (540×1024)
    labelPanel: 91,
    frontSrc: "assets/can-soft-metal.jpg",
    frontNote: "Standard 330 ml can mockup",
    bodyTopFrac: 0.148,
    bodyBotFrac: 0.922,
    // Full wrap ≈ π × Ø
    defaultLabelWidth: 208,
    defaultLabelHeight: 91,
    defaultOutW: 540,
    defaultOutH: 1024,
    defaultFinish: "softMetal",
    finishes: {
      white: {
        label: "White",
        src: "assets/can-white.jpg",
        highlightStrength: 0.25,
      },
      softMetal: {
        label: "Soft metal",
        src: "assets/can-soft-metal.jpg",
        highlightStrength: 0.5,
      },
      glossyMetal: {
        label: "Glossy metal",
        src: "assets/can-glossy-metal.jpg",
        highlightStrength: 0.7,
      },
    },
    mockup: {
      src: "assets/can-soft-metal.jpg",
      bodyTopFrac: 0.148,
      bodyBotFrac: 0.922,
      bodyLeftFrac: 0.002,
      bodyRightFrac: 0.998,
      highlightStrength: 0.5,
      bgKnockoutLum: 14,
    },
  },
  // https://katalog.vetropack.com/catalogue/detail/28080
  keule500: {
    id: "keule500",
    name: "Keule Softdrink 500ml",
    kind: "bottle",
    diameter: 70.1,
    height: 227.5,
    // Parallel body on SM_KeuleBottle.png
    labelPanel: 123,
    frontSrc: "assets/keule-mockup-hr.png",
    frontNote: "Vetropack Art. 28080 · MC287R",
    bodyTopFrac: 0.4,
    bodyBotFrac: 0.94,
    defaultLabelWidth: 120,
    defaultLabelHeight: 123,
    defaultOutW: 690,
    defaultOutH: 2297,
    mockup: {
      src: "assets/keule-mockup-hr.png",
      bodyTopFrac: 0.4,
      bodyBotFrac: 0.94,
      bodyLeftFrac: 0.01,
      bodyRightFrac: 0.988,
      highlightStrength: 0.4,
      bgKnockoutLum: 14,
    },
  },
};

const DEFAULT_VESSEL_ID = "bottle75cl";

function activeVessel() {
  return VESSELS[els.vessel?.value] || VESSELS[DEFAULT_VESSEL_ID];
}

function vesselHasFinishes(vessel = activeVessel()) {
  return Boolean(vessel?.finishes && Object.keys(vessel.finishes).length);
}

function activeFinishId(vessel = activeVessel()) {
  if (!vesselHasFinishes(vessel)) return null;
  const id = els.vesselFinish?.value;
  if (id && vessel.finishes[id]) return id;
  if (vessel.defaultFinish && vessel.finishes[vessel.defaultFinish]) {
    return vessel.defaultFinish;
  }
  return Object.keys(vessel.finishes)[0];
}

function syncVesselFinishUi(vessel = activeVessel()) {
  const row = els.vesselFinishRow;
  const select = els.vesselFinish;
  if (!row || !select) return;
  // Finish options are only for the 330 ml can.
  const showFinish = vessel?.id === "can330" && vesselHasFinishes(vessel);
  row.hidden = !showFinish;
  if (!showFinish) return;

  const finishIds = Object.keys(vessel.finishes);
  const optionsMatch =
    select.options.length === finishIds.length &&
    finishIds.every((id, i) => select.options[i]?.value === id);
  if (!optionsMatch) {
    select.innerHTML = finishIds
      .map((id) => {
        const label = vessel.finishes[id].label || id;
        return `<option value="${id}">${label}</option>`;
      })
      .join("");
  }

  const next = activeFinishId(vessel);
  if (next && select.value !== next) select.value = next;
}

function activeMockup() {
  const vessel = activeVessel();
  const base = vessel.mockup;
  const finishId = activeFinishId(vessel);
  if (!finishId) return base;
  const finish = vessel.finishes[finishId];
  return {
    ...base,
    src: finish.src,
    highlightStrength: finish.highlightStrength ?? base.highlightStrength,
    bgKnockoutLum: finish.bgKnockoutLum ?? base.bgKnockoutLum,
  };
}

const DEFAULTS = {
  vessel: DEFAULT_VESSEL_ID,
  vesselFinish: "softMetal",
  labelWidth: 120,
  labelHeight: 105,
  lockLabelSize: true,
  labelScale: 1,
  projectionEnabled: true,
  shadingEnabled: true,
  edgeCurve: 0,
  innerCurve: 0,
  curveStart: 50,
  curveBlend: 0,
  vertCurve: 0,
  rotate: 0,
  offsetX: 0,
  offsetY: 0,
  edgeFade: 0,
  fadeStart: 60,
  crop: 0,
  showMockup: true,
  knockoutWhite: true,
  artColor: "#000000",
  paperColor: "#ffffff",
  artBlend: "opaque",
  exportTarget: "artwork",
  outW: 424,
  outH: 2068,
  bgMode: "transparent",
  bgColor: "#808080",
  pdfPage: 1,
  sourceDpi: 300,
  pathDetail: 12,
};

const EXPORT_TARGETS = new Set(["artwork", "mockup"]);

function resolveExportTarget(value) {
  return EXPORT_TARGETS.has(value) ? value : DEFAULTS.exportTarget;
}

const STORAGE_KEY = "pelham-cylinder-wrap-v1";
const STORAGE_VERSION = 2;

/** Controls that differ per vessel (scale, warp, placement, sizes, finish). */
const VESSEL_SETTING_KEYS = [
  "vesselFinish",
  "labelWidth",
  "labelHeight",
  "lockLabelSize",
  "labelScale",
  "projectionEnabled",
  "shadingEnabled",
  "edgeCurve",
  "innerCurve",
  "curveStart",
  "curveBlend",
  "vertCurve",
  "rotate",
  "offsetX",
  "offsetY",
  "edgeFade",
  "fadeStart",
  "crop",
  "showMockup",
  "outW",
  "outH",
];

/** Artwork / export controls shared across vessels. */
const GLOBAL_SETTING_KEYS = [
  "knockoutWhite",
  "artColor",
  "paperColor",
  "artBlend",
  "exportTarget",
  "pdfPage",
  "sourceDpi",
];

const MM_TO_PT = 72 / 25.4;

/** UI blend id → canvas globalCompositeOperation */
const ART_BLEND_OPS = {
  opaque: "source-over",
  multiply: "multiply",
  darken: "darken",
  lighten: "lighten",
  screen: "screen",
  overlay: "overlay",
  "soft-light": "soft-light",
  "hard-light": "hard-light",
  "color-burn": "color-burn",
  "color-dodge": "color-dodge",
};

function resolveArtBlend(blend) {
  return ART_BLEND_OPS[blend] ? blend : DEFAULTS.artBlend;
}

function artBlendOp(blend) {
  return ART_BLEND_OPS[resolveArtBlend(blend)] || "source-over";
}

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
/** @type {{ w: number, h: number } | null} Native artwork size in mm */
let sourceNativeMm = null;
let sourceKind = ""; // "pdf" | "svg"
let sourceName = "";
let renderToken = 0;
let rafPending = 0;

const PT_TO_MM = 25.4 / 72;
const PX_TO_MM = 25.4 / 96;

function ptsToMm(pt) {
  return pt * PT_TO_MM;
}

/** Parse an SVG length (e.g. "120mm", "340") into millimetres. */
function svgLengthToMm(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const m = s.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)\s*(mm|cm|in|pt|pc|px|%)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || "").toLowerCase();
  if (u === "mm") return n;
  if (u === "cm") return n * 10;
  if (u === "in") return n * 25.4;
  if (u === "pt") return ptsToMm(n);
  if (u === "pc") return ptsToMm(n * 12);
  if (u === "px") return n * PX_TO_MM;
  if (u === "%") return null;
  // Unitless: treat as PDF-style points (common for print SVGs)
  return ptsToMm(n);
}

function setSourceNativeMm(wMm, hMm) {
  const w = Math.max(1, Math.round(wMm * 100) / 100);
  const h = Math.max(1, Math.round(hMm * 100) / 100);
  sourceNativeMm = { w, h };
  return sourceNativeMm;
}

function applyNativeLabelSize({ force = false } = {}) {
  if (!sourceNativeMm) return false;
  const locked = els.lockLabelSize?.checked ?? DEFAULTS.lockLabelSize;
  if (!force && !locked) return false;
  els.labelWidth.value = String(sourceNativeMm.w);
  els.labelHeight.value = String(sourceNativeMm.h);
  return true;
}

function syncLabelSizeLockUi() {
  const locked = els.lockLabelSize?.checked ?? false;
  if (els.labelWidth) els.labelWidth.disabled = locked;
  if (els.labelHeight) els.labelHeight.disabled = locked;
  if (els.btnNativeSize) els.btnNativeSize.disabled = !sourceNativeMm;
}

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
  // Prefer artwork native size when locked; otherwise vessel defaults.
  if (!applyNativeLabelSize()) {
    els.labelWidth.value = String(vessel.defaultLabelWidth);
    els.labelHeight.value = String(vessel.defaultLabelHeight);
  }
  els.outW.value = String(vessel.defaultOutW);
  els.outH.value = String(vessel.defaultOutH);
}

/** Fresh vessel visit: vessel knobs → defaults, then catalog label/out sizes. */
function applyFreshVesselSettings(vessel = activeVessel()) {
  const finish =
    vessel.defaultFinish && vessel.finishes?.[vessel.defaultFinish]
      ? vessel.defaultFinish
      : DEFAULTS.vesselFinish;
  applySettings({
    ...pickSettingKeys(DEFAULTS, VESSEL_SETTING_KEYS),
    vesselFinish: finish,
    labelWidth: vessel.defaultLabelWidth,
    labelHeight: vessel.defaultLabelHeight,
    outW: vessel.defaultOutW,
    outH: vessel.defaultOutH,
  });
  applyVesselLabelDefaults(vessel);
}

/** Last committed vessel id — select value changes before the `change` handler runs. */
let committedVesselId = DEFAULT_VESSEL_ID;

async function switchVessel(vesselId, { applyLabelDefaults = true } = {}) {
  if (!VESSELS[vesselId]) vesselId = DEFAULT_VESSEL_ID;
  // Persist knobs under the vessel we're leaving (DOM may already show the new id).
  if (committedVesselId && VESSELS[committedVesselId] && committedVesselId !== vesselId) {
    saveSettings({ vesselId: committedVesselId });
  }
  els.vessel.value = vesselId;
  syncVesselFinishUi();

  const store = readSettingsStore();
  const saved = store.byVessel[vesselId];
  if (saved) {
    applySettings({ vessel: vesselId, ...store.global, ...saved });
  } else if (applyLabelDefaults) {
    applyFreshVesselSettings();
  }

  committedVesselId = vesselId;
  setStatus(`Loading ${activeVessel().name}…`);
  await loadMockup();
  saveSettings();
  scheduleRender();
  setStatus(`Ready — ${activeVessel().name}`);
}

async function switchVesselFinish(finishId) {
  const vessel = activeVessel();
  if (!vesselHasFinishes(vessel)) return;
  if (!vessel.finishes[finishId]) finishId = activeFinishId(vessel);
  if (els.vesselFinish) els.vesselFinish.value = finishId;
  setStatus(`Loading ${vessel.finishes[finishId]?.label || finishId} finish…`);
  await loadMockup();
  saveSettings();
  scheduleRender();
  setStatus(`Ready — ${vessel.name} · ${vessel.finishes[finishId]?.label || finishId}`);
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
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Speculars are bright + near-neutral. Skip colored body/liquid (e.g. juice).
    const chroma = maxC - minC;
    if (maxC < 205 || chroma > 45) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    const t = Math.max(0, (maxC - 205) / 50);
    const v = Math.round(255 * t * t);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function setStatus(msg) {
  if (!msg) return;
  if (els.fileLabel) {
    els.fileLabel.dataset.status = msg;
    els.fileLabel.title = msg;
  }
  // Visible feedback for export (status bar was removed)
  let el = document.getElementById("export-status");
  if (!el) {
    el = document.createElement("p");
    el.id = "export-status";
    el.className = "stats muted";
    const row = els.btnExportPdf?.closest("fieldset") || els.fileLabel?.parentElement;
    row?.appendChild(el);
  }
  el.textContent = msg;
}

let viewZoom = 1;
let viewPanX = 0;
let viewPanY = 0;
const VIEW_ZOOM_MIN = 0.2;
const VIEW_ZOOM_MAX = 8;

function viewIsTransformed() {
  return Math.abs(viewZoom - 1) > 0.001 || Math.abs(viewPanX) > 0.5 || Math.abs(viewPanY) > 0.5;
}

function applyViewTransform() {
  if (!els.viewportStage) return;
  els.viewportStage.style.transform = `translate(${viewPanX}px, ${viewPanY}px) scale(${viewZoom})`;
  if (els.viewport) {
    els.viewport.classList.toggle("is-zoomed", viewIsTransformed());
    els.viewport.classList.toggle("is-panning", Boolean(els.viewport.dataset.panning));
  }
}

function resetViewTransform() {
  viewZoom = 1;
  viewPanX = 0;
  viewPanY = 0;
  applyViewTransform();
}

function bindViewerZoom() {
  if (!els.viewport) return;
  const vp = els.viewport;

  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      viewZoom = Math.min(VIEW_ZOOM_MAX, Math.max(VIEW_ZOOM_MIN, viewZoom * factor));
      applyViewTransform();
    },
    { passive: false },
  );

  vp.addEventListener("dblclick", () => {
    resetViewTransform();
  });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  vp.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !viewIsTransformed()) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    vp.dataset.panning = "1";
    vp.classList.add("is-panning");
    vp.setPointerCapture(e.pointerId);
  });

  vp.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    viewPanX += e.clientX - lastX;
    viewPanY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyViewTransform();
  });

  const endPan = (e) => {
    if (!dragging) return;
    dragging = false;
    delete vp.dataset.panning;
    vp.classList.remove("is-panning");
    try {
      vp.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };
  vp.addEventListener("pointerup", endPan);
  vp.addEventListener("pointercancel", endPan);

  applyViewTransform();
}

/** Physical vessel + label geometry derived from mm inputs. */
function bottleGeometry(controls) {
  const vessel = activeVessel();
  const diameter = vessel.diameter;
  const radius = diameter / 2;
  const circumference = Math.PI * diameter;
  const bottleHeight = vessel.height;
  const scale = Math.max(0.05, controls.labelScale || 1);
  const labelWidth = Math.max(0.1, controls.labelWidth * scale);
  const labelHeight = Math.max(0.1, controls.labelHeight * scale);
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
    vesselFinish: els.vesselFinish?.value || DEFAULTS.vesselFinish,
    labelWidth: els.labelWidth.value,
    labelHeight: els.labelHeight.value,
    lockLabelSize: els.lockLabelSize.checked,
    labelScale: els.labelScale.value,
    projectionEnabled: els.projectionEnabled?.checked ?? true,
    shadingEnabled: els.shadingEnabled?.checked ?? true,
    edgeCurve: els.edgeCurve.value,
    innerCurve: els.innerCurve.value,
    curveStart: els.curveStart.value,
    curveBlend: els.curveBlend.value,
    vertCurve: els.vertCurve.value,
    rotate: els.rotate.value,
    offsetX: els.offsetX.value,
    offsetY: els.offsetY.value,
    edgeFade: els.edgeFade.value,
    fadeStart: els.fadeStart.value,
    crop: els.crop.value,
    showMockup: els.showMockup.checked,
    knockoutWhite: els.knockoutWhite.checked,
    artColor: els.artColor.value,
    paperColor: els.paperColor.value,
    artBlend: els.artBlend.value,
    exportTarget: els.exportTarget.value,
    outW: els.outW.value,
    outH: els.outH.value,
    pdfPage: els.pdfPage.value,
    sourceDpi: els.sourceDpi.value,
  };
}

function pickSettingKeys(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const key of keys) {
    if (obj[key] != null) out[key] = obj[key];
  }
  return out;
}

function emptySettingsStore() {
  return {
    version: STORAGE_VERSION,
    activeVessel: DEFAULT_VESSEL_ID,
    global: {},
    byVessel: {},
  };
}

/** Migrate flat v1 blobs into per-vessel store shape. */
function migrateSettingsStore(parsed) {
  if (parsed?.version === STORAGE_VERSION && parsed.byVessel && typeof parsed.byVessel === "object") {
    return {
      version: STORAGE_VERSION,
      activeVessel:
        parsed.activeVessel && VESSELS[parsed.activeVessel]
          ? parsed.activeVessel
          : DEFAULT_VESSEL_ID,
      global: pickSettingKeys(parsed.global || {}, GLOBAL_SETTING_KEYS),
      byVessel: parsed.byVessel,
    };
  }

  const store = emptySettingsStore();
  if (!parsed || typeof parsed !== "object") return store;
  const vessel =
    parsed.vessel && VESSELS[parsed.vessel] ? parsed.vessel : DEFAULT_VESSEL_ID;
  store.activeVessel = vessel;
  store.global = pickSettingKeys(parsed, GLOBAL_SETTING_KEYS);
  store.byVessel[vessel] = pickSettingKeys(parsed, VESSEL_SETTING_KEYS);
  return store;
}

function readSettingsStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySettingsStore();
    return migrateSettingsStore(JSON.parse(raw));
  } catch {
    return emptySettingsStore();
  }
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
  syncVesselFinishUi();
  if (s.vesselFinish && els.vesselFinish) {
    const vessel = activeVessel();
    if (vessel.finishes?.[s.vesselFinish]) els.vesselFinish.value = s.vesselFinish;
  }
  setVal(els.labelWidth, "labelWidth");
  setVal(els.labelHeight, "labelHeight");
  setCheck(els.lockLabelSize, "lockLabelSize");
  setVal(els.labelScale, "labelScale");
  setCheck(els.projectionEnabled, "projectionEnabled");
  setCheck(els.shadingEnabled, "shadingEnabled");
  setVal(els.edgeCurve, "edgeCurve");
  setVal(els.innerCurve, "innerCurve");
  setVal(els.curveStart, "curveStart");
  setVal(els.curveBlend, "curveBlend");
  setVal(els.vertCurve, "vertCurve");
  setVal(els.rotate, "rotate");
  setVal(els.offsetX, "offsetX");
  setVal(els.offsetY, "offsetY");
  setVal(els.edgeFade, "edgeFade");
  setVal(els.fadeStart, "fadeStart");
  setVal(els.crop, "crop");
  syncSectionToggles();
  setCheck(els.showMockup, "showMockup");
  setCheck(els.knockoutWhite, "knockoutWhite");
  setVal(els.artColor, "artColor");
  setVal(els.paperColor, "paperColor");
  if (s.artBlend != null && ART_BLEND_OPS[s.artBlend] && els.artBlend) {
    els.artBlend.value = s.artBlend;
  }
  if (s.exportTarget != null && EXPORT_TARGETS.has(s.exportTarget) && els.exportTarget) {
    els.exportTarget.value = s.exportTarget;
  }
  setVal(els.outW, "outW");
  setVal(els.outH, "outH");
  setVal(els.pdfPage, "pdfPage");
  setVal(els.sourceDpi, "sourceDpi");
}

/**
 * Persist current controls.
 * @param {{ vesselId?: string }} [opts] — store vessel knobs under this id
 *   (defaults to the select value). Use when the select already moved but
 *   the visible knobs still belong to the previous vessel.
 */
function saveSettings({ vesselId } = {}) {
  try {
    const all = collectSettings();
    const sliceId =
      vesselId && VESSELS[vesselId]
        ? vesselId
        : all.vessel && VESSELS[all.vessel]
          ? all.vessel
          : DEFAULT_VESSEL_ID;
    const activeId =
      all.vessel && VESSELS[all.vessel] ? all.vessel : sliceId;
    const store = readSettingsStore();
    store.activeVessel = activeId;
    store.global = {
      ...store.global,
      ...pickSettingKeys(all, GLOBAL_SETTING_KEYS),
    };
    store.byVessel[sliceId] = pickSettingKeys(all, VESSEL_SETTING_KEYS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

function loadSettings() {
  try {
    const store = readSettingsStore();
    const vesselId =
      store.activeVessel && VESSELS[store.activeVessel]
        ? store.activeVessel
        : DEFAULT_VESSEL_ID;
    const vesselSettings = store.byVessel[vesselId] || {};
    applySettings({
      vessel: vesselId,
      ...store.global,
      ...vesselSettings,
    });
    committedVesselId = vesselId;
  } catch {
    /* ignore corrupt data */
  }
}

function syncSectionToggles() {
  const projOn = els.projectionEnabled?.checked ?? true;
  const shadeOn = els.shadingEnabled?.checked ?? true;
  els.foldProjection?.classList.toggle("is-disabled", !projOn);
  els.foldShading?.classList.toggle("is-disabled", !shadeOn);
}

function readControls() {
  const projectionEnabled = els.projectionEnabled?.checked ?? DEFAULTS.projectionEnabled;
  const shadingEnabled = els.shadingEnabled?.checked ?? DEFAULTS.shadingEnabled;
  return {
    labelWidth: Number(els.labelWidth.value) || DEFAULTS.labelWidth,
    labelHeight: Number(els.labelHeight.value) || DEFAULTS.labelHeight,
    lockLabelSize: els.lockLabelSize?.checked ?? DEFAULTS.lockLabelSize,
    labelScale: Math.max(0.05, Number(els.labelScale?.value) || DEFAULTS.labelScale),
    projectionEnabled,
    shadingEnabled,
    edgeCurve: projectionEnabled
      ? Math.max(-2, Math.min(2, Number(els.edgeCurve?.value) || 0))
      : 0,
    innerCurve: projectionEnabled
      ? Math.max(-2, Math.min(2, Number(els.innerCurve?.value) || 0))
      : 0,
    curveStart: Math.max(0, Math.min(1, (Number(els.curveStart?.value) || DEFAULTS.curveStart) / 100)),
    curveBlend: projectionEnabled
      ? Math.max(0, Math.min(1, (Number(els.curveBlend?.value) || DEFAULTS.curveBlend) / 100))
      : 0,
    vertCurve: projectionEnabled
      ? Math.max(-1, Math.min(1, Number(els.vertCurve?.value) || 0))
      : 0,
    rotateDeg: Number(els.rotate.value),
    offsetX: Number(els.offsetX.value) / 100,
    offsetY: Number(els.offsetY.value) / 100,
    edgeFade: shadingEnabled ? Number(els.edgeFade.value) : 0,
    fadeStart: Number(els.fadeStart.value) / 100,
    crop: shadingEnabled ? Number(els.crop.value) / 100 : 0,
    clipCylinder: true,
    showMockup: els.showMockup.checked,
    knockoutWhite: els.knockoutWhite.checked,
    artColor: els.artColor.value || DEFAULTS.artColor,
    paperColor: els.paperColor?.value || DEFAULTS.paperColor,
    artBlend: resolveArtBlend(els.artBlend?.value || DEFAULTS.artBlend),
    exportTarget: resolveExportTarget(els.exportTarget?.value || DEFAULTS.exportTarget),
    outW: Math.max(64, Math.round(Number(els.outW.value) || DEFAULTS.outW)),
    outH: Math.max(64, Math.round(Number(els.outH.value) || DEFAULTS.outH)),
    bgMode: DEFAULTS.bgMode,
    bgColor: DEFAULTS.bgColor,
    pathDetail: DEFAULTS.pathDetail,
  };
}

function updateLabels() {
  syncSectionToggles();
  const c = readControls();
  const g = bottleGeometry(c);
  if (els.edgeCurveVal) {
    const pct = Math.round(c.edgeCurve * 100);
    els.edgeCurveVal.textContent = pct === 0 ? "0%" : pct > 0 ? `+${pct}%` : `${pct}%`;
  }
  if (els.innerCurveVal) {
    const pct = Math.round(c.innerCurve * 100);
    els.innerCurveVal.textContent = pct === 0 ? "0%" : pct > 0 ? `+${pct}%` : `${pct}%`;
  }
  if (els.curveStartVal) els.curveStartVal.textContent = `${Math.round(c.curveStart * 100)}%`;
  if (els.curveBlendVal) els.curveBlendVal.textContent = `${Math.round(c.curveBlend * 100)}%`;
  if (els.vertCurveVal) {
    const pct = Math.round(c.vertCurve * 100);
    els.vertCurveVal.textContent =
      pct === 0 ? "None" : pct > 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
  }
  els.rotateVal.textContent = `${c.rotateDeg.toFixed(1)}°`;
  els.offsetXVal.textContent = `${(c.offsetX * 100).toFixed(1)}%`;
  els.offsetYVal.textContent = `${(c.offsetY * 100).toFixed(1)}%`;
  els.edgeFadeVal.textContent = c.edgeFade.toFixed(2);
  els.fadeStartVal.textContent = `${Math.round(c.fadeStart * 100)}%`;
  els.cropVal.textContent = `${(c.crop * 100).toFixed(1)}%`;
  if (els.labelScaleVal) els.labelScaleVal.textContent = `${Math.round(c.labelScale * 100)}%`;
  if (els.paperColor) els.paperColor.disabled = c.knockoutWhite;
  const mockupExport = c.exportTarget === "mockup";
  if (els.outW) els.outW.disabled = !mockupExport;
  if (els.outH) els.outH.disabled = !mockupExport;
  syncLabelSizeLockUi();
  const vessel = activeVessel();
  const finishId = activeFinishId(vessel);
  const finishLabel = finishId ? vessel.finishes[finishId]?.label : null;
  els.bottleStats.textContent =
    `${vessel.name}${finishLabel ? ` · ${finishLabel}` : ""} · Ø${vessel.diameter} × ${vessel.height} mm · circ. ${g.circumference.toFixed(1)} mm`;
  const nativeNote = sourceNativeMm
    ? ` · native ${sourceNativeMm.w}×${sourceNativeMm.h}`
    : "";
  els.labelArcReadout.textContent =
    `${g.labelWidth.toFixed(1)}×${g.labelHeight.toFixed(1)} mm` +
    ` · ${g.labelArcDeg.toFixed(1)}° · ${(g.coverage * 100).toFixed(0)}% circ.${nativeNote}`;
}

/** Stretch (+) / condense (−) remap of t∈[0,1]. Range ±2 (±200%). */
function applyCurveWarp(t, amt) {
  const a = Math.max(-2, Math.min(2, amt));
  const u = Math.max(0, Math.min(1, t));
  if (Math.abs(a) <= 1e-6) return u;

  const tStretch = Math.asin(u) / (Math.PI / 2);
  const tCondense = Math.sin(u * (Math.PI / 2));
  const abs = Math.abs(a);
  const mix = Math.min(1, abs);
  let tWarp =
    a >= 0 ? u * (1 - mix) + tStretch * mix : u * (1 - mix) + tCondense * mix;

  const extra = Math.max(0, abs - 1);
  if (extra > 0) {
    if (a > 0) tWarp = Math.pow(Math.max(0, tWarp), 1 + extra * 2.5);
    else tWarp = 1 - Math.pow(Math.max(0, 1 - tWarp), 1 + extra * 2.5);
  }
  return tWarp;
}

function smoothstep01(t) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/**
 * Blend zone around curve-start: returns [lo, hi] in |nx| where weight goes 0→1.
 * blend=0 → hard split at start; blend=1 → zone spans center→rim.
 */
function curveBlendZone(curveStart, curveBlend) {
  const start = Math.max(0, Math.min(0.999, curveStart));
  const blend = Math.max(0, Math.min(1, curveBlend));
  if (blend <= 1e-6) return { start, lo: start, hi: start, blend: 0 };
  return {
    start,
    lo: start - blend * start,
    hi: start + blend * (1 - start),
    blend,
  };
}

/**
 * How strongly the edge curve is active at |nx|.
 * 0 = pure inner · 1 = pure edge · blend softens across the curve-start line.
 */
function edgeRegionWeight(ax, curveStart, curveBlend) {
  const a = Math.max(0, Math.min(1, ax));
  const z = curveBlendZone(curveStart, curveBlend);
  if (z.blend <= 1e-6) return a <= z.start ? 0 : 1;
  if (a <= z.lo) return 0;
  if (a >= z.hi) return 1;
  return smoothstep01((a - z.lo) / Math.max(1e-6, z.hi - z.lo));
}

/** Hard-split map: inner inside ±start, edge outside. */
function mapNxToSourceHard(nx, edgeCurve, curveStart, innerCurve) {
  const x = Math.max(-1, Math.min(1, nx));
  const start = Math.max(0, Math.min(0.999, curveStart));
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;

  if (ax <= start) {
    if (start <= 1e-6) return 0;
    const tWarp = applyCurveWarp(ax / start, innerCurve);
    return sign * start * tWarp;
  }

  const tWarp = applyCurveWarp((ax - start) / (1 - start), edgeCurve);
  return sign * (start + (1 - start) * tWarp);
}

/**
 * Map label x (-1..1) → source x (-1..1).
 * Inside ±curveStart: innerCurve · Outside: edgeCurve
 * curveBlend crossfades the two across the start line (0 = hard split, 1 = widest fade).
 */
function mapNxToSource(nx, edgeCurve, curveStart, innerCurve = 0, curveBlend = 0) {
  const x = Math.max(-1, Math.min(1, nx));
  const w = edgeRegionWeight(Math.abs(x), curveStart, curveBlend);
  // Inner-only vs edge-only fields, then crossfade — avoids a kink at the start line.
  if (w <= 1e-6) return mapNxToSourceHard(x, 0, curveStart, innerCurve);
  if (w >= 1 - 1e-6) return mapNxToSourceHard(x, edgeCurve, curveStart, 0);
  const sInner = mapNxToSourceHard(x, 0, curveStart, innerCurve);
  const sEdge = mapNxToSourceHard(x, edgeCurve, curveStart, 0);
  return sInner * (1 - w) + sEdge * w;
}

/**
 * Vertical bow magnitude across full width (fraction of band height).
 * Parabolic nx² belly: flat at center, rounds out to L/R (not a linear slant).
 * Sign: + → top sides up / bottom sides down; − flips.
 */
function verticalCurveAmount(nx, vertCurve) {
  const amt = Math.max(-1, Math.min(1, vertCurve));
  if (Math.abs(amt) <= 1e-6) return 0;
  const x = Math.max(-1, Math.min(1, nx));
  return amt * 0.3 * (x * x);
}

function mapSourceToNx(s, edgeCurve, curveStart, innerCurve = 0, curveBlend = 0) {
  // Inverse of mapNxToSource via binary search
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (mapNxToSource(mid, edgeCurve, curveStart, innerCurve, curveBlend) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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
 * Recolor artwork with artColor. Optionally knock out neutral paper so the
 * PDF/SVG page fill doesn't cover the bottle.
 *
 * Paper = bright + near-neutral (typical PDF page gray). Chromatic pixels are
 * always kept as ink even when light, so brand colors don't vanish.
 * Opaque blend → solid ink (full alpha); other blends keep soft luminance coverage.
 */
function styleArtworkSample(rgba, controls) {
  const [cr, cg, cb] = hexToRgb(controls.artColor);
  const a0 = rgba[3];
  if (a0 < 0.5) return [cr, cg, cb, 0];
  const solidInk = resolveArtBlend(controls.artBlend) === "opaque";

  const r = rgba[0];
  const g = rgba[1];
  const b = rgba[2];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const minC = Math.min(r, g, b) / 255;
  const maxC = Math.max(r, g, b) / 255;
  const chroma = maxC - minC;
  const neutral = chroma < 0.1;

  if (!controls.knockoutWhite) {
    // Recolor ink; replace paper with paperColor (keeps label plate on the bottle).
    const [pr, pg, pb] = hexToRgb(controls.paperColor || "#ffffff");
    let ink = 1 - lum;
    ink = Math.max(0, (ink - 0.04) / 0.96);
    if (ink < 0.004) return [pr, pg, pb, a0];
    if (solidInk) {
      const cover = ink < 0.2 ? ink / 0.2 : 1;
      return [
        cr * cover + pr * (1 - cover),
        cg * cover + pg * (1 - cover),
        cb * cover + pb * (1 - cover),
        a0,
      ];
    }
    const a = Math.min(1, ink);
    return [cr * a + pr * (1 - a), cg * a + pg * (1 - a), cb * a + pb * (1 - a), a0];
  }

  // Colored fills/strokes are ink even when light (yellow, sky blue, etc.)
  if (!neutral) {
    return [cr, cg, cb, a0];
  }

  // Neutral matte: black → full ink, true paper (≥ ~92% / PDF gray ~235+) → clear.
  const paper = Math.max(lum, minC);
  let ink = 1 - paper;
  ink = Math.max(0, (ink - 0.08) / 0.92);
  if (ink < 0.004) return [cr, cg, cb, 0];

  if (solidInk) {
    // Solid coverage — only a thin AA fringe stays soft so type isn't chunky
    const cover = ink < 0.22 ? ink / 0.22 : 1;
    return [cr, cg, cb, a0 * cover];
  }
  return [cr, cg, cb, a0 * ink];
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

      if (absX > usableHalf) {
        if (solidBg) {
          dst[i] = br;
          dst[i + 1] = bg;
          dst[i + 2] = bb;
          dst[i + 3] = 255;
        }
        continue;
      }

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

const EXPORT_WARP_SSAA = 2;
const EXPORT_WARP_MAX_EDGE = 8192;

function imageDataToCanvas(image) {
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  c.getContext("2d").putImageData(image, 0, 0);
  return c;
}

/** High-quality downscale (browser filter) for export antialiasing. */
function downscaleCanvas(srcCanvas, width, height) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, width, height);
  return c;
}

/**
 * Warp to a canvas. For export, ssaa>1 renders larger then downscales for smooth edges.
 */
function warpToCanvas(src, controls, width, height, { ssaa = 1 } = {}) {
  let ss = Math.max(1, Math.round(ssaa));
  while (ss > 1 && (width * ss > EXPORT_WARP_MAX_EDGE || height * ss > EXPORT_WARP_MAX_EDGE)) {
    ss -= 1;
  }
  const image = warpToImageData(src, controls, Math.round(width * ss), Math.round(height * ss));
  const hi = imageDataToCanvas(image);
  if (ss <= 1) return hi;
  return downscaleCanvas(hi, width, height);
}

function canvasToImageData(canvas) {
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
}

const GUIDE_MAGENTA = "rgba(255, 0, 255, 0.95)";
const GUIDE_MAGENTA_SOFT = "rgba(255, 0, 255, 0.14)";
const GUIDE_MAGENTA_BLEND = "rgba(255, 0, 255, 0.55)";
const GUIDE_GREEN = "rgba(0, 255, 70, 0.95)";

function drawGuides(ctx, width, height, controls) {
  const crop = controls.crop;
  const left = width * crop;
  const right = width * (1 - crop);
  const bandW = right - left;
  const lwGuide = Math.max(1, width * 0.002);
  ctx.save();
  ctx.strokeStyle = GUIDE_MAGENTA;
  ctx.lineWidth = lwGuide;
  ctx.setLineDash([]);
  ctx.strokeRect(left, 0, bandW, height);
  ctx.restore();
  drawCurveGuides(ctx, left, 0, bandW, height, controls.curveStart, controls.curveBlend, lwGuide);
  if (controls.shadingEnabled) {
    drawFadeStartGuides(ctx, left, 0, bandW, height, controls.fadeStart, lwGuide);
  }
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

  // Height from physical mm; width from native aspect so scale never stretches.
  const labelH = Math.max(2, panelH * (g.labelHeight / vessel.labelPanel));
  const aspect = g.labelWidth / Math.max(0.1, g.labelHeight);
  const labelW = Math.max(2, labelH * aspect);

  // Free placement — offsets may put the label anywhere on the bottle
  const lx = panelLeft + (panelW - labelW) / 2 + controls.offsetX * panelW;
  const ly = panelTop + (panelH - labelH) / 2 + controls.offsetY * panelH;

  return {
    panelLeft,
    panelTop,
    panelW,
    panelH,
    lx,
    ly,
    labelW,
    labelH,
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

  // Composite label in a layer, then clip to the bottle silhouette (same cut as export).
  const labelLayer = document.createElement("canvas");
  labelLayer.width = width;
  labelLayer.height = height;
  const lctx = labelLayer.getContext("2d");
  lctx.drawImage(tmp, rect.lx, rect.ly, rect.labelW, rect.labelH);
  if (mockupImage) {
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(mockupImage, 0, 0, width, height);
    lctx.globalCompositeOperation = "source-over";
  }

  ctx.save();
  ctx.globalCompositeOperation = artBlendOp(controls.artBlend);
  ctx.drawImage(labelLayer, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  // Speculars through ink look like translucency — skip for solid opaque labels
  if (mockupHighlights && resolveArtBlend(controls.artBlend) !== "opaque") {
    const shine = document.createElement("canvas");
    shine.width = width;
    shine.height = height;
    const sctx = shine.getContext("2d");
    sctx.drawImage(mockupHighlights, 0, 0, width, height);
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(labelLayer, 0, 0);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = activeMockup().highlightStrength;
    ctx.drawImage(shine, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function scheduleRender() {
  updateLabels();
  const controls = readControls();
  syncOutputAspect(controls);
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
        labelImage = warpToImageData(sourceData, controls, lw, lh);
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

    setExportBusy(false);
    els.btnFit.disabled = !sourceData;
    els.btnRedraw.disabled = !sourceData && !mockupImage;
  }, 0);
}

function drawGuidesOnMockup(ctx, width, height, controls) {
  const rect = mockupBodyRect(width, height, controls);
  const lwGuide = Math.max(1, width * 0.0025);
  // Artwork outline + curve-start / blend guides
  ctx.save();
  ctx.strokeStyle = GUIDE_MAGENTA;
  ctx.lineWidth = lwGuide;
  ctx.setLineDash([]);
  ctx.strokeRect(rect.lx, rect.ly, rect.labelW, rect.labelH);
  ctx.restore();
  drawCurveGuides(
    ctx,
    rect.lx,
    rect.ly,
    rect.labelW,
    rect.labelH,
    controls.curveStart,
    controls.curveBlend,
    lwGuide,
  );
  if (controls.shadingEnabled) {
    drawFadeStartGuides(ctx, rect.lx, rect.ly, rect.labelW, rect.labelH, controls.fadeStart, lwGuide);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so Safari can start the download
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function exportStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function exportBaseName() {
  return sourceName.replace(/\.[^.]+$/, "") || "wrap";
}

/**
 * Map output (nx, ny) → source UV.
 * Edge curve stretch/condense + full-width vertical bow
 * (top L/R one way, bottom L/R the opposite); rotate optional.
 */
function sampleSourceUV(nx, ny, controls) {
  const rotateRad = (controls.rotateDeg * Math.PI) / 180;
  const s = mapNxToSource(
    nx,
    controls.edgeCurve,
    controls.curveStart,
    controls.innerCurve,
    controls.curveBlend,
  );
  const bow = verticalCurveAmount(nx, controls.vertCurve);
  let u = s * 0.5;
  // Barrel about vertical center: ny = 0.5 + (v-0.5)*(1+2*bow)
  // +vertCurve: top L/R up, bottom L/R down; − flips
  const scale = 1 + 2 * bow;
  const texV = Math.abs(scale) > 1e-6 ? 0.5 + (ny - 0.5) / scale : ny;
  let v = texV - 0.5;
  if (rotateRad) {
    const c = Math.cos(-rotateRad);
    const sn = Math.sin(-rotateRad);
    const ru = u * c - v * sn;
    const rv = u * sn + v * c;
    u = ru;
    v = rv;
  }
  return { u: u + 0.5, v: v + 0.5, theta: s };
}

/** Inverse: source UV → output pixel XY (for vector path warping). */
function sourceUVToOutputXY(u, v, controls, outW, outH) {
  const rotateRad = (controls.rotateDeg * Math.PI) / 180;
  let uu = u - 0.5;
  let vv = v - 0.5;
  if (rotateRad) {
    const c = Math.cos(rotateRad);
    const sn = Math.sin(rotateRad);
    const ru = uu * c - vv * sn;
    const rv = uu * sn + vv * c;
    uu = ru;
    vv = rv;
  }
  const s = uu * 2;
  const nx = mapSourceToNx(
    s,
    controls.edgeCurve,
    controls.curveStart,
    controls.innerCurve,
    controls.curveBlend,
  );
  const bow = verticalCurveAmount(nx, controls.vertCurve);
  // Inverse of sampleSourceUV barrel bow
  const srcV = vv + 0.5;
  const ny = 0.5 + (srcV - 0.5) * (1 + 2 * bow);
  const usableHalf = Math.max(0.01, 1 - controls.crop);
  return {
    x: ((nx * usableHalf + 1) / 2) * outW,
    y: ny * outH,
    nx,
    fade: edgeFadeAlpha(nx, controls.edgeFade, controls.fadeStart),
  };
}

/**
 * Curve-start lines at ±curveStart, plus blend zone straddling those lines
 * (inner ↔ edge crossfade).
 */
function drawCurveGuides(ctx, lx, ly, labelW, labelH, curveStart, curveBlend, lineWidth) {
  const z = curveBlendZone(curveStart, curveBlend);
  const cx = lx + labelW / 2;
  const halfW = labelW / 2;
  const startHalf = halfW * z.start;
  const loHalf = halfW * z.lo;
  const hiHalf = halfW * z.hi;

  ctx.save();

  // Soft band around the start line (blend > 0)
  if (z.blend > 0.01 && hiHalf - loHalf > 0.5) {
    const bandW = hiHalf - loHalf;
    ctx.fillStyle = GUIDE_MAGENTA_SOFT;
    ctx.fillRect(cx - hiHalf, ly, bandW, labelH);
    ctx.fillRect(cx + loHalf, ly, bandW, labelH);

    ctx.strokeStyle = GUIDE_MAGENTA_BLEND;
    ctx.lineWidth = Math.max(1, lineWidth * 0.85);
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - loHalf, ly);
    ctx.lineTo(cx - loHalf, ly + labelH);
    ctx.moveTo(cx + loHalf, ly);
    ctx.lineTo(cx + loHalf, ly + labelH);
    ctx.moveTo(cx - hiHalf, ly);
    ctx.lineTo(cx - hiHalf, ly + labelH);
    ctx.moveTo(cx + hiHalf, ly);
    ctx.lineTo(cx + hiHalf, ly + labelH);
    ctx.stroke();
  }

  // Curve start (center of the blend)
  ctx.strokeStyle = GUIDE_MAGENTA;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - startHalf, ly);
  ctx.lineTo(cx - startHalf, ly + labelH);
  ctx.moveTo(cx + startHalf, ly);
  ctx.lineTo(cx + startHalf, ly + labelH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Bright green lines at ±fadeStart (where edge fade begins). */
function drawFadeStartGuides(ctx, lx, ly, labelW, labelH, fadeStart, lineWidth) {
  const start = Math.max(0, Math.min(1, fadeStart));
  const cx = lx + labelW / 2;
  const half = (labelW / 2) * start;
  ctx.save();
  ctx.strokeStyle = GUIDE_GREEN;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - half, ly);
  ctx.lineTo(cx - half, ly + labelH);
  ctx.moveTo(cx + half, ly);
  ctx.lineTo(cx + half, ly + labelH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
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

  const lhMm = Math.max(1, g.labelHeight);
  const lh = (lhMm / H) * 100;
  const aspect = g.labelWidth / Math.max(0.1, g.labelHeight);
  const lw = lh * aspect * (H / (R * 2)); // mm aspect → % of vessel image width
  const bodyMid = (bodyTop + bodyBot) / 2;
  const ly = bodyMid - lh / 2 + controls.offsetY * 50;
  const ly2 = ly + lh;

  const inset = 4;
  const cx = 50 + controls.offsetX * 40;
  const halfVis = lw / 2;
  const lx = cx - halfVis;
  const lx2 = lx + halfVis * 2;
  const start = Math.max(0, Math.min(1, controls.curveStart));
  const guideHalf = halfVis * start;
  const g1 = cx - guideHalf;
  const g2 = cx + guideHalf;
  const bow = verticalCurveAmount(1, controls.vertCurve) * lh;
  const labelPath =
    `M ${lx.toFixed(2)} ${(ly - bow).toFixed(2)}` +
    ` Q ${cx.toFixed(2)} ${(ly + bow).toFixed(2)} ${lx2.toFixed(2)} ${(ly - bow).toFixed(2)}` +
    ` L ${lx2.toFixed(2)} ${(ly2 + bow).toFixed(2)}` +
    ` Q ${cx.toFixed(2)} ${(ly2 - bow).toFixed(2)} ${lx.toFixed(2)} ${(ly2 + bow).toFixed(2)} Z`;

  els.frontview.innerHTML = `
    <div class="bottle-diagram">
      <img src="${activeMockup().src || vessel.frontSrc}" alt="${vessel.name} outline" draggable="false" />
      <svg class="label-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="${inset}" y="${bodyTop.toFixed(2)}" width="${(100 - inset * 2).toFixed(2)}" height="${bodyH.toFixed(2)}"
          fill="none" stroke="#999" stroke-width="0.4" stroke-dasharray="1.5 1.5" vector-effect="non-scaling-stroke"/>
        <path d="${labelPath}" fill="rgba(0,0,0,0.12)" stroke="#000" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
        <line x1="${g1.toFixed(2)}" y1="${ly.toFixed(2)}" x2="${g1.toFixed(2)}" y2="${ly2.toFixed(2)}"
          stroke="#e6a800" stroke-width="0.5" stroke-dasharray="1.2 1.2" vector-effect="non-scaling-stroke"/>
        <line x1="${g2.toFixed(2)}" y1="${ly.toFixed(2)}" x2="${g2.toFixed(2)}" y2="${ly2.toFixed(2)}"
          stroke="#e6a800" stroke-width="0.5" stroke-dasharray="1.2 1.2" vector-effect="non-scaling-stroke"/>
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
  const artworkOnly = controls.exportTarget !== "mockup";
  setStatus(artworkOnly ? "Exporting artwork PNG…" : "Exporting mockup PNG…");
  setExportBusy(true);

  await new Promise((r) => setTimeout(r, 20));
  try {
    let canvas;
    let statusNote;

    if (artworkOnly) {
      const dpi = Math.max(300, Math.min(600, Number(els.sourceDpi.value) || 300));
      const rendered = renderWarpedArtworkCanvas(controls, dpi);
      canvas = rendered.canvas;
      statusNote = `${rendered.mmW.toFixed(1)}×${rendered.mmH.toFixed(1)} mm · ${canvas.width}×${canvas.height}px @ ${rendered.dpi}dpi`;
    } else {
      canvas = document.createElement("canvas");
      canvas.width = controls.outW;
      canvas.height = controls.outH;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (mockupImage) {
        const rect = mockupBodyRect(controls.outW, controls.outH, controls);
        const lw = Math.max(64, Math.round(rect.labelW));
        const lh = Math.max(64, Math.round(rect.labelH));
        const labelCanvas = warpToCanvas(sourceData, controls, lw, lh, { ssaa: EXPORT_WARP_SSAA });
        const labelImage = canvasToImageData(labelCanvas);
        paintMockup(ctx, controls.outW, controls.outH, labelImage, controls);
      } else {
        const warped = warpToCanvas(
          sourceData,
          controls,
          controls.outW,
          controls.outH,
          { ssaa: EXPORT_WARP_SSAA },
        );
        ctx.drawImage(warped, 0, 0);
      }
      statusNote = `${controls.outW}×${controls.outH}px`;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG export failed");
    const suffix = artworkOnly ? "warped" : "mockup";
    downloadBlob(blob, `${exportBaseName()}-${suffix}-${exportStamp()}.png`);
    setStatus(`Exported ${artworkOnly ? "artwork" : "mockup"} PNG (${statusNote})`);
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
  let w = 0;
  let h = 0;
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      w = parts[2];
      h = parts[3];
    }
  }
  if (!w || !h) {
    w = parseFloat(root.getAttribute("width")) || 1024;
    h = parseFloat(root.getAttribute("height")) || 1024;
  }

  const mmW = svgLengthToMm(root.getAttribute("width"));
  const mmH = svgLengthToMm(root.getAttribute("height"));
  let nativeMm = null;
  if (mmW && mmH) {
    nativeMm = { w: mmW, h: mmH };
  } else if (vb && w > 0 && h > 0) {
    // ViewBox user units → points (print SVG convention)
    nativeMm = { w: ptsToMm(w), h: ptsToMm(h) };
  }

  return { w, h, root, parsed, nativeMm };
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

  /** Current path (PDF path is NOT part of graphics state — survives save/restore). */
  let pathParts = [];
  let pathCtmScale = 1;
  let pathX = 0;
  let pathY = 0;

  const appendConstructPath = (ops, coords) => {
    if (!ops || !coords) return;
    let j = 0;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i] | 0;
      if (op === OPS.rectangle) {
        const rx = coords[j++];
        const ry = coords[j++];
        const rw = coords[j++];
        const rh = coords[j++];
        const p0 = toSvg(rx, ry);
        const p1 = toSvg(rx + rw, ry);
        const p2 = toSvg(rx + rw, ry + rh);
        const p3 = toSvg(rx, ry + rh);
        pathParts.push(`M${fmt(p0.x)} ${fmt(p0.y)}`);
        pathParts.push(`L${fmt(p1.x)} ${fmt(p1.y)}`);
        pathParts.push(`L${fmt(p2.x)} ${fmt(p2.y)}`);
        pathParts.push(`L${fmt(p3.x)} ${fmt(p3.y)} Z`);
        pathX = rx;
        pathY = ry;
      } else if (op === OPS.moveTo) {
        pathX = coords[j++];
        pathY = coords[j++];
        const p = toSvg(pathX, pathY);
        pathParts.push(`M${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.lineTo) {
        pathX = coords[j++];
        pathY = coords[j++];
        const p = toSvg(pathX, pathY);
        pathParts.push(`L${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo) {
        const x1 = coords[j++];
        const y1 = coords[j++];
        const x2 = coords[j++];
        const y2 = coords[j++];
        pathX = coords[j++];
        pathY = coords[j++];
        const c1 = toSvg(x1, y1);
        const c2 = toSvg(x2, y2);
        const p = toSvg(pathX, pathY);
        pathParts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo2) {
        const x1 = pathX;
        const y1 = pathY;
        const x2 = coords[j++];
        const y2 = coords[j++];
        pathX = coords[j++];
        pathY = coords[j++];
        const c1 = toSvg(x1, y1);
        const c2 = toSvg(x2, y2);
        const p = toSvg(pathX, pathY);
        pathParts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.curveTo3) {
        const x1 = coords[j++];
        const y1 = coords[j++];
        pathX = coords[j++];
        pathY = coords[j++];
        const c1 = toSvg(x1, y1);
        const p = toSvg(pathX, pathY);
        pathParts.push(`C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(p.x)} ${fmt(p.y)} ${fmt(p.x)} ${fmt(p.y)}`);
      } else if (op === OPS.closePath) {
        pathParts.push("Z");
      }
    }
    pathCtmScale = Math.hypot(ctm[0], ctm[1]) || 1;
  };

  const paintCurrentPath = (paint) => {
    const d = pathParts.join(" ");
    pathParts = [];
    if (!d || (!paint.fill && !paint.stroke)) return;
    paths.push({
      d,
      fill: paint.fill ? fillColor : "none",
      stroke: paint.stroke ? strokeColor : "none",
      fillRule: paint.eo ? "evenodd" : "nonzero",
      fillOpacity: paint.fill ? fillAlpha : 1,
      strokeOpacity: paint.stroke ? strokeAlpha : 1,
      strokeWidth: paint.stroke ? Math.max(0.15, lineWidth * pathCtmScale) : 0,
    });
  };

  const paintFromOp = (fn) => {
    if (
      fn === OPS.fill ||
      fn === OPS.eoFill ||
      fn === OPS.stroke ||
      fn === OPS.closeStroke ||
      fn === OPS.fillStroke ||
      fn === OPS.eoFillStroke ||
      fn === OPS.closeFillStroke ||
      fn === OPS.closeEOFillStroke
    ) {
      if (fn === OPS.closeStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
        pathParts.push("Z");
      }
      paintCurrentPath({
        fill:
          fn === OPS.fill ||
          fn === OPS.eoFill ||
          fn === OPS.fillStroke ||
          fn === OPS.eoFillStroke ||
          fn === OPS.closeFillStroke ||
          fn === OPS.closeEOFillStroke,
        stroke:
          fn === OPS.stroke ||
          fn === OPS.closeStroke ||
          fn === OPS.fillStroke ||
          fn === OPS.eoFillStroke ||
          fn === OPS.closeFillStroke ||
          fn === OPS.closeEOFillStroke,
        eo: fn === OPS.eoFill || fn === OPS.eoFillStroke || fn === OPS.closeEOFillStroke,
      });
      return true;
    }
    return false;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (paintFromOp(fn)) continue;

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
      case OPS.constructPath:
        // args: [ops, coords, minMax?] — paint comes later (often after restore)
        appendConstructPath(args?.[0], args?.[1]);
        break;
      case OPS.endPath:
        pathParts = [];
        break;
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
  const minC = Math.min(rgb[0], rgb[1], rgb[2]) / 255;
  return Math.max(lum, minC) > 0.9;
}

/** Knock out / recolor paper and ink for vector export. */
function stylePathForArtworkExport(path, controls, inkColor) {
  let fill = path.fill && path.fill !== "none" ? path.fill : "none";
  let stroke = path.stroke && path.stroke !== "none" ? path.stroke : "none";
  const art = inkColor || controls.artColor || "#000000";
  const paper = controls.paperColor || "#ffffff";

  const stylePaint = (paint) => {
    if (paint === "none") return paint;
    if (isNearWhiteCss(paint)) return controls.knockoutWhite ? "none" : paper;
    return art;
  };

  fill = stylePaint(fill);
  stroke = stylePaint(stroke);

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

/**
 * Geometric side trim (each side) so export matches the bottle front face.
 * Wider-than-bottle labels lose wrap-around edges — same cut as the mockup mask.
 */
function bottleFaceCrop(controls) {
  const g = bottleGeometry(controls);
  const faceMm = Math.min(g.visibleLabelWidth, activeVessel().diameter);
  const labelMm = Math.max(0.1, g.labelWidth);
  if (labelMm <= faceMm) return 0;
  return Math.min(0.45, (labelMm - faceMm) / (2 * labelMm));
}

function trimCanvasHorizontal(canvas, cropFrac) {
  const c = Math.max(0, Math.min(0.49, cropFrac));
  if (c <= 1e-6) return canvas;
  const x = Math.round(canvas.width * c);
  const w = Math.max(1, canvas.width - 2 * x);
  if (w >= canvas.width) return canvas;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = canvas.height;
  out.getContext("2d").drawImage(canvas, x, 0, w, canvas.height, 0, 0, w, canvas.height);
  return out;
}

/** Full-label (pre-trim) export pixel size. */
function warpedArtworkFullExportSize(controls, dpi = 300) {
  const g = bottleGeometry(controls);
  const mmH = Math.max(5, g.labelHeight);
  const mmW = Math.max(5, g.labelWidth);
  let usedDpi = Math.max(300, Math.min(600, dpi));
  let wPx = Math.max(64, Math.round((mmW / 25.4) * usedDpi));
  let hPx = Math.max(64, Math.round((mmH / 25.4) * usedDpi));

  if (sourceData) {
    const srcLong = Math.max(sourceData.width, sourceData.height);
    const outLong = Math.max(wPx, hPx);
    if (srcLong > outLong && outLong > 0) {
      const boost = Math.min(2, srcLong / outLong);
      wPx = Math.max(64, Math.round(wPx * boost));
      hPx = Math.max(64, Math.round(hPx * boost));
      usedDpi = Math.round(usedDpi * boost);
    }
  }

  const maxEdge = EXPORT_WARP_MAX_EDGE;
  const long = Math.max(wPx, hPx);
  if (long > maxEdge) {
    const shrink = maxEdge / long;
    wPx = Math.max(64, Math.round(wPx * shrink));
    hPx = Math.max(64, Math.round(hPx * shrink));
    usedDpi = Math.round(usedDpi * shrink);
  }

  return {
    mmW,
    mmH,
    wPx,
    hPx,
    pageWpt: mmW * MM_TO_PT,
    pageHpt: mmH * MM_TO_PT,
    dpi: usedDpi,
  };
}

/** Visible (bottle-clipped) export frame. */
function warpedArtworkExportSize(controls, dpi = 300) {
  const full = warpedArtworkFullExportSize(controls, dpi);
  const crop = bottleFaceCrop(controls);
  const keep = 1 - 2 * crop;
  const mmW = Math.max(5, full.mmW * keep);
  const wPx = Math.max(64, Math.round(full.wPx * keep));
  return {
    mmW,
    mmH: full.mmH,
    wPx,
    hPx: full.hPx,
    pageWpt: mmW * MM_TO_PT,
    pageHpt: full.pageHpt,
    dpi: full.dpi,
    crop,
    full,
  };
}

function warpControlsForExport(controls) {
  return {
    ...controls,
    artColor: printInkColor(controls),
    bgMode: "transparent",
  };
}

/**
 * Cylinder-warped isolated artwork (same projection as the bottle label), rasterized.
 * Supersampled, then trimmed to the bottle front face (wrap-around edges removed).
 */
function renderWarpedArtworkCanvas(controls, dpi = 300) {
  if (!sourceData) throw new Error("No source artwork loaded");
  const size = warpedArtworkExportSize(controls, dpi);
  const full = size.full;
  const canvas = warpToCanvas(
    sourceData,
    warpControlsForExport(controls),
    full.wPx,
    full.hPx,
    { ssaa: EXPORT_WARP_SSAA },
  );
  const trimmed = trimCanvasHorizontal(canvas, size.crop);
  return {
    canvas: trimmed,
    mmW: size.mmW,
    mmH: size.mmH,
    wPx: trimmed.width,
    hPx: trimmed.height,
    pageWpt: size.pageWpt,
    pageHpt: size.pageHpt,
    dpi: size.dpi,
  };
}

/** Shift M/L path coords (used to trim bottle-face margins from vector export). */
function offsetWarpedPathD(d, dx, dy = 0) {
  if (!dx && !dy) return d;
  let out = "";
  forEachWarpedPathCommand(
    d,
    (x, y) => {
      out += `M${fmt(x - dx)} ${fmt(y - dy)}`;
    },
    (x, y) => {
      out += `L${fmt(x - dx)} ${fmt(y - dy)}`;
    },
    () => {
      out += "Z";
    },
  );
  return out;
}

/**
 * Warped vector SVG at bottle-visible label size. Styles ink like the mockup; returns null if no ink paths.
 */
function buildWarpedArtworkSvg(pathSet, controls) {
  const size = warpedArtworkExportSize(controls, 72);
  const ink = printInkColor(controls);
  const fullW = size.full.pageWpt;
  const h = size.pageHpt;
  const w = size.pageWpt;
  const x0 = fullW * size.crop;
  const detail = Math.max(16, controls.pathDetail || DEFAULTS.pathDetail);
  const wc = warpControlsForExport(controls);

  const out = [];
  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}">`,
  );
  out.push(`<defs><clipPath id="bottleFace"><rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}"/></clipPath></defs>`);
  out.push(`<g clip-path="url(#bottleFace)">`);

  let count = 0;
  const { paths, w: srcW, h: srcH } = pathSet;
  for (const src of paths) {
    const styled = stylePathForArtworkExport(src, controls, ink);
    if (styled.fill === "none" && styled.stroke === "none") continue;
    const warped = warpPathD(styled.d, wc, srcW, srcH, fullW, h, detail);
    if (!warped) continue;
    const trimmed = offsetWarpedPathD(warped, x0);
    if (!trimmed) continue;
    count++;
    let attrs = `d="${trimmed}"`;
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
  out.push(`</g></svg>`);
  if (!count) return null;
  return { svgText: out.join(""), mmW: size.mmW, mmH: size.mmH, pageWpt: w, pageHpt: h, dpi: size.dpi };
}

function buildWarpedArtworkSvgFromRaster(controls) {
  const dpi = Math.max(300, Math.min(600, Number(els.sourceDpi.value) || 300));
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

/** Walk M/L/Z commands produced by warpPathD. */
function forEachWarpedPathCommand(d, onMove, onLine, onClose) {
  const re = /([MLZ])\s*([^MLZ]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const type = m[1].toUpperCase();
    const nums = (m[2].match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || []).map(Number);
    if (type === "M") {
      if (nums.length < 2) continue;
      onMove(nums[0], nums[1]);
      for (let i = 2; i + 1 < nums.length; i += 2) onLine(nums[i], nums[i + 1]);
    } else if (type === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) onLine(nums[i], nums[i + 1]);
    } else if (type === "Z") {
      onClose();
    }
  }
}

/** Draw one warped path as true PDF vector ops (selectable in Illustrator). */
function drawWarpedPathOnJsPdf(doc, d, styled, strokeScale, ox = 0, oy = 0) {
  const hasFill = styled.fill && styled.fill !== "none";
  const hasStroke = styled.stroke && styled.stroke !== "none";
  if (!hasFill && !hasStroke) return false;

  let points = 0;
  forEachWarpedPathCommand(
    d,
    (x, y) => {
      doc.moveTo(x - ox, y - oy);
      points++;
    },
    (x, y) => {
      doc.lineTo(x - ox, y - oy);
      points++;
    },
    () => {
      doc.close();
    },
  );
  if (points < 2) return false;

  if (hasFill) {
    const rgb = parseCssRgb(styled.fill) || [0, 0, 0];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }
  if (hasStroke) {
    const rgb = parseCssRgb(styled.stroke) || [0, 0, 0];
    // jsPDF stroke color API is setDrawColor (not setStrokeColor)
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    const sw = Math.max(0.1, (styled.strokeWidth || 1) * strokeScale);
    doc.setLineWidth(sw);
  }

  const evenodd = styled.fillRule === "evenodd";
  const fillOp = evenodd ? "evenodd" : undefined;
  try {
    if (hasFill && hasStroke) doc.fillStroke(fillOp);
    else if (hasFill) doc.fill(fillOp);
    else doc.stroke();
  } catch {
    if (hasFill && hasStroke) doc.fillStroke();
    else if (hasFill) doc.fill();
    else doc.stroke();
  }
  return true;
}

/**
 * Build a vector PDF from warped source paths (no raster embed).
 * Each shape is a separate path object — selectable in Illustrator.
 */
async function exportWarpedArtworkPdfFromPaths(pathSet, controls) {
  await loadScriptOnce(
    "jspdf-umd",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  );
  const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFCtor) throw new Error("jsPDF failed to load");

  const size = warpedArtworkExportSize(controls, 72);
  const fullW = Math.max(1, size.full.pageWpt);
  const w = Math.max(1, size.pageWpt);
  const h = Math.max(1, size.pageHpt);
  const x0 = fullW * size.crop;
  const detail = Math.max(16, Number(controls.pathDetail) || DEFAULTS.pathDetail);
  const wc = warpControlsForExport(controls);
  const ink = printInkColor(controls);
  const { paths, w: srcW, h: srcH } = pathSet;
  const strokeScale = fullW / Math.max(1, srcW);

  const doc = new jsPDFCtor({ unit: "pt", format: [w, h], compress: true });
  // Paths are already shifted by x0 into the visible page; page size is the bottle face.

  let pathCount = 0;
  for (const src of paths) {
    const styled = stylePathForArtworkExport(src, { ...controls, artColor: ink }, ink);
    if (styled.fill === "none" && styled.stroke === "none") continue;
    const warped = warpPathD(styled.d, wc, srcW, srcH, fullW, h, detail);
    if (!warped) continue;
    if (drawWarpedPathOnJsPdf(doc, warped, styled, strokeScale, x0, 0)) pathCount++;
  }

  if (!pathCount) {
    throw new Error(
      "No vector ink paths to export (paper may be knocked out). Turn off Knockout, or use a PDF/SVG with outlined paths.",
    );
  }

  return {
    blob: doc.output("blob"),
    mmW: size.mmW,
    mmH: size.mmH,
    pathCount,
    pageWpt: w,
    pageHpt: h,
  };
}

async function getVectorPathSet() {
  if (sourceKind === "pdf" && sourcePdfBytes) {
    const pageNum = Number(els.pdfPage.value) || 1;
    return extractPdfVectorPaths(sourcePdfBytes, pageNum);
  }
  if (sourceKind === "svg" && sourceSvgText && sourceVectorSize) {
    return extractSvgVectorPaths(sourceSvgText, sourceVectorSize.w, sourceVectorSize.h);
  }
  throw new Error(
    "Vector PDF needs a PDF or SVG with paths. Raster images (PNG/JPG) can’t export selectable vectors.",
  );
}

async function exportSvg() {
  if (!sourceData) return;
  const controls = readControls();
  if (controls.exportTarget === "mockup") {
    setStatus("SVG export is artwork-only — switch Export to “Artwork only”");
    return;
  }
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
  if (controls.exportTarget === "mockup") {
    setStatus("PDF export is artwork-only — switch Export to “Artwork only”");
    return;
  }
  setStatus("Extracting vector paths…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));

  try {
    const pathSet = await getVectorPathSet();
    setStatus(`Warping ${pathSet.paths.length} vector paths…`);

    let result;
    try {
      result = await exportWarpedArtworkPdfFromPaths(pathSet, controls);
    } catch (directErr) {
      // Fallback: warped SVG → svg2pdf (still true vectors, selectable in Illustrator)
      console.warn("Direct path PDF failed, trying svg2pdf:", directErr);
      setStatus("Building vector PDF via SVG…");
      const svgResult = buildWarpedArtworkSvg(pathSet, controls);
      if (!svgResult) throw directErr;
      const blob = await svgTextToPdfBlob(svgResult.svgText, svgResult.pageWpt, svgResult.pageHpt);
      result = {
        blob,
        mmW: svgResult.mmW,
        mmH: svgResult.mmH,
        pathCount: pathSet.paths.length,
        pageWpt: svgResult.pageWpt,
        pageHpt: svgResult.pageHpt,
      };
    }

    if (!result.blob || result.blob.size < 100) throw new Error("PDF export produced an empty file");

    downloadBlob(result.blob, `${exportBaseName()}-warped-${exportStamp()}.pdf`);
    const inkNote = isNearWhiteCss(controls.artColor) ? " · ink black" : "";
    setStatus(
      `Exported vector PDF ${result.mmW.toFixed(1)}×${result.mmH.toFixed(1)} mm` +
        ` (${result.pathCount} paths · ${(result.blob.size / 1024).toFixed(0)} KB${inkNote})`,
    );
  } catch (err) {
    console.error(err);
    const msg = err?.message || "PDF export failed";
    setStatus(msg);
    alert(msg);
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

const _scriptLoads = new Map();

function loadScriptOnce(id, src) {
  const existing = document.getElementById(id);
  if (existing?.dataset.loaded === "1") return Promise.resolve();
  if (_scriptLoads.has(id)) return _scriptLoads.get(id);

  const p = new Promise((resolve, reject) => {
    let s = existing;
    if (!s) {
      s = document.createElement("script");
      s.id = id;
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => {
      _scriptLoads.delete(id);
      s.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    // Already finished before listeners attached
    if (s.dataset.loaded === "1") resolve();
  });
  _scriptLoads.set(id, p);
  return p;
}

async function loadSvgFile(file) {
  const text = await file.text();
  sourceSvgText = text;
  sourcePdfBytes = null;
  sourceKind = "svg";

  const size = parseSvgSize(text);
  sourceVectorSize = { w: size.w, h: size.h };
  if (size.nativeMm) {
    setSourceNativeMm(size.nativeMm.w, size.nativeMm.h);
  } else {
    sourceNativeMm = null;
  }

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
    if (!sourceNativeMm) {
      // Rasterized px size @ 96dpi as last-resort native
      setSourceNativeMm(w * PX_TO_MM, h * PX_TO_MM);
    }

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
  const native = setSourceNativeMm(ptsToMm(unscaled.width), ptsToMm(unscaled.height));
  const scale = dpi / 72;
  const viewport = pdfPage.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.round(viewport.width);
  c.height = Math.round(viewport.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  setStatus(
    `PDF page ${page}/${pageCount} · ${c.width}×${c.height} @ ${dpi} DPI` +
      ` (native ${native.w}×${native.h} mm)`,
  );
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
    applyNativeLabelSize({ force: true });
    syncLabelSizeLockUi();
    saveSettings();
    const native = sourceNativeMm
      ? ` · label ${sourceNativeMm.w}×${sourceNativeMm.h} mm`
      : "";
    setStatus(`Loaded ${name} · ${canvas.width}×${canvas.height}${native}`);
    scheduleRender();
  } catch (err) {
    console.error(err);
    sourceKind = "";
    sourcePdfBytes = null;
    sourceSvgText = null;
    sourceNativeMm = null;
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
    const unscaled = pdfPage.getViewport({ scale: 1 });
    sourceVectorSize = { w: unscaled.width, h: unscaled.height };
    setSourceNativeMm(ptsToMm(unscaled.width), ptsToMm(unscaled.height));
    applyNativeLabelSize();
    const viewport = pdfPage.getViewport({ scale: dpi / 72 });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    sourceCanvas = c;
    sourceData = ctx.getImageData(0, 0, c.width, c.height);
    saveSettings();
    scheduleRender();
  } catch (err) {
    setStatus(err?.message || "Failed to reload page");
  }
}

/** Reset projection to flat (no edge / inner / vert curve). */
function resetProjection() {
  if (els.projectionEnabled) els.projectionEnabled.checked = DEFAULTS.projectionEnabled;
  els.edgeCurve.value = String(DEFAULTS.edgeCurve);
  els.innerCurve.value = String(DEFAULTS.innerCurve);
  els.curveStart.value = String(DEFAULTS.curveStart);
  els.curveBlend.value = String(DEFAULTS.curveBlend);
  els.vertCurve.value = String(DEFAULTS.vertCurve);
  syncSectionToggles();
}

function resetControls() {
  const vessel = activeVessel();
  els.lockLabelSize.checked = DEFAULTS.lockLabelSize;
  els.labelScale.value = DEFAULTS.labelScale;
  if (!applyNativeLabelSize({ force: true })) {
    els.labelWidth.value = vessel.defaultLabelWidth;
    els.labelHeight.value = vessel.defaultLabelHeight;
  }
  resetProjection();
  if (els.shadingEnabled) els.shadingEnabled.checked = DEFAULTS.shadingEnabled;
  els.rotate.value = DEFAULTS.rotate;
  els.offsetX.value = DEFAULTS.offsetX;
  els.offsetY.value = DEFAULTS.offsetY;
  els.edgeFade.value = DEFAULTS.edgeFade;
  els.fadeStart.value = DEFAULTS.fadeStart;
  els.crop.value = DEFAULTS.crop;
  els.showMockup.checked = DEFAULTS.showMockup;
  syncSectionToggles();
  els.knockoutWhite.checked = DEFAULTS.knockoutWhite;
  els.artColor.value = DEFAULTS.artColor;
  els.paperColor.value = DEFAULTS.paperColor;
  els.artBlend.value = DEFAULTS.artBlend;
  els.exportTarget.value = DEFAULTS.exportTarget;
  els.outW.value = vessel.defaultOutW;
  els.outH.value = vessel.defaultOutH;
  els.pdfPage.value = DEFAULTS.pdfPage;
  els.sourceDpi.value = DEFAULTS.sourceDpi;
  saveSettings();
  scheduleRender();
}

function fitOutputToSource() {
  if (!sourceCanvas) return;
  const controls = readControls();
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

  els.vesselFinish?.addEventListener("change", () => {
    switchVesselFinish(els.vesselFinish.value);
  });

  const live = [
    els.labelWidth,
    els.labelHeight,
    els.labelScale,
    els.projectionEnabled,
    els.shadingEnabled,
    els.edgeCurve,
    els.innerCurve,
    els.curveStart,
    els.curveBlend,
    els.vertCurve,
    els.rotate,
    els.offsetX,
    els.offsetY,
    els.edgeFade,
    els.fadeStart,
    els.crop,
    els.showMockup,
    els.knockoutWhite,
    els.artColor,
    els.paperColor,
    els.artBlend,
    els.exportTarget,
    els.outW,
    els.outH,
  ];
  live.forEach((el) => {
    el.addEventListener("input", persistAndRender);
    el.addEventListener("change", persistAndRender);
  });

  els.lockLabelSize.addEventListener("change", () => {
    if (els.lockLabelSize.checked) applyNativeLabelSize({ force: true });
    syncLabelSizeLockUi();
    saveSettings();
    scheduleRender();
  });

  els.btnNativeSize.addEventListener("click", () => {
    if (!applyNativeLabelSize({ force: true })) {
      setStatus("Upload a PDF/SVG to read native label size");
      return;
    }
    saveSettings();
    scheduleRender();
    setStatus(
      `Label size set to native ${sourceNativeMm.w}×${sourceNativeMm.h} mm`,
    );
  });

  els.btnResetProjection.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetProjection();
    saveSettings();
    scheduleRender();
    setStatus("Projection reset");
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

  bindViewerZoom();
  scheduleRender();
}

loadSettings();
syncVesselFinishUi();
syncSectionToggles();
loadMockup().then(() => {
  bindUi();
  setStatus(`Upload a PDF or SVG — it will wrap onto the ${activeVessel().kind} mockup`);
  scheduleRender();
});
