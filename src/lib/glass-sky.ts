// The standby image: a moving sky seen through a wall of square glass tiles.
// Each tile gathers the light behind it into one soft value, which is what a
// screen pixel does with an image.
//
// Pass 1 renders the sky into a third-resolution texture: a gradient, the
// sun, domain-warped cumulus lit from the sun side, and a thin cirrus layer.
// Pass 2 looks at that sky through cast glass tiles: a flat face with narrow
// rounded edges, a hammered surface, edges that thicken toward green, Fresnel
// reflection, the odd seed bubble, and grout between tiles laid by hand.
//
// The sky breathes on slow, unrelated periods (cloud cover, sunlight), and
// the whole scene dims a little when a cloud crosses the sun, so the
// sequence never visibly loops.

const vert = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const common = `
precision highp float;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
`;

const skyFrag = common + `
uniform vec2 uRes;
uniform float uTime;
const vec2 SUN = vec2(0.84, 0.9);
float cumulus(vec2 uv, float t, float cover) {
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.25 + vec2(t * 0.018, t * 0.004);
  vec2 q = vec2(fbm3(p + t * 0.012), fbm3(p + vec2(5.2, 1.3) - t * 0.009));
  return smoothstep(cover, cover + 0.22, fbm(p + 1.7 * q));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;           // y up
  float t = uTime;
  float aspect = uRes.x / uRes.y;
  // breathing: cloud cover and sunlight on slow, unrelated periods
  float cover = 0.46 - (0.05 * sin(t * 0.21) + 0.03 * sin(t * 0.077 + 1.7));
  float sunLight = 0.92 + 0.08 * sin(t * 0.13 + 0.4);

  vec3 zenith = vec3(0.08, 0.26, 0.69);
  vec3 horizon = vec3(0.62, 0.78, 0.95);
  vec3 col = mix(horizon, zenith, pow(clamp(uv.y, 0.0, 1.0), 0.75));
  float sd = length((uv - SUN) * vec2(aspect, 1.0));
  vec3 sunCol = vec3(1.0, 0.96, 0.87);
  col += sunCol * (0.45 * exp(-sd * 7.0) + 0.14 * exp(-sd * 2.2)) * sunLight;

  // cirrus: thin, stretched, slow, high in the frame
  vec2 cp = vec2(uv.x * aspect * 0.9 + t * 0.006, uv.y * 5.5 + uv.x * 1.3);
  float cirrus = smoothstep(0.5, 0.85, fbm(cp + fbm3(cp * 0.7) * 1.4)) * smoothstep(0.35, 0.95, uv.y);
  col = mix(col, vec3(0.93, 0.95, 0.99), cirrus * 0.35);

  // cumulus, lit from the sun side
  float dens = cumulus(uv, t, cover);
  vec2 toSun = normalize(SUN - uv) * 0.05;
  float towardSun = cumulus(uv + toSun, t, cover);
  float lit = clamp(0.82 - (towardSun - dens) * 1.8, 0.0, 1.0);
  vec3 shadowed = vec3(0.56, 0.64, 0.8);
  vec3 cloud = mix(shadowed, vec3(1.0, 0.99, 0.97), lit);
  // silver lining: thin edges near the sun glow
  cloud += sunCol * (1.0 - dens) * exp(-sd * 3.5) * 0.6;
  col = mix(col, cloud, dens * 0.96);

  // a cloud over the sun dims the whole scene a little
  float overSun = cumulus(SUN, t, cover);
  col *= 1.0 - 0.18 * overSun;
  col = mix(col, horizon, 0.16 * (1.0 - uv.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

const glassFrag = common + `
uniform vec2 uRes;
uniform float uTile;
uniform sampler2D uSky;
vec3 sky(vec2 px) { return texture2D(uSky, clamp(px / uRes, 0.0, 1.0)).rgb; }
float box(vec2 p, float b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 px = gl_FragCoord.xy;
  float T = uTile;
  vec2 cell = floor(px / T);
  float r1 = hash(cell), r2 = hash(cell + 17.3), r3 = hash(cell + 5.9), r4 = hash(cell + 2.2);
  vec2 centre = (cell + 0.5) * T;

  // laid by hand: each tile is nudged and turned a little
  vec2 nudge = (vec2(r1, r2) - 0.5) * T * 0.05;
  float a = (r3 - 0.5) * 0.045;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 p = rot * (px - centre - nudge);
  float halfSize = T * 0.462, radius = T * 0.1;
  float d = box(p, halfSize, radius);                 // < 0 inside the tile
  float e = 0.5;
  vec2 outward = normalize(vec2(box(p + vec2(e, 0.0), halfSize, radius) - box(p - vec2(e, 0.0), halfSize, radius),
                                box(p + vec2(0.0, e), halfSize, radius) - box(p - vec2(0.0, e), halfSize, radius)) + 1e-5);

  // a flat face with a narrow rounded edge
  float bevel = T * 0.15;
  float k = clamp(-d / bevel, 0.0, 1.0);              // 0 at the rim, 1 on the face
  float slope = min(2.5, (1.0 - k) / sqrt(max(1e-3, 1.0 - (1.0 - k) * (1.0 - k))));
  vec2 tilt = outward * slope;
  // hammered surface: a gentle ripple, different on every tile
  vec2 hp = p / T * 3.2 + vec2(r1, r4) * 40.0;
  float h0 = fbm3(hp);
  vec2 ripple = vec2(fbm3(hp + vec2(0.08, 0.0)) - h0, fbm3(hp + vec2(0.0, 0.08)) - h0) / 0.08;
  tilt += ripple * (0.1 + 0.08 * r2);
  vec3 n = normalize(vec3(tilt * 0.55, 1.0));

  // light through the glass: the tile gathers what is behind it (a pixel)
  // and lets a bent, softened view through
  float R = T * 0.3;
  vec3 gathered = 0.2 * (sky(centre) + sky(centre + vec2(R, R)) + sky(centre - vec2(R, R)) + sky(centre + vec2(R, -R)) + sky(centre - vec2(R, -R)));
  vec2 s = centre + (px - centre) * 0.85 + n.xy * T * 0.5;
  float rr = T * 0.07;
  vec3 seen = 0.25 * (sky(s + vec2(rr, 0.0)) + sky(s - vec2(rr, 0.0)) + sky(s + vec2(0.0, rr)) + sky(s - vec2(0.0, rr)));
  vec3 col = mix(gathered, seen, 0.5);

  // thickness: light travels further through the edges, which turn green-blue
  float path = 1.0 + (1.0 - k) * 1.6;
  vec3 glassTint = vec3(0.9 + 0.04 * r4, 0.965, 0.97 + 0.02 * r1);
  col *= pow(glassTint, vec3(path)) * (0.95 + 0.08 * r2);

  // Fresnel: grazing surfaces reflect the room in front of the wall
  float fres = 0.03 + 0.45 * pow(1.0 - n.z, 3.0);
  col = mix(col, vec3(0.9, 0.92, 0.93), fres);
  // sun on the glass: a sharp highlight where the surface faces it
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  col += spec * (0.12 + 0.22 * r3);
  col *= 0.97 + 0.06 * dot(n, L);

  // seed bubbles: one now and then, rim lit
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    if (hash(cell + fi * 4.4 + 0.7) < 0.86) continue;
    vec2 bp = (vec2(hash(cell + fi * 3.7), hash(cell + fi * 9.1)) - 0.5) * T * 0.6;
    float br = T * (0.018 + 0.03 * hash(cell + fi * 1.9));
    float bd = length(p - bp);
    float rim = smoothstep(br, br * 0.8, bd) * smoothstep(br * 0.45, br * 0.8, bd);
    col += rim * 0.14;
  }

  // grout, a little darker where it meets the tile
  vec3 grout = vec3(0.79, 0.8, 0.77) * (0.88 + 0.12 * smoothstep(0.0, T * 0.05, d));
  col = mix(col, grout, smoothstep(-0.7, 0.7, d));
  gl_FragColor = vec4(col, 1.0);
}
`;

function program(gl: WebGLRenderingContext, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vert));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

export interface GlassSky {
  /** Draw one frame at time `t` in seconds. */
  frame(t: number): void;
  /** Match the canvas to its CSS size. */
  resize(): void;
}

/** Returns null when WebGL is unavailable; the CSS fallback stays visible. */
export function createGlassSky(canvas: HTMLCanvasElement, opts: { tile: number }): GlassSky | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  let skyProg: WebGLProgram, glassProg: WebGLProgram;
  try {
    skyProg = program(gl, skyFrag);
    glassProg = program(gl, glassFrag);
  } catch (error) {
    console.warn('glass sky disabled:', error);
    return null;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture()!;
  const fbo = gl.createFramebuffer()!;
  let w = 0, h = 0, sw = 0, sh = 0, dpr = 1;

  const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);
  const skyRes = u(skyProg, 'uRes'), skyTime = u(skyProg, 'uTime');
  const glassRes = u(glassProg, 'uRes'), glassTile = u(glassProg, 'uTile'), glassSky = u(glassProg, 'uSky');

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width * dpr));
    h = Math.max(1, Math.round(r.height * dpr));
    canvas.width = w;
    canvas.height = h;
    // the sky is soft behind the glass, so a third of the pixels is plenty
    sw = Math.max(1, Math.ceil(w / 3));
    sh = Math.max(1, Math.ceil(h / 3));
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, sw, sh, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
  }

  function frame(t: number) {
    if (!w) resize();
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.viewport(0, 0, sw, sh);
    gl!.useProgram(skyProg);
    gl!.uniform2f(skyRes, sw, sh);
    gl!.uniform1f(skyTime, t);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, w, h);
    gl!.useProgram(glassProg);
    gl!.uniform2f(glassRes, w, h);
    gl!.uniform1f(glassTile, opts.tile * dpr);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(glassSky, 0);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  return { frame, resize };
}
