import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";
import { PDFDocument, rgb } from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";

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
  pdfStrips: $("pdf-strips"),
  btnReset: $("btn-reset"),
  btnExport: $("btn-export"),
  btnExportPdf: $("btn-export-pdf"),
  btnFit: $("btn-fit"),
  btnRedraw: $("btn-redraw"),
  status: $("status"),
  preview: $("preview"),
  curvatureVal: $("curvature-val"),
  arcVal: $("arc-val"),
  edgeWarpVal: $("edge-warp-val"),
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
  arc: 140,
  edgeWarp: 1,
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
  bgColor: "#808080",
  pdfPage: 1,
  sourceDpi: 300,
  pdfStrips: 180,
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
    pdfStrips: Math.max(20, Math.min(600, Math.round(Number(els.pdfStrips.value) || DEFAULTS.pdfStrips))),
  };
}

function updateLabels() {
  const c = readControls();
  els.curvatureVal.textContent = c.wrap.toFixed(2);
  els.arcVal.textContent = `${Math.round(c.labelArcDeg)}°`;
  els.edgeWarpVal.textContent = c.edgeSquash.toFixed(2);
  els.vBowVal.textContent = c.hCurve.toFixed(2);
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
  // Fraction of the flat label shown across the bottle front
  const labelSpan = Math.max(0.15, Math.min(1, controls.labelArcDeg / 180));
  const rotateU = controls.rotateDeg / 180; // spin as fraction of full label width

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

      // Surface parameter after cylindrical foreshortening (-1..1)
      const surface = screenXToSurfaceU(nx, controls.wrap, controls.edgeSquash);

      // Map surface → source U. Label arc zooms which slice of the flat art is visible.
      let u = 0.5 + surface * (labelSpan * 0.5) / controls.scaleX + controls.offsetX + rotateU;

      // Vertical: straight down the bottle. Optional slight bow for camera angle.
      let v = 0.5 + (ny - 0.5 - controls.offsetY) / controls.scaleY;
      if (controls.hCurve !== 0) {
        // Mild parabolic bow of horizontal lines (camera looking slightly up/down)
        v += controls.hCurve * 0.15 * (nx * nx) * (ny - 0.5) * 2;
      }

      const sx = u * sw;
      const sy = v * sh;
      const rgba = sampleBilinear(srcPixels, sw, sh, sx, sy);

      // Lighting from cylinder normal: cos(θ) = sqrt(1 - sin²θ) = sqrt(1 - nx²)
      let a = rgba[3];
      if (controls.falloff > 0) {
        const cosN = Math.sqrt(Math.max(0, 1 - nx * nx));
        const shade = 1 - controls.falloff * (1 - cosN);
        rgba[0] *= shade;
        rgba[1] *= shade;
        rgba[2] *= shade;
        a *= 0.65 + 0.35 * shade;
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
 * Build vertical strips that approximate the cylinder warp for vector export.
 * Each strip maps a source U-range onto a destination X-range with local scale.
 */
function buildCylinderStrips(controls, stripCount) {
  const crop = controls.crop;
  const usableHalf = Math.max(0.01, 1 - crop);
  const labelSpan = Math.max(0.15, Math.min(1, controls.labelArcDeg / 180));
  const rotateU = controls.rotateDeg / 180;
  const strips = [];

  for (let i = 0; i < stripCount; i++) {
    const t0 = i / stripCount;
    const t1 = (i + 1) / stripCount;
    const nx0 = -1 + 2 * t0;
    const nx1 = -1 + 2 * t1;
    const nxMid = (nx0 + nx1) / 2;

    // Destination X in normalized canvas space (-1..1), then 0..1
    // Only the usable cylinder face is filled; outside is empty when clipped.
    const faceX0 = nx0 * usableHalf;
    const faceX1 = nx1 * usableHalf;
    const dstX0 = (faceX0 + 1) / 2;
    const dstX1 = (faceX1 + 1) / 2;

    const surface0 = screenXToSurfaceU(nx0, controls.wrap, controls.edgeSquash);
    const surface1 = screenXToSurfaceU(nx1, controls.wrap, controls.edgeSquash);
    const surfaceMid = screenXToSurfaceU(nxMid, controls.wrap, controls.edgeSquash);

    const srcU0 = 0.5 + surface0 * (labelSpan * 0.5) / controls.scaleX + controls.offsetX + rotateU;
    const srcU1 = 0.5 + surface1 * (labelSpan * 0.5) / controls.scaleX + controls.offsetX + rotateU;
    const srcUMid = 0.5 + surfaceMid * (labelSpan * 0.5) / controls.scaleX + controls.offsetX + rotateU;

    // Vertical mapping (uniform; bow applied as slight Y scale/offset per strip)
    const vCenter = 0.5 - controls.offsetY / controls.scaleY;
    const vHalf = 0.5 / controls.scaleY;
    let srcV0 = vCenter - vHalf;
    let srcV1 = vCenter + vHalf;
    if (controls.hCurve !== 0) {
      const bow = controls.hCurve * 0.15 * (nxMid * nxMid);
      srcV0 += bow * -0.5;
      srcV1 += bow * 0.5;
    }

    // Soft shade from cylinder normal
    const cosN = Math.sqrt(Math.max(0, 1 - nxMid * nxMid));
    const shade = controls.falloff > 0 ? 1 - controls.falloff * (1 - cosN) : 1;

    strips.push({
      dstX0,
      dstX1,
      srcU0,
      srcU1,
      srcUMid,
      srcV0,
      srcV1,
      shade,
      absNx: Math.abs(nxMid),
    });
  }

  return strips;
}

function setExportBusy(busy) {
  els.btnExport.disabled = busy || !sourceData;
  els.btnExportPdf.disabled = busy || !sourceData;
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

/**
 * Build a warped SVG using clipped vertical strips (vector-preserving for SVG sources).
 */
function buildWarpedSvg(controls) {
  if (!sourceSvgText || !sourceVectorSize) throw new Error("No SVG source");
  const { w: sw, h: sh } = sourceVectorSize;
  const outW = controls.outW;
  const outH = controls.outH;
  const strips = buildCylinderStrips(controls, controls.pdfStrips);
  const uid = `w${Math.random().toString(36).slice(2, 8)}`;

  // Inline source SVG as a symbol so each strip can reuse it
  const { root } = parseSvgSize(sourceSvgText);
  root.removeAttribute("width");
  root.removeAttribute("height");
  if (!root.getAttribute("viewBox")) {
    root.setAttribute("viewBox", `0 0 ${sw} ${sh}`);
  }
  const inner = root.innerHTML;
  const vb = root.getAttribute("viewBox") || `0 0 ${sw} ${sh}`;

  let bg = "";
  if (controls.bgMode === "solid") {
    bg = `<rect width="100%" height="100%" fill="${controls.bgColor}"/>`;
  }

  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">`,
  );
  const clipDefs = [];
  const groups = [];

  for (let i = 0; i < strips.length; i++) {
    const s = strips[i];
    const dx = s.dstX0 * outW;
    const dw = Math.max(0.25, (s.dstX1 - s.dstX0) * outW);
    const su0 = Math.min(s.srcU0, s.srcU1);
    const su1 = Math.max(s.srcU0, s.srcU1);
    const srcX = su0 * sw;
    const srcStripW = Math.max(1e-4, (su1 - su0) * sw);
    const srcY = s.srcV0 * sh;
    const srcStripH = Math.max(1e-4, (s.srcV1 - s.srcV0) * sh);

    const scaleX = dw / srcStripW;
    const scaleY = outH / srcStripH;
    const tx = dx - srcX * scaleX;
    const ty = 0 - srcY * scaleY;
    const opacity = Math.max(0.05, Math.min(1, s.shade));

    clipDefs.push(
      `<clipPath id="${uid}-c${i}"><rect x="${dx.toFixed(3)}" y="0" width="${dw.toFixed(3)}" height="${outH}"/></clipPath>`,
    );
    groups.push(
      `<g clip-path="url(#${uid}-c${i})"><use href="#${uid}-src" xlink:href="#${uid}-src" transform="matrix(${scaleX.toFixed(6)} 0 0 ${scaleY.toFixed(6)} ${tx.toFixed(3)} ${ty.toFixed(3)})" opacity="${opacity.toFixed(3)}"/></g>`,
    );
  }

  parts.push(`<defs>`);
  parts.push(`<svg id="${uid}-src" viewBox="${vb}" width="${sw}" height="${sh}">${inner}</svg>`);
  parts.push(clipDefs.join(""));
  parts.push(`</defs>`);
  parts.push(bg);
  parts.push(groups.join(""));
  parts.push(`</svg>`);
  return parts.join("");
}

async function exportPdfFromPdfSource(controls) {
  if (!sourcePdfBytes) throw new Error("No PDF source loaded");

  const srcDoc = await PDFDocument.load(sourcePdfBytes.slice(0));
  const pageIndex = Math.max(0, (Number(els.pdfPage.value) || 1) - 1);
  const srcPage = srcDoc.getPages()[Math.min(pageIndex, srcDoc.getPageCount() - 1)];
  const srcW = srcPage.getWidth();
  const srcH = srcPage.getHeight();

  // Output size in PDF points (match preview aspect; 96px ≈ 72pt)
  const pageW = controls.outW * 0.75;
  const pageH = controls.outH * 0.75;

  const outDoc = await PDFDocument.create();
  const page = outDoc.addPage([pageW, pageH]);

  if (controls.bgMode === "solid") {
    const [r, g, b] = hexToRgb(controls.bgColor);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
      color: rgb(r / 255, g / 255, b / 255),
    });
  }

  const strips = buildCylinderStrips(controls, controls.pdfStrips);

  for (const s of strips) {
    const su0 = Math.min(s.srcU0, s.srcU1);
    const su1 = Math.max(s.srcU0, s.srcU1);
    const sv0 = s.srcV0;
    const sv1 = s.srcV1;

    if (su1 <= 0 || su0 >= 1 || sv1 <= 0 || sv0 >= 1) continue;

    const left = Math.max(0, su0) * srcW;
    const right = Math.min(1, su1) * srcW;
    // Source v is top→bottom; PDF y is bottom→top
    const bottom = (1 - Math.min(1, sv1)) * srcH;
    const top = (1 - Math.max(0, sv0)) * srcH;
    if (right - left < 0.01 || top - bottom < 0.01) continue;

    const embedded = await outDoc.embedPage(srcPage, { left, bottom, right, top });

    const dstX = s.dstX0 * pageW;
    const dstW = Math.max(0.2, (s.dstX1 - s.dstX0) * pageW);

    // Stretch the source V window across the full page height (matches preview)
    page.drawPage(embedded, {
      x: dstX,
      y: 0,
      width: dstW,
      height: pageH,
      opacity: Math.max(0.05, Math.min(1, s.shade)),
    });
  }

  const bytes = await outDoc.save();
  downloadBlob(
    new Blob([bytes], { type: "application/pdf" }),
    `${exportBaseName()}-cylinder-${exportStamp()}.pdf`,
  );
}

async function exportPdfFromSvgSource(controls) {
  const svgText = buildWarpedSvg(controls);
  const stamp = exportStamp();
  const base = exportBaseName();

  // Always offer the warped SVG (true vectors)
  downloadBlob(new Blob([svgText], { type: "image/svg+xml" }), `${base}-cylinder-${stamp}.svg`);

  // Convert warped SVG → vector PDF via svg2pdf.js + jsPDF
  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");
  await import("https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/+esm");

  const pageW = controls.outW * 0.75;
  const pageH = controls.outH * 0.75;
  const doc = new jsPDF({ unit: "pt", format: [pageW, pageH], compress: true });

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;overflow:hidden;";
  container.innerHTML = svgText;
  const svgEl = container.querySelector("svg");
  if (!svgEl) throw new Error("Failed to build warped SVG");
  document.body.appendChild(container);
  try {
    await doc.svg(svgEl, { x: 0, y: 0, width: pageW, height: pageH });
  } finally {
    container.remove();
  }

  downloadBlob(doc.output("blob"), `${base}-cylinder-${stamp}.pdf`);
}

async function exportPdf() {
  if (!sourceData) return;
  const controls = readControls();
  setStatus("Exporting vector PDF…");
  setExportBusy(true);
  await new Promise((r) => setTimeout(r, 20));

  try {
    if (sourceKind === "pdf") {
      await exportPdfFromPdfSource(controls);
      setStatus(`Exported vector PDF (${controls.pdfStrips} strips)`);
    } else if (sourceKind === "svg") {
      await exportPdfFromSvgSource(controls);
      setStatus(`Exported vector SVG + PDF (${controls.pdfStrips} strips)`);
    } else {
      throw new Error("Reload the file to enable vector PDF export");
    }
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
  els.pdfStrips.value = DEFAULTS.pdfStrips;
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
  els.btnExportPdf.addEventListener("click", exportPdf);
  els.btnFit.addEventListener("click", fitOutputToSource);
  els.btnRedraw.addEventListener("click", () => {
    renderToken++;
    renderPreview();
  });

  updateLabels();
}

bindUi();
setStatus("Upload a PDF or SVG to begin");
