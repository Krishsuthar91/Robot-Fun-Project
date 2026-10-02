(() => {
  'use strict';

  /* ---------- Config ---------- */
  const FRAME_COUNT = 180;
  const FRAME_PATH  = (n) => `frames/frame_${String(n).padStart(4, '0')}.jpg`;
  const BG          = '#E1E4E9';   // must match page + frames
  const EASE        = 0.085;       // 0..1, lower = floatier
  const MAX_DPR     = 2;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Elements ---------- */
  const story    = document.getElementById('story');
  const canvas   = document.getElementById('canvas');
  const ctx      = canvas.getContext('2d', { alpha: false });
  const nav      = document.getElementById('nav');
  const loader   = document.getElementById('loader');
  const loaderN  = document.getElementById('loaderNum');
  const loaderB  = document.getElementById('loaderBar');
  const meter    = document.getElementById('meter');
  const cue      = document.getElementById('cue');
  const beats    = [...document.querySelectorAll('.beat')].map((el) => ({
    el, in: parseFloat(el.dataset.in), out: parseFloat(el.dataset.out),
    center: el.classList.contains('beat--center'),
  }));

  /* ---------- Preload ---------- */
  const frames = new Array(FRAME_COUNT).fill(null);
  let loaded = 0;
  let ready  = false;

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        frames[i] = img;
        loaded++;
        const pct = Math.round((loaded / FRAME_COUNT) * 100);
        loaderN.textContent = pct;
        loaderB.style.transform = `scaleX(${loaded / FRAME_COUNT})`;
        resolve();
      };
      img.onerror = () => { loaded++; resolve(); };   // skip a missing frame, don't hang
      img.src = FRAME_PATH(i + 1);
    });
  }

  async function preload() {
    await loadFrame(0);          // first frame immediately, so something can draw
    resize();
    // then the rest, in small parallel batches so the browser isn't flooded
    const BATCH = 12;
    for (let i = 1; i < FRAME_COUNT; i += BATCH) {
      const group = [];
      for (let j = i; j < Math.min(i + BATCH, FRAME_COUNT); j++) group.push(loadFrame(j));
      await Promise.all(group);
    }
    ready = true;
    loader.classList.add('is-done');
    lastDrawn = -1;
  }

  /* ---------- Canvas sizing & drawing ---------- */
  let cw = 0, ch = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width  = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    lastDrawn = -1;
    draw(Math.round(current));
  }

  let lastDrawn = -1;

  function nearestLoaded(idx) {
    if (frames[idx]) return frames[idx];
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (frames[idx - d]) return frames[idx - d];
      if (frames[idx + d]) return frames[idx + d];
    }
    return null;
  }

  function draw(idx) {
    if (idx === lastDrawn) return;
    const img = nearestLoaded(idx);
    if (!img) return;
    lastDrawn = idx;

    // Solid fill in the exact page colour, so any letterboxing is invisible.
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cw, ch);

    // Landscape screens: cover. Portrait screens: contain, so the whole robot fits
    // and the leftover bands are the same colour as the page.
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const cover = cw / ch >= 1;
    const s = cover ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* ---------- Scroll → progress ---------- */
  let progress = 0;
  let target   = 0;
  let current  = 0;

  function readScroll() {
    const rect  = story.getBoundingClientRect();
    const total = story.offsetHeight - window.innerHeight;
    progress = Math.min(1, Math.max(0, -rect.top / total));
    target   = progress * (FRAME_COUNT - 1);
  }

  /* ---------- Text beats ---------- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const FADE = 0.04;

  function updateBeats(p) {
    for (const b of beats) {
      const a = clamp01((p - b.in) / FADE) * (1 - clamp01((p - (b.out - FADE)) / FADE));
      b.el.style.opacity = a.toFixed(3);
      const y = (1 - a) * 18;
      b.el.style.transform = b.center
        ? `translate(-50%, ${y}px)`
        : `translateY(${y}px)`;
    }
    cue.style.opacity = p > 0.02 ? 0 : 1;
    meter.style.transform = `scaleX(${p})`;
  }

  /* ---------- Nav ---------- */
  function updateNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  /* ---------- Main loop ---------- */
  function tick() {
    readScroll();

    // Ease the played frame toward the scroll target.
    const delta = target - current;
    current = reduceMotion || Math.abs(delta) < 0.001 ? target : current + delta * EASE;

    draw(Math.round(current));
    updateBeats(progress);
    updateNav();

    requestAnimationFrame(tick);
  }

  /* ---------- Init ---------- */
  window.addEventListener('resize', resize);
  window.addEventListener('load', () => { readScroll(); current = target; });

  // Browsers restore scroll position on reload; start from where we are, not from 0.
  readScroll();
  current = target;

  resize();
  preload();
  requestAnimationFrame(tick);
})();
