import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);

const els = {
  dropzone: $("dropzone"),
  fileInput: $("file-input"),
  fileLabel: $("file-label"),
  pdfPage: $("pdf-page"),
  sourceDpi: $("source-dpi"),
  curvature: $("curvature"),
  arc: $("arc"),
  edgeWarp: $("edge-warp"),
  perspective: $("perspective"),
  vBow: $("v-bow"),
  scaleX: $("scale-x"),
  scaleY: $("scale-y"),
  rotate: $("rotate"),
  offsetX: $("offset-x"),
  offsetY: $("offset-y"),
  falloff: $("falloff"),
  crop: $("crop"),
  clipCylinder: $("clip-cylinder"),
  showGuides: $("show-guides"),
  outW: $("out-w"),
  outH: $("out-h"),
  bgMode: $("bg-mode"),
  bgColor: $("bg-color"),
  btnReset: $("btn-reset"),
  btnExport: $("btn-export"),
  btnFit: $("btn-fit"),
  btnRedraw: $("btn-redraw"),
  status: $("status"),
  preview: $("preview"),
  curvatureVal: $("curvature-val"),
  arcVal: $("arc-val"),
  edgeWarpVal: $("edge-warp-val"),
  perspectiveVal: $("perspective-val"),
  vBowVal: $("v-bow-val"),
  scaleXVal: $("scale-x-val"),
  scaleYVal: $("scale-y-val"),
  rotateVal: $("rotate-val"),
  offsetXVal: $("offset-x-val"),
  offsetYVal: $("offset-y-val"),
  falloffVal: $("falloff-val"),
  cropVal: $("crop-val"),
};

const DEFAULTS = {
  curvature: 1,
  arc: 160,
  edgeWarp: 1,
  perspective: 0.35,
  vBow: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  offsetX: 0,
  offsetY: 0,
  falloff: 0,
  crop: 0,
  clipCylinder: true,
  showGuides: false,
  outW: 1600,
  outH: 2000,
  bgMode: "transparent",
  bgColor: "#2a1408",
  pdfPage: 1,
  sourceDpi: 300,
};

/** @type {HTMLCanvasElement | null} */
let sourceCanvas = null;
/** @type {ImageData | null} */
let sourceData = null;
/** @type {pdfjsLib.PDFDocumentProxy | null} */
let pdfDoc = null;
let sourceName = "";
let renderToken = 0;
let rafPending = 0;

const previewCtx = els.preview.getContext("2d", { alpha: true });

function setStatus(msg) {
  els.status.textContent = msg;
}

function readControls() {
  return {
    curvature: Number(els.curvature.value),
    arcDeg: Number(els.arc.value),
    edgeWarp: Number(els.edgeWarp.value),
    perspective: Number(els.perspective.value),
    vBow: Number(els.vBow.value),
    scaleX: Number(els.scaleX.value),
    scaleY: Number(els.scaleY.value),
    rotateDeg: Number(els.rotate.value),
    offsetX: Number(els.offsetX.value) / 100,
    offsetY: Number(els.offsetY.value) / 100,
    falloff: Number(els.falloff.value),
    crop: Number(els.crop.value) / 100,
    clipCylinder: els.clipCylinder.checked,
    showGuides: els.showGuides.checked,
    outW: Math.max(64, Math.round(Number(els.outW.value) || DEFAULTS.outW)),
    outH: Math.max(64, Math.round(Number(els.outH.value) || DEFAULTS.outH)),
    bgMode: els.bgMode.value,
    bgColor: els.bgColor.value,
  };
}

function updateLabels() {
  const c = readControls();
  els.curvatureVal.textContent = c.curvature.toFixed(2);
  els.arcVal.textContent = `${Math.round(c.arcDeg)}°`;
  els.edgeWarpVal.textContent = c.edgeWarp.toFixed(2);
  els.perspectiveVal.textContent = c.perspective.toFixed(2);
  els.vBowVal.textContent = c.vBow.toFixed(2);
  els.scaleXVal.textContent = c.scaleX.toFixed(2);
  els.scaleYVal.textContent = c.scaleY.toFixed(2);
  els.rotateVal.textContent = `${c.rotateDeg.toFixed(1)}°`;
  els.offsetXVal.textContent = `${(c.offsetX * 100).toFixed(1)}%`;
  els.offsetYVal.textContent = `${(c.offsetY * 100).toFixed(1)}%`;
  els.falloffVal.textContent = c.falloff.toFixed(2);
  els.cropVal.textContent = `${(c.crop * 100).toFixed(1)}%`;
  els.bgColor.disabled = c.bgMode !== "solid";
}

/**
 * Map normalized screen x in [-1, 1] to cylinder angle θ in radians.
 *
 * Orthographic cylinder: screenX ∝ sin(θ), so θ = asin(nx · sin(arcHalf)).
 * edgeWarp 0 = flat/linear, 1 = true cylinder, >1 exaggerates edge squash.
 * curvature scales foreshortening intensity (1 = physical cylinder).
 */
function screenXToTheta(nx, arcHalf, edgeWarp, curvature) {
  const x = Math.max(-1, Math.min(1, nx));
  const linear = x * arcHalf;

  const k = Math.max(0.05, curvature);
  const rim = Math.sin(Math.min(Math.PI / 2 - 1e-4, arcHalf));
  // Raise |x| before asin to tighten/loosen wrap; remap so |x|=1 → ±arcHalf
  const shaped = Math.sign(x) * Math.pow(Math.abs(x), 1 / k);
  const asinArg = Math.max(-1, Math.min(1, shaped * rim));
  const raw = Math.asin(asinArg);
  const denom = Math.asin(rim) || arcHalf;
  const cyl = raw * (arcHalf / denom);

  const w = Math.max(0, Math.min(2, edgeWarp));
  let theta = w <= 1 ? linear * (1 - w) + cyl * w : cyl;

  if (w > 1) {
    const e = 1 + (w - 1) * 1.5;
    theta = Math.sign(theta) * Math.pow(Math.abs(theta) / arcHalf, 1 / e) * arcHalf;
  }
  return theta;
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
 * Core cylinder projection.
 * For each output pixel, recover surface angle θ and sample the flat artwork.
 */
function warpToImageData(src, controls, width, height) {
  const { data: srcPixels, width: sw, height: sh } = src;
  const out = new ImageData(width, height);
  const dst = out.data;

  const arcHalf = ((controls.arcDeg * Math.PI) / 180) / 2;
  const rotate = (controls.rotateDeg * Math.PI) / 180;
  const crop = controls.crop;
  const usableHalf = 1 - crop;

  const [br, bg, bb] = hexToRgb(controls.bgColor);
  const solidBg = controls.bgMode === "solid";

  for (let py = 0; py < height; py++) {
    const ny = (py + 0.5) / height; // 0..1 top→bottom
    const cy = (ny - 0.5) * 2; // -1..1

    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const nxRaw = ((px + 0.5) / width) * 2 - 1; // -1..1
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

      // Remap x into cylinder face after side crop
      const nx = usableHalf > 0 ? nxRaw / usableHalf : nxRaw;

      if (Math.abs(nx) > 1) {
        if (solidBg) {
          dst[i] = br;
          dst[i + 1] = bg;
          dst[i + 2] = bb;
          dst[i + 3] = 255;
        }
        continue;
      }

      const theta = screenXToTheta(nx, arcHalf, controls.edgeWarp, controls.curvature);
      const depth = Math.cos(Math.min(Math.PI / 2, Math.abs(theta))); // 1 at center, 0 at rim

      // Horizontal source: arc position + rotation + offset, then scale around center
      let u = (theta - rotate) / (2 * arcHalf); // roughly -0.5..0.5 across visible arc
      u = u / controls.scaleX + 0.5 + controls.offsetX;

      // Vertical: scale + offset; perspective foreshortens height near edges; bow bends horizontals
      const persp = 1 + controls.perspective * (1 - depth);
      let v = (ny - 0.5 - controls.offsetY) / (controls.scaleY * persp) + 0.5;
      v += controls.vBow * (nx * nx) * (ny - 0.5) * 2;

      const sx = u * sw;
      const sy = v * sh;
      const rgba = sampleBilinear(srcPixels, sw, sh, sx, sy);

      let a = rgba[3];
      if (controls.falloff > 0) {
        const edge = Math.pow(1 - Math.min(1, absX / usableHalf), 1.2);
        const shade = 1 - controls.falloff * (1 - edge) * (1 - depth * 0.35);
        rgba[0] *= shade;
        rgba[1] *= shade;
        rgba[2] *= shade;
        a *= 0.55 + 0.45 * shade;
      }

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
  const left = width * crop;
  const right = width * (1 - crop);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 210, 120, 0.55)";
  ctx.lineWidth = Math.max(1, width * 0.0015);
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left, height);
  ctx.moveTo(right, 0);
  ctx.lineTo(right, height);
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // cylinder face bounds
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 210, 120, 0.28)";
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
    els.btnExport.disabled = false;
    els.btnFit.disabled = false;
    els.btnRedraw.disabled = false;
  }, 0);
}

async function exportPng() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting full resolution…");
  els.btnExport.disabled = true;

  await new Promise((r) => setTimeout(r, 20));
  const image = warpToImageData(sourceData, controls, controls.outW, controls.outH);
  const canvas = document.createElement("canvas");
  canvas.width = controls.outW;
  canvas.height = controls.outH;
  const ctx = canvas.getContext("2d");
  ctx.putImageData(image, 0, 0);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = sourceName.replace(/\.[^.]+$/, "") || "wrap";
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("Export failed");
      els.btnExport.disabled = false;
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-cylinder-${stamp}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${controls.outW}×${controls.outH} PNG`);
    els.btnExport.disabled = false;
  }, "image/png");
}

async function loadSvgFile(file) {
  const text = await file.text();
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

    // Prefer intrinsic size; fall back to viewBox-ish defaults
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    if (!w || !h) {
      const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
      const root = parsed.documentElement;
      const vb = root.getAttribute("viewBox");
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          w = parts[2];
          h = parts[3];
        }
      }
      w = w || 1024;
      h = h || 1024;
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
  pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = pdfDoc.numPages;
  els.pdfPage.max = String(pageCount);
  const page = Math.min(Math.max(1, pageNum), pageCount);
  els.pdfPage.value = String(page);

  const pdfPage = await pdfDoc.getPage(page);
  const unscaled = pdfPage.getViewport({ scale: 1 });
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
  els.btnExport.disabled = true;

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
    setStatus(err?.message || "Failed to load file");
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
  els.perspective.value = DEFAULTS.perspective;
  els.vBow.value = DEFAULTS.vBow;
  els.scaleX.value = DEFAULTS.scaleX;
  els.scaleY.value = DEFAULTS.scaleY;
  els.rotate.value = DEFAULTS.rotate;
  els.offsetX.value = DEFAULTS.offsetX;
  els.offsetY.value = DEFAULTS.offsetY;
  els.falloff.value = DEFAULTS.falloff;
  els.crop.value = DEFAULTS.crop;
  els.clipCylinder.checked = DEFAULTS.clipCylinder;
  els.showGuides.checked = DEFAULTS.showGuides;
  els.outW.value = DEFAULTS.outW;
  els.outH.value = DEFAULTS.outH;
  els.bgMode.value = DEFAULTS.bgMode;
  els.bgColor.value = DEFAULTS.bgColor;
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

  ["dragenter", "dragover"].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
    });
  });
  els.dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  const live = [
    els.curvature,
    els.arc,
    els.edgeWarp,
    els.perspective,
    els.vBow,
    els.scaleX,
    els.scaleY,
    els.rotate,
    els.offsetX,
    els.offsetY,
    els.falloff,
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
  els.btnFit.addEventListener("click", fitOutputToSource);
  els.btnRedraw.addEventListener("click", () => {
    renderToken++;
    renderPreview();
  });

  updateLabels();
}

bindUi();
setStatus("Upload a PDF or SVG to begin");
