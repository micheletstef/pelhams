(() => {
  const ICONS = [21, 25, 22, 27, 26, 24, 29, 28].map((n) => `assets/icons/fig-${n}.svg`);
  const HOLD = 10000;
  const MAX_PIXELS = 1_600_000;

  const canvas = document.querySelector('.icon');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const images = new Map();
  let width = 0;
  let height = 0;
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
  }

  // Draw an icon, contained and centred, as a silhouette in the current text colour
  function draw(img) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    const fit = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * fit;
    const h = img.naturalHeight * fit;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = getComputedStyle(canvas).color;
    ctx.fillRect(0, 0, width, height);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    resize();
    for (let index = 0; ; index++) {
      current = await loadImage(ICONS[index % ICONS.length]);
      loadImage(ICONS[(index + 1) % ICONS.length]);
      draw(current);
      await wait(HOLD);
    }
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (current) draw(current);
    }, 150);
  });

  document.addEventListener('themechange', () => {
    if (current) draw(current);
  });

  loadImage(ICONS[0]);
  const signetStroke = document.querySelector('.signet path');
  if (reduceMotion || !signetStroke) run();
  else signetStroke.addEventListener('animationend', run, { once: true });
})();
