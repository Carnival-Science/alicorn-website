import { mountSurface } from '../lib/glass/surface';
import { presets } from '../lib/glass/material';

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// `?still` renders the settled composition without motion (for captures);
// `?still=90` freezes the sky at that second of its sequence.
const stillParam = new URLSearchParams(location.search).get('still');
const still = stillParam !== null;
if (still) document.documentElement.classList.add('is-still');
const quiet = () => still || reduced.matches;

/* ── the glass: a sky behind square tiles, leaking past the stage ──────── */
const statusEl = $<HTMLElement>('[data-status]');
const status = (text: string) => { statusEl.textContent = text; };
// start somewhere in the sequence so every visit opens on a different sky
const start = still ? Number(stillParam) || 40 : 20 + Math.random() * 400;
const stageGlass = mountSurface($<HTMLCanvasElement>('[data-glass]'), {
  scene: 'sky', params: presets.cast, frame: $<HTMLElement>('[data-mount]'),
  // 24 × 15 tiles fill the 16:10 stage exactly; tiles escape up and to the
  // right, and drift a little out to the left
  columns: 24, leak: 1.1, reach: 5, corners: [[1, 0, 1.25], [0, 0.85, 0.45]],
  fps: 30, start, still: quiet(),
});
// an ornament: a few tiles of the same sky at the corner of the sheet
const ornament = document.querySelector<HTMLCanvasElement>('[data-ornament]');
if (ornament) {
  mountSurface(ornament, {
    scene: 'sky', params: { ...presets.cast, seed: 3 }, anchor: { x: 0, y: 0 },
    leak: 1.6, reach: 3.2, fps: 15, start: start + 9, still: quiet(),
  });
}
status('standby · awaiting module');

/* ── raster dissolve for panel changes ──────────────────────────────────── */
function dissolve(el: HTMLElement) {
  if (quiet()) return;
  const r = el.getBoundingClientRect();
  const cell = 10;
  const w = Math.ceil(r.width / cell), h = Math.ceil(r.height / cell);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.className = 'dissolve';
  const g = c.getContext('2d')!;
  g.fillStyle = getComputedStyle(document.body).backgroundColor;
  g.fillRect(0, 0, w, h);
  el.append(c);
  const order = Array.from({ length: w * h }, (_, i) => i).sort(() => Math.random() - .5);
  const per = Math.ceil(order.length / 12);
  let k = 0;
  const step = () => {
    for (let i = 0; i < per && k < order.length; i++, k++) g.clearRect(order[k] % w, Math.floor(order[k] / w), 1, 1);
    if (k < order.length) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

/* ── tabs (ARIA tabs pattern) ───────────────────────────────────────────── */
function tabs(list: HTMLElement[], select: (tab: HTMLElement) => void) {
  list.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : d ? (i + d + list.length) % list.length : -1;
      if (to < 0) return;
      e.preventDefault();
      list[to].focus();
      select(list[to]);
    });
  });
  return (tab: HTMLElement) => list.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
}

const readout = $<HTMLElement>('[data-readout]');
const caption = $<HTMLElement>('[data-caption]');
const peek = $<HTMLElement>('[data-peek]');
const toggle = $<HTMLButtonElement>('[data-peek-toggle]');

const markTab = tabs($$<HTMLElement>('[data-tab]'), (tab) => {
  if (tab.getAttribute('aria-selected') === 'true' && peek.hidden) return;
  markTab(tab);
  if (!peek.hidden) setPeek(false, false);
  let next: HTMLElement | undefined;
  $$<HTMLElement>('[data-panel]').forEach((p) => {
    p.hidden = p.dataset.panel !== tab.dataset.tab;
    if (!p.hidden) next = p;
  });
  if (next?.dataset.caption) caption.textContent = next.dataset.caption;
  dissolve(readout);
});

/* ── source drawer: takes the place of the text column ──────────────────── */
function setPeek(open: boolean, focus = true) {
  toggle.setAttribute('aria-expanded', String(open));
  peek.hidden = !open;
  readout.hidden = open;
  if (open) {
    dissolve(peek);
    if (focus) $<HTMLElement>('[role=tab][aria-selected=true]', peek).focus();
  } else if (focus) {
    toggle.focus();
  }
}
toggle.addEventListener('click', () => setPeek(peek.hidden === true));
$('[data-peek-close]').addEventListener('click', () => setPeek(false));
peek.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPeek(false); });
const markFile = tabs($$<HTMLElement>('[data-file]', peek), (tab) => {
  markFile(tab);
  $$<HTMLElement>('[role=tabpanel]', peek).forEach((p) => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
});

/* ── copy buttons ───────────────────────────────────────────────────────── */
document.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!b) return;
  const label = b.textContent;
  try { await navigator.clipboard.writeText(b.dataset.copy ?? ''); b.textContent = 'copied'; }
  catch { b.textContent = 'select text'; }
  setTimeout(() => { b.textContent = label; }, 1400);
});

/* ── the stage: the Alicorn app compiled for WebGPU ────────────────────── */
const mount = $<HTMLElement>('[data-mount]');
const lamp = $<HTMLElement>('[data-lamp]');
const adapterEl = $('[data-adapter]');

// The demo app lays out for a desktop-sized stage. Narrower than this the
// stage keeps its sky, and the app is only fetched if the stage grows.
const MIN_STAGE_WIDTH = 540;

async function boot() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  adapterEl.textContent = adapter ? 'webgpu ready' : gpu ? 'no webgpu adapter' : 'webgpu unavailable';
  // `?still` keeps the sky for captures; so does a browser that cannot run the app
  if (mount.dataset.live === undefined || still) return;
  if (!adapter) { lamp.dataset.state = 'error'; status('cannot mount · sky only'); return; }
  if (mount.clientWidth < MIN_STAGE_WIDTH) {
    status('sky only · app needs a wider stage');
    const watch = new ResizeObserver(() => {
      if (mount.clientWidth < MIN_STAGE_WIDTH) return;
      watch.disconnect();
      void run();
    });
    watch.observe(mount);
    return;
  }
  void run();
}

async function run() {
  const appCanvas = $<HTMLCanvasElement>('[data-stage-canvas]');
  const controller = new AbortController();
  addEventListener('pagehide', () => controller.abort(), { once: true });
  try {
    status('loading module');
    const { default: mountApp } = await import('../lib/stage-loader');
    appCanvas.hidden = false;
    $<HTMLElement>('[data-standby]').hidden = true;
    stageGlass?.setHollow(true);
    lamp.dataset.state = 'live';
    const fail = (text: string) => { lamp.dataset.state = 'error'; status(text); };
    const teardown = await mountApp({ canvas: appCanvas, signal: controller.signal, status, error: fail });
    if (teardown) controller.signal.addEventListener('abort', teardown);
    status('running');
  } catch (error) {
    // fall back to the sky
    appCanvas.hidden = true;
    $<HTMLElement>('[data-standby]').hidden = false;
    stageGlass?.setHollow(false);
    lamp.dataset.state = 'error';
    status('failed: ' + (error instanceof Error ? error.message : 'unknown'));
  }
}

void boot();
