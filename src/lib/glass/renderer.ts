// Glues a scene source to the glass material on one canvas.
//
// Sources render or upload into a texture; the material reads it. Procedural
// scenes redraw for any time; video sources upload only when a new decoded
// frame arrives; still images upload once. Several material passes can share
// one scene frame (the playground's comparison grid).
import { compile, fullscreen, target, texture, type Target } from './gl';
import { proceduralScenes, type ProceduralName } from './scenes';
import { materialFrag, type MaterialParams } from './material';

export type SourceSpec =
  | { kind: 'procedural'; name: ProceduralName }
  | { kind: 'video'; video: HTMLVideoElement }
  | { kind: 'image'; image: HTMLImageElement };

export interface Pass {
  /** Viewport in CSS px, from the canvas's top-left. Defaults to the canvas. */
  rect?: { x: number; y: number; w: number; h: number };
  params: MaterialParams;
  bypass?: boolean;
  /** Fully tiled region in CSS px relative to the pass rect; enables the leak. */
  frame?: { x: number; y: number; w: number; h: number };
  leak?: number;
  reach?: number;
  /** Leave the frame's inside empty, for when an app is drawn there. */
  hollow?: boolean;
  /** Leak sources as [x, y, reach scale], x and y from the frame's top-left (0 to 1). */
  corners?: [[number, number, number], [number, number, number]];
}

export interface GlassRenderer {
  readonly gl: WebGLRenderingContext;
  setSource(spec: SourceSpec): void;
  /** Re-reads the canvas size. */
  resize(): void;
  /** Updates the scene for time t, then draws every pass. */
  render(t: number, passes: Pass[]): void;
  /** True when a video source has a new frame waiting. */
  readonly dirty: boolean;
  dispose(): void;
}

export function createGlassRenderer(canvas: HTMLCanvasElement, opts: { sceneScale?: number; maxDpr?: number } = {}): GlassRenderer | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  let material: WebGLProgram;
  const sceneProgs = new Map<ProceduralName, WebGLProgram>();
  try { material = compile(gl, materialFrag); }
  catch (error) { console.warn('glass material disabled:', error); return null; }
  const buf = fullscreen(gl);
  const loc = (name: string) => gl.getUniformLocation(material, name);
  const U = Object.fromEntries(['uScene', 'uVP', 'uCover', 'uDpr', 'uTile', 'uGap', 'uRound', 'uProfile', 'uRefract', 'uGather', 'uDiffuse', 'uRough', 'uImperfect', 'uHighlight', 'uReflect', 'uTint', 'uBubbles', 'uGrain', 'uSat', 'uLevels', 'uDuo', 'uSeed', 'uBypass', 'uGrout', 'uGroutScene', 'uFrame', 'uLeak', 'uReach', 'uGridOffset', 'uHollow', 'uCornerA', 'uCornerB'].map((n) => [n, loc(n)]));

  let spec: SourceSpec = { kind: 'procedural', name: 'sky' };
  let sceneTarget: Target | undefined;
  const mediaTex = texture(gl);
  let mediaSize = { w: 1, h: 1 };
  let mediaDirty = true;
  let videoHandle = 0;
  let w = 1, h = 1, dpr = 1;
  const sceneScale = opts.sceneScale ?? 1 / 3;

  function watchVideo(video: HTMLVideoElement) {
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (h: number) => void };
    if (v.requestVideoFrameCallback) {
      const onFrame = () => { mediaDirty = true; videoHandle = v.requestVideoFrameCallback!(onFrame); };
      videoHandle = v.requestVideoFrameCallback(onFrame);
    } else {
      video.addEventListener('timeupdate', () => { mediaDirty = true; });
    }
    video.addEventListener('seeked', () => { mediaDirty = true; });
  }
  function unwatch() {
    if (spec.kind === 'video' && videoHandle) {
      const v = spec.video as HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void };
      v.cancelVideoFrameCallback?.(videoHandle);
      videoHandle = 0;
    }
  }

  function sceneProgram(name: ProceduralName) {
    let p = sceneProgs.get(name);
    if (!p) { p = compile(gl!, proceduralScenes[name]); sceneProgs.set(name, p); }
    return p;
  }

  function resize() {
    dpr = Math.min(opts.maxDpr ?? 2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width * dpr));
    h = Math.max(1, Math.round(r.height * dpr));
    canvas.width = w;
    canvas.height = h;
    sceneTarget = target(gl!, Math.max(1, Math.ceil(w * sceneScale)), Math.max(1, Math.ceil(h * sceneScale)), sceneTarget);
  }

  function updateScene(t: number): { tex: WebGLTexture; aspect: number } {
    if (spec.kind === 'procedural') {
      if (!sceneTarget) resize();
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, sceneTarget!.fbo);
      gl!.viewport(0, 0, sceneTarget!.w, sceneTarget!.h);
      const p = sceneProgram(spec.name);
      gl!.useProgram(p);
      gl!.uniform2f(gl!.getUniformLocation(p, 'uRes'), sceneTarget!.w, sceneTarget!.h);
      gl!.uniform1f(gl!.getUniformLocation(p, 'uTime'), t);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      return { tex: sceneTarget!.tex, aspect: sceneTarget!.w / sceneTarget!.h };
    }
    const media = spec.kind === 'video' ? spec.video : spec.image;
    const ready = spec.kind === 'video' ? spec.video.readyState >= 2 : spec.image.complete && spec.image.naturalWidth > 0;
    if (ready && mediaDirty) {
      gl!.bindTexture(gl!.TEXTURE_2D, mediaTex);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, media);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
      mediaSize = spec.kind === 'video'
        ? { w: spec.video.videoWidth, h: spec.video.videoHeight }
        : { w: spec.image.naturalWidth, h: spec.image.naturalHeight };
      mediaDirty = false;
    }
    return { tex: mediaTex, aspect: mediaSize.w / mediaSize.h };
  }

  function render(t: number, passes: Pass[]) {
    if (!sceneTarget) resize();
    const sceneTex = updateScene(t);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, w, h);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.useProgram(material);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, sceneTex.tex);
    gl!.uniform1i(U.uScene, 0);
    gl!.enable(gl!.SCISSOR_TEST);
    for (const pass of passes) {
      const r = pass.rect ?? { x: 0, y: 0, w: w / dpr, h: h / dpr };
      // device px, origin bottom-left
      const vx = Math.round(r.x * dpr), vw = Math.round(r.w * dpr), vh = Math.round(r.h * dpr);
      const vy = h - Math.round(r.y * dpr) - vh;
      gl!.viewport(vx, vy, vw, vh);
      gl!.scissor(vx, vy, vw, vh);
      const vpAspect = vw / vh;
      const cover: [number, number] = vpAspect > sceneTex.aspect ? [1, sceneTex.aspect / vpAspect] : [vpAspect / sceneTex.aspect, 1];
      const m = pass.params;
      gl!.uniform4f(U.uVP, vx, vy, vw, vh);
      gl!.uniform2f(U.uCover, cover[0], cover[1]);
      gl!.uniform1f(U.uDpr, dpr);
      gl!.uniform1f(U.uTile, m.tile * dpr);
      gl!.uniform1f(U.uGap, m.gap);
      gl!.uniform1f(U.uRound, m.round);
      gl!.uniform1f(U.uProfile, m.profile);
      gl!.uniform1f(U.uRefract, m.refract);
      gl!.uniform1f(U.uGather, m.gather);
      gl!.uniform1f(U.uDiffuse, m.diffuse);
      gl!.uniform1f(U.uRough, m.rough);
      gl!.uniform1f(U.uImperfect, m.imperfect);
      gl!.uniform1f(U.uHighlight, m.highlight);
      gl!.uniform1f(U.uReflect, m.reflect);
      gl!.uniform1f(U.uTint, m.tint);
      gl!.uniform1f(U.uBubbles, m.bubbles);
      gl!.uniform1f(U.uGrain, m.grain);
      gl!.uniform1f(U.uSat, m.saturation);
      gl!.uniform1f(U.uLevels, m.levels);
      gl!.uniform1f(U.uDuo, m.duotone);
      gl!.uniform1f(U.uSeed, m.seed);
      gl!.uniform1f(U.uBypass, pass.bypass ? 1 : 0);
      gl!.uniform3f(U.uGrout, m.grout[0], m.grout[1], m.grout[2]);
      gl!.uniform1f(U.uGroutScene, m.groutScene ?? 0);
      // frame in local device px, origin bottom-left of the pass
      const f = pass.frame;
      const T = m.tile * dpr;
      if (f) {
        const fx = f.x * dpr, fy = vh - (f.y + f.h) * dpr;
        gl!.uniform4f(U.uFrame, fx, fy, f.w * dpr, f.h * dpr);
        gl!.uniform1f(U.uLeak, pass.leak ?? 1);
        gl!.uniform1f(U.uReach, pass.reach ?? 6);
        // whole tiles start at the frame's top-left corner
        gl!.uniform2f(U.uGridOffset, ((fx % T) + T) % T, (((fy + f.h * dpr) % T) + T) % T);
        gl!.uniform1f(U.uHollow, pass.hollow ? 1 : 0);
        const [a, b] = pass.corners ?? [[0, 1, 1], [1, 0, 1]];
        gl!.uniform3f(U.uCornerA, a[0], 1 - a[1], a[2]);
        gl!.uniform3f(U.uCornerB, b[0], 1 - b[1], b[2]);
      } else {
        gl!.uniform1f(U.uLeak, 0);
        gl!.uniform2f(U.uGridOffset, 0, 0);
        gl!.uniform1f(U.uHollow, 0);
      }
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    gl!.disable(gl!.SCISSOR_TEST);
  }

  function setSource(next: SourceSpec) {
    unwatch();
    spec = next;
    mediaDirty = true;
    if (spec.kind === 'video') watchVideo(spec.video);
    if (spec.kind === 'image' && !spec.image.complete) spec.image.addEventListener('load', () => { mediaDirty = true; }, { once: true });
  }

  function dispose() {
    unwatch();
    for (const p of sceneProgs.values()) gl!.deleteProgram(p);
    gl!.deleteProgram(material);
    gl!.deleteTexture(mediaTex);
    if (sceneTarget) { gl!.deleteTexture(sceneTarget.tex); gl!.deleteFramebuffer(sceneTarget.fbo); }
    gl!.deleteBuffer(buf);
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return {
    gl,
    setSource,
    resize,
    render,
    get dirty() { return mediaDirty; },
    dispose,
  };
}
