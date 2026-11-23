// A glass surface on the page: one canvas, one scene, one material, drawn
// only while it can be seen. Handles visibility, reduced motion, resizing
// and cleanup, so the page script only says where the glass goes.
import { createGlassRenderer, type Pass } from './renderer';
import type { MaterialParams } from './material';
import type { ProceduralName } from './scenes';

export interface SurfaceOptions {
  scene: ProceduralName;
  params: MaterialParams;
  /** Element whose box is the fully tiled frame; tiles leak around it. */
  frame?: HTMLElement;
  /** A point (CSS px from the canvas's top-left) that tiles gather around instead of a frame. */
  anchor?: { x: number; y: number };
  leak?: number;
  reach?: number;
  corners?: [[number, number, number], [number, number, number]];
  /** Size tiles so this many columns fill the frame exactly. */
  columns?: number;
  /** Frames per second while animating. */
  fps: number;
  /** Scene time to start from, in seconds. */
  start: number;
  /** Render one frame and stop (reduced motion, captures). */
  still: boolean;
}

export interface Surface {
  /** Leave the frame's inside empty because an app is drawing there. */
  setHollow(hollow: boolean): void;
  dispose(): void;
}

export function mountSurface(canvas: HTMLCanvasElement, opts: SurfaceOptions): Surface | null {
  const renderer = createGlassRenderer(canvas, { maxDpr: 2 });
  if (!renderer) return null;
  renderer.setSource({ kind: 'procedural', name: opts.scene });
  canvas.dataset.ready = 'true';
  let hollow = false;
  let visible = true;
  let raf = 0;
  let last = -Infinity;
  const begin = performance.now();
  const now = () => (opts.still ? opts.start : opts.start + (performance.now() - begin) / 1000);

  function pass(): Pass {
    const c = canvas.getBoundingClientRect();
    if (opts.frame) {
      const f = opts.frame.getBoundingClientRect();
      const params = opts.columns ? { ...opts.params, tile: f.width / opts.columns } : opts.params;
      return { params, frame: { x: f.left - c.left, y: f.top - c.top, w: f.width, h: f.height }, leak: opts.leak, reach: opts.reach, corners: opts.corners, hollow };
    }
    const a = opts.anchor ?? { x: 0, y: 0 };
    return { params: opts.params, frame: { x: a.x, y: a.y, w: 0, h: 0 }, leak: opts.leak, reach: opts.reach };
  }
  const draw = () => renderer.render(now(), [pass()]);

  function tick(t: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (t - last >= 1000 / opts.fps) { last = t; draw(); }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (!opts.still && !raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { renderer.resize(); draw(); });
  ro.observe(canvas);
  if (opts.frame) ro.observe(opts.frame);
  const onVisibility = () => wake();
  document.addEventListener('visibilitychange', onVisibility);
  draw();
  wake();

  return {
    setHollow(h) { hollow = h; draw(); },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
