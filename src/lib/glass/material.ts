// The optical material: a wall of stationary square glass tiles over any
// scene texture. The glass never moves; only the world behind it does.
//
// One shader covers every treatment through parameters:
//   profile 0  flat     each tile gathers the light behind it into one value
//   profile 1  cast     flat face, narrow rounded rim (pressed mosaic glass)
//   profile 2  lens     a domed lenslet; strong refraction flips the view
//   profile 3  pressed  ribbed glass block, ribs alternate direction per tile
// Imperfections (nudge, tilt, tint, bubbles, hammered surface) are fixed per
// tile by a seeded hash, so they never flicker. Grain is fixed to the glass.
//
// The leak mask lets tiles escape a frame: inside `frame` the wall is whole;
// outside it, tiles survive with a probability that falls with distance and
// gathers toward two corners, and sit on the page with partial opacity.
// Tiles along the frame's edge may overhang it without bringing grout.
import { noiseGLSL } from './gl';

export interface MaterialParams {
  /** Tile pitch in CSS px. */
  tile: number;
  /** Separation between tiles, as a fraction of the pitch (0 to 0.25). */
  gap: number;
  /** Corner rounding, 0 square to 1 round. */
  round: number;
  profile: 0 | 1 | 2 | 3;
  /** How far the glass bends the view (0 to 1). */
  refract: number;
  /** Mix between the bent view (0) and the tile's gathered average (1). */
  gather: number;
  /** Soft focus inside a tile (0 to 1). */
  diffuse: number;
  /** Hammered surface ripple (0 to 1). */
  rough: number;
  /** Per-tile offset, tilt and tint variation (0 to 1). */
  imperfect: number;
  highlight: number;
  reflect: number;
  /** Green-blue absorption through thick glass (0 to 1). */
  tint: number;
  bubbles: number;
  grain: number;
  /** Colour treatment. */
  saturation: number;
  /** Posterise steps per channel; 0 is off. */
  levels: number;
  /** Duotone toward the brand blues (0 to 1). */
  duotone: number;
  /** RGB of the grout, 0 to 1. */
  grout: [number, number, number];
  /** 0 = solid grout; 1 = the scene shows through the gaps, darkened, like leading in a window. */
  groutScene: number;
  seed: number;
}

export const presets: Record<string, MaterialParams> = {
  // what the homepage shipped with
  cast: {
    tile: 26, gap: 0.076, round: 0.22, profile: 1, refract: 0.6, gather: 0.5, diffuse: 0.23,
    rough: 0.14, imperfect: 1, highlight: 0.35, reflect: 0.75, tint: 1, bubbles: 0.14, grain: 0,
    saturation: 1, levels: 0, duotone: 0, grout: [0.79, 0.8, 0.77], groutScene: 0, seed: 0,
  },
  // Rozin / early digital photograph: flat tiles, each one value, printed grain
  pixel: {
    tile: 12, gap: 0.06, round: 0, profile: 0, refract: 0, gather: 0.92, diffuse: 0.3,
    rough: 0.04, imperfect: 0.35, highlight: 0.05, reflect: 0.15, tint: 0.25, bubbles: 0, grain: 0.55,
    saturation: 0.95, levels: 0, duotone: 0, grout: [0.82, 0.83, 0.8], groutScene: 0, seed: 0,
  },
  // optical lens array: domed lenslets that invert what they see
  lens: {
    tile: 14, gap: 0.045, round: 0.12, profile: 2, refract: 0.72, gather: 0.25, diffuse: 0.18,
    rough: 0.06, imperfect: 0.6, highlight: 0.22, reflect: 0.45, tint: 0.5, bubbles: 0, grain: 0.25,
    saturation: 1, levels: 0, duotone: 0, grout: [0.78, 0.79, 0.76], groutScene: 0, seed: 0,
  },
  // candidate signature: pixel gathering behind faint pressed ribs, thin
  // translucent seams, printed grain; reads as a picture first, glass second
  signature: {
    tile: 12, gap: 0.05, round: 0.04, profile: 3, refract: 0.28, gather: 0.6, diffuse: 0.45,
    rough: 0.05, imperfect: 0.55, highlight: 0.08, reflect: 0.22, tint: 0.4, bubbles: 0.02, grain: 0.42,
    saturation: 1, levels: 0, duotone: 0, grout: [0.8, 0.81, 0.78], groutScene: 0.75, seed: 0,
  },
  // pressed glass block: ribs that alternate per tile, like woven reeded glass
  pressed: {
    tile: 16, gap: 0.05, round: 0.08, profile: 3, refract: 0.55, gather: 0.3, diffuse: 0.35,
    rough: 0.08, imperfect: 0.5, highlight: 0.2, reflect: 0.4, tint: 0.6, bubbles: 0.05, grain: 0.3,
    saturation: 1, levels: 0, duotone: 0, grout: [0.8, 0.81, 0.78], groutScene: 0, seed: 0,
  },
};

export const materialFrag = noiseGLSL + `
uniform sampler2D uScene;
uniform vec4 uVP;        // viewport origin and size, device px
uniform vec2 uCover;     // scene uv scale for object-fit: cover
uniform float uDpr;
uniform float uTile, uGap, uRound, uProfile, uRefract, uGather, uDiffuse, uRough, uImperfect;
uniform float uHighlight, uReflect, uTint, uBubbles, uGrain, uSat, uLevels, uDuo, uSeed, uBypass;
uniform vec3 uGrout;
uniform float uGroutScene;
uniform vec4 uFrame;     // fully tiled region, local device px (x, y, w, h)
uniform float uLeak;     // 0 = whole wall; > 0 = leak density outside the frame
uniform float uReach;    // how far, in tiles, the leak gathers around its corners
uniform vec2 uGridOffset; // aligns the tile grid to the frame's corner
uniform float uHollow;   // 1 = leave the inside of the frame empty (an app is showing there)
uniform vec3 uCornerA, uCornerB; // leak sources: x, y as fractions of the frame (y up), z = reach scale

vec3 scene(vec2 local) {
  vec2 uv = (local / uVP.zw - 0.5) * uCover + 0.5;
  return texture2D(uScene, clamp(uv, 0.001, 0.999)).rgb;
}
float box(vec2 p, float b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

void main() {
  vec2 local = gl_FragCoord.xy - uVP.xy;
  if (uBypass > 0.5) { gl_FragColor = vec4(scene(local), 1.0); return; }
  float T = uTile;
  vec2 cell = floor((local - uGridOffset) / T);
  vec2 centre = (cell + 0.5) * T + uGridOffset;
  vec2 sc = cell + uSeed * 31.7;
  float r1 = hash(sc), r2 = hash(sc + 17.3), r3 = hash(sc + 5.9), r4 = hash(sc + 2.2);

  // ── leak: tiles that escaped the frame ───────────────────────────────
  float alpha = 1.0;
  bool inside = true;
  if (uLeak > 0.0) {
    vec2 lo = uFrame.xy, hi = uFrame.xy + uFrame.zw;
    vec2 out2 = max(max(lo - centre, centre - hi), 0.0);
    float dist = length(out2) / T;
    if (dist > 0.0) {
      inside = false;
      float reach = T * uReach;
      vec2 ca = lo + uFrame.zw * uCornerA.xy, cb = lo + uFrame.zw * uCornerB.xy;
      float corner = max(exp(-length(centre - ca) / (reach * uCornerA.z)), exp(-length(centre - cb) / (reach * uCornerB.z)));
      float keep = corner * exp(-dist * 0.45) * uLeak;
      if (hash(sc + 41.3) > keep) { gl_FragColor = vec4(0.0); return; }
      // never show an escaped tile cut off by the edge of the canvas
      if (min(centre.x, centre.y) < T * 0.55 || centre.x > uVP.z - T * 0.55 || centre.y > uVP.w - T * 0.55) { gl_FragColor = vec4(0.0); return; }
      alpha = 0.5 + 0.45 * hash(sc + 9.1);
    }
    if (inside && uHollow > 0.5) { gl_FragColor = vec4(0.0); return; }
  }

  // ── the tile's shape, laid slightly by hand ─────────────────────────
  vec2 nudge = (vec2(r1, r2) - 0.5) * T * 0.06 * uImperfect;
  float a = (r3 - 0.5) * 0.05 * uImperfect;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 p = rot * (local - centre - nudge);
  float halfSize = T * 0.5 * (1.0 - uGap);
  float radius = halfSize * clamp(uRound, 0.0, 1.0);
  float d = box(p, halfSize, radius);
  float e = 0.5;
  vec2 outward = normalize(vec2(box(p + vec2(e, 0.0), halfSize, radius) - box(p - vec2(e, 0.0), halfSize, radius),
                                box(p + vec2(0.0, e), halfSize, radius) - box(p - vec2(0.0, e), halfSize, radius)) + 1e-5);
  vec2 c = p / halfSize;                    // -1..1 across the face

  // ── surface profile → tilt of the surface normal ────────────────────
  vec2 tilt = vec2(0.0);
  float mag = mix(1.0, 0.75, uRefract);     // how much of the world one tile sees
  float thick = 0.0;                        // extra path length through the glass
  if (uProfile < 0.5) {
    // flat: only the outermost rim turns
    float k = clamp(-d / (T * 0.04), 0.0, 1.0);
    tilt = outward * (1.0 - k) * 0.6;
  } else if (uProfile < 1.5) {
    float k = clamp(-d / (T * 0.15), 0.0, 1.0);
    float slope = min(2.5, (1.0 - k) / sqrt(max(1e-3, 1.0 - (1.0 - k) * (1.0 - k))));
    tilt = outward * slope;
    thick = (1.0 - k) * 1.6;
  } else if (uProfile < 2.5) {
    // dome: a convex lenslet; past the focal point the image turns over
    float rr = clamp(dot(c, c) * 0.5, 0.0, 0.96);
    tilt = c / sqrt(1.0 - rr) * 0.7;
    mag = mix(0.9, -0.75, uRefract);
    thick = (1.0 - rr) * 0.8;
  } else {
    // pressed: three ribs per tile, direction alternates like a weave
    float checker = mod(cell.x + cell.y, 2.0);
    float u = checker < 0.5 ? c.x : c.y;
    float s = fract(u * 1.5 + 0.5) * 2.0 - 1.0;
    float slope = s * 1.2;
    tilt = checker < 0.5 ? vec2(slope, 0.0) : vec2(0.0, slope);
    thick = (1.0 - abs(s)) * 0.6;
  }
  // hammered surface, fixed per tile
  vec2 hp = p / T * 3.2 + vec2(r1, r4) * 40.0;
  float h0 = fbm3(hp);
  vec2 ripple = vec2(fbm3(hp + vec2(0.08, 0.0)) - h0, fbm3(hp + vec2(0.0, 0.08)) - h0) / 0.08;
  tilt += ripple * uRough * (0.7 + 0.6 * r2);
  vec3 n = normalize(vec3(tilt * 0.55, 1.0));

  // ── light through the glass ─────────────────────────────────────────
  // a pixel: the tile gathers what is behind its footprint into one value
  float R = T * 0.33;
  vec3 gathered = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) gathered += scene(centre + vec2(float(i), float(j)) * R);
  gathered /= 9.0;
  // glass: a bent, softened view of the world, slightly displaced per tile
  vec2 jitter = (vec2(hash(sc + 3.1), hash(sc + 7.7)) - 0.5) * T * 0.25 * uImperfect;
  vec2 s = centre + (local - centre) * mag + n.xy * T * uRefract * 0.8 + jitter;
  float rr2 = T * 0.3 * uDiffuse;
  vec2 dirA = uProfile > 2.5 ? (mod(cell.x + cell.y, 2.0) < 0.5 ? vec2(0.0, 1.6) : vec2(1.6, 0.0)) : vec2(1.0, 0.0);
  vec2 dirB = uProfile > 2.5 ? dirA * 0.5 : vec2(0.0, 1.0);
  vec3 seen = 0.25 * (scene(s + dirA * rr2) + scene(s - dirA * rr2) + scene(s + dirB * rr2) + scene(s - dirB * rr2));
  vec3 col = mix(seen, gathered, uGather);

  // thickness turns the glass green-blue; every tile is a slightly different melt
  vec3 glassTint = vec3(0.9 + 0.04 * r4 * uImperfect, 0.965, 0.97 + 0.02 * r1 * uImperfect);
  col *= mix(vec3(1.0), pow(glassTint, vec3(1.0 + thick)), uTint);
  col *= 1.0 + (r2 - 0.5) * 0.1 * uImperfect;

  // reflection of the room at grazing angles, the sun on the surface
  col = mix(col, vec3(0.9, 0.92, 0.93), (0.03 + 0.6 * pow(1.0 - n.z, 3.0)) * uReflect);
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  col += spec * uHighlight * (0.35 + 0.65 * r3);
  float rim = (1.0 - smoothstep(0.0, 1.2 * uDpr, -d)) * clamp(dot(outward, normalize(vec2(-0.6, 0.8))), 0.0, 1.0);
  col += rim * uHighlight * 0.35;
  col *= 0.97 + 0.06 * dot(n, L);

  // seed bubbles, now and then
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    if (hash(sc + fi * 4.4 + 0.7) > uBubbles) continue;
    vec2 bp = (vec2(hash(sc + fi * 3.7), hash(sc + fi * 9.1)) - 0.5) * T * 0.6;
    float br = T * (0.018 + 0.03 * hash(sc + fi * 1.9));
    float bd = length(p - bp);
    col += smoothstep(br, br * 0.8, bd) * smoothstep(br * 0.45, br * 0.8, bd) * 0.14;
  }

  // colour treatment
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  vec3 duo = mix(vec3(0.07, 0.16, 0.42), vec3(0.93, 0.95, 0.98), smoothstep(0.05, 0.95, lum));
  col = mix(col, duo, uDuo);
  if (uLevels > 1.0) col = floor(col * uLevels + 0.5) / uLevels;

  // printed grain, fixed to the glass
  vec2 g = floor(gl_FragCoord.xy / max(1.0, uDpr));
  col += (hash(g + uSeed) - 0.5) * 0.11 * uGrain + (hash(floor(g / 3.0) + 7.0) - 0.5) * 0.05 * uGrain;

  // grout inside the frame; bare page around escaped tiles
  float face = 1.0 - smoothstep(-0.7, 0.7, d);
  vec3 grout = uGrout * (0.88 + 0.12 * smoothstep(0.0, T * 0.05, d));
  grout = mix(grout, scene(local) * 0.58 + 0.06, uGroutScene);
  bool pxInside = uLeak <= 0.0 || (local.x >= uFrame.x && local.y >= uFrame.y && local.x <= uFrame.x + uFrame.z && local.y <= uFrame.y + uFrame.w);
  if (inside && pxInside) {
    gl_FragColor = vec4(mix(grout, col, face), 1.0);
  } else {
    float aOut = face * alpha;
    gl_FragColor = vec4(col * aOut, aOut);
  }
}
`;
