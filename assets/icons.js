(() => {
  const ICONS = [21, 25, 22, 27, 26, 24, 29, 28].map((n) => `assets/icons/fig-${n}.svg`);
  const HOLD = 3200;
  const TRANSITION = 1400;
  const MAX_PIXELS = 1_600_000;

  const canvas = document.querySelector('.icon');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const images = new Map();
  let width = 0;
  let height = 0;
  let frame = null;
  let noise = null;
  let current = null;

  function loadImage(src) {
    if (!images.has(src)) {
      const img = new Image();
      img.src = src;
      images.set(src, img.decode().then(() => img));
    }
    return images.get(src);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    let scale = Math.min(devicePixelRatio || 1, 2);
    if (box.width * box.height * scale * scale > MAX_PIXELS) {
      scale = Math.sqrt(MAX_PIXELS / (box.width * box.height));
    }
    width = canvas.width = Math.max(1, Math.round(box.width * scale));
    height = canvas.height = Math.max(1, Math.round(box.height * scale));
    frame = ctx.createImageData(width, height);
    frame.data.fill(255);
    noise = makeNoise(width, height);
  }

  // Fractal value noise: thresholding it gives organic, grainy patches
  function makeNoise(w, h) {
    const out = new Float32Array(w * h);
    const octaves = [
      [Math.max(w, h) / 6, 0.6],
      [Math.max(w, h) / 24, 0.28],
      [3, 0.12],
    ];
    for (const [cell, weight] of octaves) {
      const gw = Math.ceil(w / cell) + 2;
      const gh = Math.ceil(h / cell) + 2;
      const grid = new Float32Array(gw * gh).map(Math.random);
      for (let y = 0; y < h; y++) {
        const gy = y / cell;
        const y0 = gy | 0;
        let ty = gy - y0;
        ty = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < w; x++) {
          const gx = x / cell;
          const x0 = gx | 0;
          let tx = gx - x0;
          tx = tx * tx * (3 - 2 * tx);
          const i = y0 * gw + x0;
          const top = grid[i] + (grid[i + 1] - grid[i]) * tx;
          const bottom = grid[i + gw] + (grid[i + gw + 1] - grid[i + gw]) * tx;
          out[y * w + x] += (top + (bottom - top) * ty) * weight;
        }
      }
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of out) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
    return out;
  }

  // Rasterise an icon, contained and centred, keeping only its alpha
  function alphaOf(img) {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const o = off.getContext('2d');
    const fit = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * fit;
    const h = img.naturalHeight * fit;
    o.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    const data = o.getImageData(0, 0, width, height).data;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    return alpha;
  }

  function draw(from, to, t) {
    const d = frame.data;
    const n = noise;
    if ((from && from.length !== n.length) || (to && to.length !== n.length)) return;
    for (let i = 0, j = 3; i < n.length; i++, j += 4) {
      d[j] = n[i] < t ? (to ? to[i] : 0) : from ? from[i] : 0;
    }
    ctx.putImageData(frame, 0, 0);
  }

  function transition(from, to) {
    if (reduceMotion) {
      draw(from, to, 1.01);
      return Promise.resolve();
    }
    return new Promise((done) => {
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / TRANSITION);
        draw(from, to, p * 1.02);
        if (p < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    resize();
    let index = 0;
    let from = null;
    while (true) {
      const src = ICONS[index % ICONS.length];
      const img = await loadImage(src);
      loadImage(ICONS[(index + 1) % ICONS.length]);
      const to = alphaOf(img);
      await transition(from, to);
      current = { img, alpha: to.length === width * height ? to : alphaOf(img) };
      if (current.alpha !== to) draw(current.alpha, null, 0);
      index++;
      await wait(HOLD);
      from = current.alpha;
    }
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (current) {
        current.alpha = alphaOf(current.img);
        draw(current.alpha, null, 0);
      }
    }, 150);
  });

  loadImage(ICONS[0]);
  const signetStroke = document.querySelector('.signet path');
  if (reduceMotion || !signetStroke) run();
  else signetStroke.addEventListener('animationend', run, { once: true });
})();
