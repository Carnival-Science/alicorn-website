// Procedural scenes: the world behind the glass. Each renders a full frame
// for time `uTime` (seconds) into a target of size `uRes`, y up. They are
// deterministic in time, move coherently at large scale, and avoid short
// loops by mixing slow, unrelated periods.
import { noiseGLSL } from './gl';

export type ProceduralName = 'sky' | 'foliage' | 'ocean';

const head = noiseGLSL + `
uniform vec2 uRes;
uniform float uTime;
`;

const sky = head + `
const vec2 SUN = vec2(0.84, 0.9);
float cumulus(vec2 uv, float t, float cover) {
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.25 + vec2(t * 0.018, t * 0.004);
  vec2 q = vec2(fbm3(p + t * 0.012), fbm3(p + vec2(5.2, 1.3) - t * 0.009));
  return smoothstep(cover, cover + 0.22, fbm(p + 1.7 * q));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime;
  float aspect = uRes.x / uRes.y;
  float cover = 0.46 - (0.05 * sin(t * 0.21) + 0.03 * sin(t * 0.077 + 1.7));
  float sunLight = 0.92 + 0.08 * sin(t * 0.13 + 0.4);
  vec3 zenith = vec3(0.08, 0.26, 0.69);
  vec3 horizon = vec3(0.62, 0.78, 0.95);
  vec3 col = mix(horizon, zenith, pow(clamp(uv.y, 0.0, 1.0), 0.75));
  float sd = length((uv - SUN) * vec2(aspect, 1.0));
  vec3 sunCol = vec3(1.0, 0.96, 0.87);
  col += sunCol * (0.45 * exp(-sd * 7.0) + 0.14 * exp(-sd * 2.2)) * sunLight;
  vec2 cp = vec2(uv.x * aspect * 0.9 + t * 0.006, uv.y * 5.5 + uv.x * 1.3);
  float cirrus = smoothstep(0.5, 0.85, fbm(cp + fbm3(cp * 0.7) * 1.4)) * smoothstep(0.35, 0.95, uv.y);
  col = mix(col, vec3(0.93, 0.95, 0.99), cirrus * 0.35);
  float dens = cumulus(uv, t, cover);
  vec2 toSun = normalize(SUN - uv) * 0.05;
  float towardSun = cumulus(uv + toSun, t, cover);
  float lit = clamp(0.82 - (towardSun - dens) * 1.8, 0.0, 1.0);
  vec3 cloud = mix(vec3(0.56, 0.64, 0.8), vec3(1.0, 0.99, 0.97), lit);
  cloud += sunCol * (1.0 - dens) * exp(-sd * 3.5) * 0.6;
  col = mix(col, cloud, dens * 0.96);
  col *= 1.0 - 0.18 * cumulus(SUN, t, cover);
  col = mix(col, horizon, 0.16 * (1.0 - uv.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

// Looking up into a canopy against the sky. Leaves are cells of a jittered
// grid, each an oriented ellipse; wind is a slow, large field that sways
// whole regions together, with a faster flutter on single leaves.
const foliage = head + `
vec2 wind(vec2 p, float t) {
  float gust = 0.6 + 0.4 * sin(t * 0.23) * sin(t * 0.071 + 1.3);
  return vec2(fbm3(p * 0.6 + vec2(t * 0.11, 0.0)), fbm3(p * 0.6 + vec2(3.7, t * 0.09))) - 0.5;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  vec2 p = uv * vec2(aspect, 1.0) * 3.0;
  float gust = 0.6 + 0.4 * sin(t * 0.23) * sin(t * 0.071 + 1.3);
  p += wind(p, t) * 0.35 * gust;

  vec3 skyCol = mix(vec3(0.55, 0.74, 0.96), vec3(0.16, 0.4, 0.85), uv.y);
  vec2 sun = vec2(0.72 * aspect, 0.78) * 3.0;
  // canopy mass: branches thin out toward one corner, leaving sky
  float mass = fbm(p * 0.55 + 4.0) + 0.55 * (1.0 - length(uv - vec2(0.15, 0.95)));
  vec3 col = skyCol;
  float sunGlow = exp(-length(p - sun) * 0.9);
  col += vec3(1.0, 0.97, 0.85) * sunGlow * 0.8;

  // three layers of leaves, near to far
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = 15.0 - fl * 4.0;
    vec2 q = p * scale / 3.0 + fl * 17.0;
    vec2 cell = floor(q);
    vec3 leafCol = vec3(0.0); float cover = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float h = hash(c + fl * 3.1);
      float presence = smoothstep(0.62 - fl * 0.08, 0.95, mass + (h - 0.5) * 0.5);
      if (presence <= 0.0) continue;
      float flutter = sin(t * (1.2 + h * 1.6) + h * 30.0) * 0.12 * gust;
      vec2 o = c + vec2(hash(c + 1.7), hash(c + 5.3)) + vec2(flutter, flutter * 0.5);
      float ang = h * 6.283 + flutter * 2.0;
      vec2 d = q - o;
      d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
      float e = length(d * vec2(1.0, 2.1)) - 0.62;
      float m = (1.0 - smoothstep(-0.04, 0.04, e)) * presence;
      // leaf light: backlit near the sun, darker deep in the canopy
      float lightAmt = clamp(0.35 + 0.65 * hash(c + 9.9) * (1.0 - fl * 0.25) + sunGlow * 0.8, 0.0, 1.4);
      vec3 shade = mix(vec3(0.08, 0.22, 0.06), vec3(0.42, 0.62, 0.12), lightAmt);
      shade = mix(shade, vec3(0.75, 0.86, 0.3), sunGlow * 0.6 * (1.0 - fl * 0.3));
      shade *= 0.9 + 0.2 * smoothstep(0.3, -0.5, e); // midrib brighter
      if (m > cover) { cover = m; leafCol = shade; }
    }
    col = mix(col, leafCol * (1.0 - fl * 0.12), cover);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// Open water seen at an angle, with a strip of sky at the top. Waves are a
// sum of travelling directional waves plus fine noise; the colour is deep
// water mixed with sky reflection by Fresnel, plus sun glitter.
const ocean = head + `
float heightAt(vec2 p, float t) {
  float h = 0.0;
  h += 0.50 * sin(dot(p, vec2(0.90, 0.40)) * 1.1 - t * 0.9);
  h += 0.35 * sin(dot(p, vec2(-0.30, 0.95)) * 1.7 - t * 1.25 + 1.3);
  h += 0.22 * sin(dot(p, vec2(0.60, -0.80)) * 2.9 - t * 1.7 + 4.1);
  h += 0.6 * (fbm3(p * 1.3 + vec2(t * 0.25, t * 0.11)) - 0.5);
  h += 0.25 * (fbm3(p * 4.0 - vec2(t * 0.4, -t * 0.2)) - 0.5);
  return h;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  float horizon = 0.86;
  vec3 skyTop = vec3(0.18, 0.42, 0.85), skyLow = vec3(0.7, 0.83, 0.96);
  if (uv.y > horizon) {
    float k = (uv.y - horizon) / (1.0 - horizon);
    gl_FragColor = vec4(mix(skyLow, skyTop, k), 1.0);
    return;
  }
  // project onto a plane: rows near the horizon are far away
  float depth = 1.0 / max(0.02, horizon - uv.y);
  vec2 p = vec2((uv.x - 0.5) * aspect * depth * 0.6, depth * 1.4);
  float e = 0.05;
  float h0 = heightAt(p, t);
  vec2 g = vec2(heightAt(p + vec2(e, 0.0), t) - h0, heightAt(p + vec2(0.0, e), t) - h0) / e;
  float flatten = 1.0 / (1.0 + depth * 0.18);
  vec3 n = normalize(vec3(-g.x * 0.25 * flatten, 1.0, -g.y * 0.25 * flatten));
  vec3 view = normalize(vec3(0.0, 0.25 + (horizon - uv.y) * 0.9, 1.0));
  float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 5.0);
  vec3 deep = vec3(0.02, 0.17, 0.36), shallow = vec3(0.05, 0.36, 0.55);
  vec3 water = mix(deep, shallow, clamp(0.5 + h0 * 0.35, 0.0, 1.0));
  vec3 r = reflect(-view, n);
  vec3 skyR = mix(skyLow, skyTop, clamp(r.y * 1.4, 0.0, 1.0));
  vec3 col = mix(water, skyR, clamp(fres * 1.4, 0.0, 1.0));
  // sun glitter: a narrow column of sparkles toward the sun
  vec3 sunDir = normalize(vec3(0.25, 0.35, 1.0));
  float glint = pow(max(dot(r, sunDir), 0.0), 220.0);
  float band = exp(-pow((uv.x - 0.62) * 3.2, 2.0));
  col += vec3(1.0, 0.95, 0.82) * glint * (2.5 + 2.0 * band);
  col = mix(col, skyLow, smoothstep(0.55, 0.86, uv.y) * 0.45);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const proceduralScenes: Record<ProceduralName, string> = { sky, foliage, ocean };
