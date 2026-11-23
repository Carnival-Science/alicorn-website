// Material lab controller. State lives in the URL so any view can be shared
// or captured: ?scene=video:sky&preset=lens&t=12&paused=1&compare=1&tile=12
import { createGlassRenderer, type Pass, type SourceSpec } from '../lib/glass/renderer';
import { presets, type MaterialParams } from '../lib/glass/material';
import type { ProceduralName } from '../lib/glass/scenes';

const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;
const canvas = $<HTMLCanvasElement>('[data-canvas]');
const form = $<HTMLFormElement>('[data-panel]');
const labels = $<HTMLElement>('[data-labels]');
const readout = $<HTMLElement>('[data-readout]');
const footage = document.body.dataset.footage!;
const compareSet = ['cast', 'pixel', 'lens', 'pressed', 'signature', 'bypass'] as const;
const numeric = ['tile', 'gap', 'round', 'refract', 'gather', 'diffuse', 'rough', 'imperfect', 'highlight', 'reflect', 'tint', 'bubbles', 'grain', 'saturation', 'levels', 'duotone', 'groutScene', 'profile'] as const;

interface State { scene: string; preset: string; compare: boolean; bypass: boolean; paused: boolean; speed: number; t: number; params: MaterialParams }

const renderer = createGlassRenderer(canvas, { maxDpr: 2 });
if (!renderer) throw new Error('WebGL unavailable');

const q = new URLSearchParams(location.search);
const startPreset = q.get('preset') && presets[q.get('preset')!] ? q.get('preset')! : 'cast';
const state: State = {
  scene: q.get('scene') ?? 'sky',
  preset: startPreset,
  compare: q.get('compare') === '1',
  bypass: q.get('bypass') === '1',
  paused: q.get('paused') === '1' || q.has('t'),
  speed: Number(q.get('speed') ?? 1),
  t: Number(q.get('t') ?? 0),
  params: { ...presets[startPreset] },
};
for (const k of numeric) if (q.has(k)) (state.params as unknown as Record<string, number>)[k] = Number(q.get(k));

/* ── sources ───────────────────────────────────────────────────────────── */
const videos = new Map<string, HTMLVideoElement>();
let video: HTMLVideoElement | null = null;
function videoFor(name: string) {
  let v = videos.get(name);
  if (!v) {
    v = document.createElement('video');
    v.src = `${footage}/${name}.webm`;
    v.poster = `${footage}/${name}.jpg`;
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    videos.set(name, v);
  }
  return v;
}
function applyScene() {
  video?.pause();
  video = null;
  const [kind, name] = state.scene.includes(':') ? state.scene.split(':') : ['procedural', state.scene];
  let spec: SourceSpec;
  if (kind === 'video') {
    video = videoFor(name);
    spec = { kind: 'video', video };
    video.playbackRate = Math.max(0.0625, state.speed || 1);
    if (!state.paused && state.speed > 0) video.play().catch(() => {});
  } else if (kind === 'image') {
    const img = new Image();
    img.src = `${footage}/${name}.jpg`;
    spec = { kind: 'image', image: img };
  } else {
    spec = { kind: 'procedural', name: name as ProceduralName };
  }
  renderer!.setSource(spec);
  needsDraw = true;
}

/* ── drawing ───────────────────────────────────────────────────────────── */
let needsDraw = true;
function passes(): Pass[] {
  if (!state.compare) return [{ params: state.params, bypass: state.bypass }];
  const r = canvas.getBoundingClientRect();
  const w = r.width / 3, h = r.height / 2;
  return compareSet.map((name, i) => ({
    rect: { x: (i % 3) * w, y: Math.floor(i / 3) * h, w, h },
    params: name === 'bypass' ? presets.cast : name === state.preset ? state.params : presets[name],
    bypass: state.bypass || name === 'bypass',
  }));
}
function draw() {
  const t0 = performance.now();
  renderer!.render(video ? video.currentTime : state.t, passes());
  lastCost = performance.now() - t0;
  needsDraw = false;
}
let lastCost = 0;

function labelsFor() {
  labels.replaceChildren(...(state.compare ? compareSet.map((n) => Object.assign(document.createElement('span'), { textContent: n === 'cast' ? 'cast (current)' : n === 'bypass' ? 'no glass' : n })) : []));
}

/* ── controls ──────────────────────────────────────────────────────────── */
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
function syncForm() {
  field('scene').value = state.scene;
  field('preset').value = state.preset;
  (field('compare') as HTMLInputElement).checked = state.compare;
  (field('bypass') as HTMLInputElement).checked = state.bypass;
  field('speed').value = String(state.speed);
  for (const k of numeric) {
    const el = field(k);
    el.value = String((state.params as unknown as Record<string, number>)[k]);
    const out = form.querySelector(`[data-out="${k}"]`);
    if (out) out.textContent = String(+Number(el.value).toFixed(3));
  }
  form.querySelector('[data-out="speed"]')!.textContent = String(state.speed);
  $('[data-play]').textContent = state.paused ? 'Play' : 'Pause';
  labelsFor();
}
function syncURL() {
  const u = new URLSearchParams({ scene: state.scene, preset: state.preset });
  if (state.compare) u.set('compare', '1');
  if (state.bypass) u.set('bypass', '1');
  if (state.paused) u.set('t', state.t.toFixed(2));
  if (state.speed !== 1) u.set('speed', String(state.speed));
  const base = presets[state.preset] as unknown as Record<string, number>;
  for (const k of numeric) {
    const v = (state.params as unknown as Record<string, number>)[k];
    if (v !== base[k]) u.set(k, String(v));
  }
  history.replaceState(null, '', `?${u}`);
}

form.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.name === 'scene') { state.scene = el.value; applyScene(); }
  else if (el.name === 'preset') { state.preset = el.value; state.params = { ...presets[el.value] }; }
  else if (el.name === 'compare') state.compare = (el as HTMLInputElement).checked;
  else if (el.name === 'bypass') state.bypass = (el as HTMLInputElement).checked;
  else if (el.name === 'speed') { state.speed = Number(el.value); if (video) video.playbackRate = Math.max(0.0625, state.speed); }
  else if (el.name === 't') { setTime(Number(el.value)); }
  else if ((numeric as readonly string[]).includes(el.name)) (state.params as unknown as Record<string, number>)[el.name] = Number(el.value);
  syncForm(); syncURL(); needsDraw = true;
});

function setPaused(p: boolean) {
  state.paused = p;
  if (video) { if (p) video.pause(); else video.play().catch(() => {}); }
  syncForm(); syncURL();
}
async function setTime(t: number) {
  state.t = Math.max(0, t);
  if (video) await seek(video, state.t);
  needsDraw = true;
}
function seek(v: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    const go = () => {
      const target = v.duration ? t % v.duration : t;
      if (Math.abs(v.currentTime - target) < 1e-3) return resolve();
      // some decoders never report a seek that lands on the current frame
      const timer = setTimeout(resolve, 1500);
      v.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
      v.currentTime = target;
    };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  });
}
$('[data-play]').addEventListener('click', () => setPaused(!state.paused));
form.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => { setPaused(true); setTime(state.t + Number(b.dataset.step)); syncURL(); }));
$('[data-capture]').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `glass-${state.scene.replace(':', '-')}-${state.compare ? 'compare' : state.preset}-t${state.t.toFixed(1)}.png`;
  a.click();
});
$('[data-bench]').addEventListener('click', () => { const b = bench(60); readout.textContent = `${b.msPerFrame.toFixed(2)} ms/frame GPU+CPU over ${b.frames} frames at ${b.width}×${b.height} device px`; });
$('[data-link]').addEventListener('click', () => navigator.clipboard?.writeText(location.href));
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select')) return;
  if (e.key === ' ') { e.preventDefault(); setPaused(!state.paused); }
  if (e.key === 'ArrowRight') { setPaused(true); setTime(state.t + (e.shiftKey ? 5 : 1)); }
  if (e.key === 'ArrowLeft') { setPaused(true); setTime(state.t - (e.shiftKey ? 5 : 1)); }
  if (e.key === 'b') { state.bypass = !state.bypass; syncForm(); syncURL(); needsDraw = true; }
  if (e.key === 'c') { state.compare = !state.compare; syncForm(); syncURL(); needsDraw = true; }
});
new ResizeObserver(() => { renderer.resize(); needsDraw = true; }).observe(canvas);

/* ── loop: redraw only when something changed ─────────────────────────── */
let last = performance.now();
let frames = 0, drawn = 0, fpsAt = performance.now();
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (!document.hidden) {
    if (!state.paused) {
      if (video) { state.t = video.currentTime; if (renderer!.dirty) needsDraw = true; }
      else { state.t += dt * state.speed; needsDraw = true; }
    }
    if (needsDraw) { draw(); drawn++; }
  }
  frames++;
  if (now - fpsAt > 1000) {
    readout.textContent = `t ${state.t.toFixed(2)} s · ${drawn} draws/s · last draw ${lastCost.toFixed(2)} ms (CPU submit) · ${canvas.width}×${canvas.height} px`;
    (field('t') as HTMLInputElement).value = state.t.toFixed(2);
    frames = 0; drawn = 0; fpsAt = now;
  }
  requestAnimationFrame(loop);
}

/** Synchronous timing: draws n frames and waits for the GPU each time. */
function bench(n: number) {
  const gl = renderer!.gl;
  const px = new Uint8Array(4);
  draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    renderer!.render(state.t + i / 30, passes());
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // forces completion
  }
  return { msPerFrame: (performance.now() - t0) / n, frames: n, width: canvas.width, height: canvas.height };
}

/* ── scripting hooks for captures ─────────────────────────────────────── */
declare global { interface Window { __lab: unknown } }
window.__lab = {
  state,
  async set(next: Partial<State> & { params?: Partial<MaterialParams> }) {
    const sceneChanged = next.scene && next.scene !== state.scene;
    if (next.preset) state.params = { ...presets[next.preset] };
    Object.assign(state, { ...next, params: { ...state.params, ...(next.params ?? {}) } });
    if (sceneChanged) applyScene();
    syncForm(); syncURL();
    if (video) await new Promise<void>((r) => (video!.readyState >= 2 ? r() : video!.addEventListener('loadeddata', () => r(), { once: true })));
  },
  async at(t: number) {
    state.paused = true;
    video?.pause();
    await setTime(t);
    if (video) await new Promise((r) => requestAnimationFrame(r));
    draw();
  },
  png: () => canvas.toDataURL('image/png'),
  bench,
};

applyScene();
syncForm();
requestAnimationFrame(loop);
