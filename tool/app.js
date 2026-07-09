import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);

const els = {
  fileInput: $("file-input"),
  fileLabel: $("file-label"),
  pdfPage: $("pdf-page"),
  sourceDpi: $("source-dpi"),
  curvature: $("curvature"),
  arc: $("arc"),
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
  curvatureVal: $("curvature-val"),
  arcVal: $("arc-val"),
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

const DEFAULTS = {
  curvature: 1,
  arc: 140,
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
  outW: 1600,
  outH: 2000,
  bgMode: "transparent",
  bgColor: "#808080",
  pdfPage: 1,
  sourceDpi: 300,
  pathDetail: 12,
};

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

const previewCtx = els.preview.getContext("2d", { alpha: true });

function setStatus(msg) {
  els.status.textContent = msg;
}

function readControls() {
  return {
    wrap: Number(els.curvature.value),
    labelArcDeg: Number(els.arc.value),
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
    outW: Math.max(64, Math.round(Number(els.outW.value) || DEFAULTS.outW)),
    outH: Math.max(64, Math.round(Number(els.outH.value) || DEFAULTS.outH)),
    bgMode: els.bgMode.value,
    bgColor: els.bgColor.value,
    pathDetail: Math.max(4, Math.min(40, Math.round(Number(els.pathDetail.value) || DEFAULTS.pathDetail))),
  };
}

function updateLabels() {
  const c = readControls();
  els.curvatureVal.textContent = c.wrap.toFixed(2);
  els.arcVal.textContent = `${Math.round(c.labelArcDeg)}°`;
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
}

/**
 * Bottle projection: screen X is the orthographic view of a vertical cylinder.
 * x = R · sin(θ)  ⇒  θ = asin(x/R)
 * Verticals stay vertical. Horizontals only bend if hCurve ≠ 0.
 */
function screenXToSurfaceU(nx, wrap, edgeSquash) {
  const x = Math.max(-1, Math.min(1, nx));
  // Normalized surface coordinate in [-1, 1]: flat vs cylindrical
  const flat = x;
  const cyl = Math.asin(x) / (Math.PI / 2); // foreshortens toward edges
  let u = flat * (1 - wrap) + cyl * wrap;

  // edgeSquash 1 = physical; >1 stronger compression at rims; <1 softer
  if (edgeSquash !== 1) {
    const s = Math.max(0.2, edgeSquash);
    u = Math.sign(u) * Math.pow(Math.abs(u), s);
  }
  return u; // -1 .. 1 across the front of the bottle
}

/**
 * Vertical offset for horizontal lines so they follow a circular/elliptical
 * arc (like a bottle ring seen with a slight camera pitch).
 * Uses 1 − cos(θ) = 1 − √(1 − x²), not a parabola.
 */
function horizontalCurveOffset(nx, hCurve) {
  if (!hCurve) return 0;
  const x = Math.max(-1, Math.min(1, nx));
  const cosTheta = Math.sqrt(Math.max(0, 1 - x * x));
  return hCurve * 0.45 * (1 - cosTheta);
}

/** Depth factor on cylinder face: 1 at center, 0 at rim. */
function cylinderDepth(nx) {
  const x = Math.max(-1, Math.min(1, nx));
  return Math.sqrt(Math.max(0, 1 - x * x));
}

/**
 * Soft left/right edge fade.
 * fadeStart: 0..1 — distance from center where fade begins (0 = from center, 1 = only at rim).
 * edgeFade: 0..1 — how strongly alpha drops toward the rim.
 */
function edgeFadeAlpha(nx, edgeFade, fadeStart) {
  if (edgeFade <= 0) return 1;
  const absX = Math.min(1, Math.abs(nx));
  const start = Math.max(0, Math.min(0.99, fadeStart));
  if (absX <= start) return 1;
  const t = (absX - start) / (1 - start); // 0 at fade start → 1 at rim
  const smooth = t * t * (3 - 2 * t); // smoothstep
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
      const rgba = sampleBilinear(srcPixels, sw, sh, sx, sy);

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

function scheduleRender() {
  updateLabels();
  if (rafPending) cancelAnimationFrame(rafPending);
  rafPending = requestAnimationFrame(() => {
    rafPending = 0;
    renderPreview();
  });
}

function renderPreview() {
  if (!sourceData) return;

  const controls = readControls();
  const token = ++renderToken;

  // Preview at a capped resolution for snappy interaction
  const maxPreview = 900;
  const scale = Math.min(1, maxPreview / Math.max(controls.outW, controls.outH));
  const w = Math.max(64, Math.round(controls.outW * scale));
  const h = Math.max(64, Math.round(controls.outH * scale));

  setStatus("Rendering…");
  // Yield so UI can update, then warp
  setTimeout(() => {
    if (token !== renderToken) return;
    const t0 = performance.now();
    const image = warpToImageData(sourceData, controls, w, h);
    if (token !== renderToken) return;

    els.preview.width = w;
    els.preview.height = h;
    previewCtx.putImageData(image, 0, 0);
    drawGuides(previewCtx, w, h, controls);

    const ms = Math.round(performance.now() - t0);
    setStatus(`${sourceName} · ${controls.outW}×${controls.outH} · preview ${w}×${h} · ${ms}ms`);
    setExportBusy(false);
    els.btnFit.disabled = false;
    els.btnRedraw.disabled = false;
  }, 0);
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
 * Same source→output mapping as the pixel preview (for one X).
 * Returns normalized source U/V for a normalized output position.
 */
function sampleSourceUV(nx, ny, controls) {
  const labelSpan = Math.max(0.15, Math.min(1, controls.labelArcDeg / 180));
  const rotateU = controls.rotateDeg / 180;
  const surface = screenXToSurfaceU(nx, controls.wrap, controls.edgeSquash);
  const u = 0.5 + (surface * (labelSpan * 0.5)) / controls.scaleX + controls.offsetX + rotateU;

  // Perspective: foreshorten vertical scale toward the rims (deeper = smaller)
  const depth = cylinderDepth(nx);
  const perspScale = 1 + controls.perspective * (1 - depth);
  const v =
    0.5 +
    (ny - 0.5 - controls.offsetY) / (controls.scaleY * perspScale) +
    horizontalCurveOffset(nx, controls.hCurve);
  return { u, v };
}

/** Invert screenXToSurfaceU with binary search → nx in [-1, 1]. */
function surfaceUToScreenX(surface, wrap, edgeSquash) {
  const target = Math.max(-1, Math.min(1, surface));
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const val = screenXToSurfaceU(mid, wrap, edgeSquash);
    if (val < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Inverse of the preview mapping: source UV (0..1) → output pixel XY.
 * Keeps shapes continuous (no strip slicing).
 */
function sourceUVToOutputXY(u, v, controls, outW, outH) {
  const labelSpan = Math.max(0.15, Math.min(1, controls.labelArcDeg / 180));
  const rotateU = controls.rotateDeg / 180;
  const usableHalf = Math.max(0.01, 1 - controls.crop);

  const halfSpan = (labelSpan * 0.5) / controls.scaleX || 1e-6;
  const surface = (u - 0.5 - controls.offsetX - rotateU) / halfSpan;
  const nx = surfaceUToScreenX(surface, controls.wrap, controls.edgeSquash);

  const depth = cylinderDepth(nx);
  const perspScale = 1 + controls.perspective * (1 - depth);
  const hOff = horizontalCurveOffset(nx, controls.hCurve);
  const ny = (v - 0.5 - hOff) * controls.scaleY * perspScale + 0.5 + controls.offsetY;

  const x = ((nx * usableHalf + 1) / 2) * outW;
  const y = ny * outH;
  return { x, y, nx, fade: edgeFadeAlpha(nx, controls.edgeFade, controls.fadeStart) };
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
    const image = warpToImageData(sourceData, controls, controls.outW, controls.outH);
    const canvas = document.createElement("canvas");
    canvas.width = controls.outW;
    canvas.height = controls.outH;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(image, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG export failed");
    downloadBlob(blob, `${exportBaseName()}-cylinder-${exportStamp()}.png`);
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

async function exportWarpedSvg(controls) {
  const pathSet = await getVectorPathSet();
  setStatus(`Warping ${pathSet.paths.length} vector paths…`);
  await new Promise((r) => setTimeout(r, 10));
  return buildWarpedSvgFromPaths(pathSet, controls);
}

async function svgTextToPdfBlob(svgText, controls) {
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

  const pageW = controls.outW * 0.75;
  const pageH = controls.outH * 0.75;
  const doc = new jsPDFCtor({ unit: "pt", format: [pageW, pageH], compress: true });

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;overflow:hidden;";
  container.innerHTML = svgText;
  const svgEl = container.querySelector("svg");
  if (!svgEl) throw new Error("Failed to build warped SVG");
  document.body.appendChild(container);
  try {
    if (typeof doc.svg === "function") {
      await doc.svg(svgEl, { x: 0, y: 0, width: pageW, height: pageH });
    } else if (typeof svg2pdfFn === "function") {
      await svg2pdfFn(svgEl, doc, { x: 0, y: 0, width: pageW, height: pageH });
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

async function exportSvg() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting vector SVG…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));
  try {
    const svgText = await exportWarpedSvg(controls);
    downloadBlob(
      new Blob([svgText], { type: "image/svg+xml" }),
      `${exportBaseName()}-cylinder-${exportStamp()}.svg`,
    );
    setStatus(`Exported vector SVG (${(svgText.length / 1024).toFixed(0)} KB)`);
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
  setStatus("Exporting vector PDF…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));

  try {
    const svgText = await exportWarpedSvg(controls);
    setStatus("Writing PDF…");
    const blob = await svgTextToPdfBlob(svgText, controls);
    downloadBlob(blob, `${exportBaseName()}-cylinder-${exportStamp()}.pdf`);
    setStatus(`Exported vector PDF (${(blob.size / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "PDF export failed");
  } finally {
    setExportBusy(false);
  }
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
  els.curvature.value = DEFAULTS.curvature;
  els.arc.value = DEFAULTS.arc;
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
  els.outW.value = DEFAULTS.outW;
  els.outH.value = DEFAULTS.outH;
  els.bgMode.value = DEFAULTS.bgMode;
  els.bgColor.value = DEFAULTS.bgColor;
  els.pathDetail.value = DEFAULTS.pathDetail;
  updateLabels();
  scheduleRender();
}

function fitOutputToSource() {
  if (!sourceCanvas) return;
  const maxW = 2400;
  const scale = Math.min(1, maxW / sourceCanvas.width);
  els.outW.value = Math.round(sourceCanvas.width * scale);
  els.outH.value = Math.round(sourceCanvas.height * scale);
  scheduleRender();
}

function bindUi() {
  const onFile = (file) => ingestFile(file);

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file) onFile(file);
  });

  // Allow dropping a file anywhere on the page
  ["dragenter", "dragover"].forEach((evt) => {
    document.addEventListener(evt, (e) => e.preventDefault());
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  const live = [
    els.curvature,
    els.arc,
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
    els.outW,
    els.outH,
    els.bgMode,
    els.bgColor,
  ];
  live.forEach((el) => {
    el.addEventListener("input", scheduleRender);
    el.addEventListener("change", scheduleRender);
  });

  els.pdfPage.addEventListener("change", reloadPdfPage);
  els.sourceDpi.addEventListener("change", reloadPdfPage);

  els.btnReset.addEventListener("click", resetControls);
  els.btnExport.addEventListener("click", exportPng);
  els.btnExportPdf.addEventListener("click", exportPdf);
  els.btnExportSvg.addEventListener("click", exportSvg);
  els.btnFit.addEventListener("click", fitOutputToSource);
  els.btnRedraw.addEventListener("click", () => {
    renderToken++;
    renderPreview();
  });

  updateLabels();
}

bindUi();
setStatus("Upload a PDF or SVG to begin");
