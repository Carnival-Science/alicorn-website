# Glass material lab

A development-only playground for Alicorn's signature visual: a natural scene
seen through hundreds of small, stationary square glass tiles. The glass never
moves; only the world behind it does.

```sh
npm run dev
open http://localhost:4321/lab/material/
```

The route exists only under `npm run dev`: in a production build its
`getStaticPaths` returns no pages, and the footage is served from this folder
by Vite instead of being copied into `public/`.

## What is here

| Path | Contents |
|---|---|
| `src/pages/lab/[page].astro`, `src/scripts/lab.ts` | The playground page and its controller. |
| `src/lib/glass/` | The scene sources, the material, and the renderer, shared with the homepage. |
| `lab/footage/` | Three short loops cut from openly licensed Wikimedia Commons clips, with their posters. Provenance and licences are in [`footage/SOURCES.md`](footage/SOURCES.md). |
| `lab/captures/` | Comparison boards at t = 4, 11 and 19 s, bare-scene references, and 6-second motion previews for every source. |
| `scripts/lab-capture.mjs` | Regenerates `lab/captures/` with headless Chrome and ffmpeg. |
| `scripts/lab-footage.sh` | Rebuilds the loops from the originals. |

## Using the playground

- **Scene:** procedural sky, foliage or ocean; the same three as footage; or a still photo.
- **Treatment:** loads a preset. Every slider is live: tile size, separation,
  rounding, refraction, averaging, diffusion, surface roughness, imperfection,
  highlights, reflection, glass tint, bubbles, grain, saturation, posterise,
  duotone, and seams that show the scene. Also playback speed.
- **Compare all:** renders cast, pixel, lens, pressed, signature and the bare
  scene from the same frame of the same source.
- **Bypass glass:** shows the unfiltered scene.
- **Time:** play or pause, ±1 s steps, or type a timestamp. Paused timestamps
  are deterministic for procedural scenes and seek exactly in footage.
- **Capture PNG** downloads the canvas. **Measure** times 60 forced frames.
  **Copy link** copies a URL that restores the whole view, for example
  `?scene=video:sky&preset=pressed&t=11&tile=12&refract=0.35`.
- **Keys:** space plays or pauses, ←/→ step (shift for 5 s), `b` toggles
  bypass, `c` toggles compare.
- **Scripting:** `window.__lab` offers `set(state)`, `at(t)`, `png()` and
  `bench(n)`.

Video sources upload a texture only when `requestVideoFrameCallback` reports a
newly decoded frame. Procedural scenes redraw only while playing. Nothing
redraws while paused.

## The treatments

All five share one shader (`src/lib/glass/material.ts`); they differ only in
parameters.

| Preset | Idea | Character |
|---|---|---|
| `cast` | What the homepage shipped with: 26 px cast tiles, thick light grout, rounded rims, bubbles. | Reads instantly as tile, but as bathroom tile. The grout outweighs the picture, and clouds barely survive. |
| `pixel` | Daniel Rozin's mirrors and early digital cameras: flat 12 px tiles that each gather one value, with printed grain. | The scene reads best. It is honest about pixels, but on its own it is close to a pixelate filter. |
| `lens` | An optical lens array: 14 px domed lenslets, strong enough that each tile flips its view. | Optically interesting up close. At a distance the repeated glint becomes a dot texture, and the flipping makes motion jumpy. |
| `pressed` | Architectural pressed glass: 16 px tiles with three ribs whose direction alternates like a weave (after paper.design's fluted glass, split into a grid). | The most convincing as glass, and it bends clouds and leaves into streaks. The weave gets busy on busy scenes. |
| `signature` | A blend drawn from the four: pixel gathering behind faint pressed ribs, 12 px, thin seams that let the darkened scene through, light grain. | Reads as a picture first and glass second. The gaps work like the leading in a window instead of grout. |

Boards: `lab/captures/compare-<scene>-t<s>.jpg`. Bare scenes:
`lab/captures/bypass-<scene>.jpg`.

### Motion

Each motion preview is 6 s at 12 fps from t = 3 s, the same frames for
every treatment. The table compares each cell's mean frame-to-frame change
with the bare scene's. "Jumps" is the share of pixels that change by more
than 24 of 255 levels in a single frame, which is what popping tiles would
show up as.

| Source | cast | pixel | lens | pressed | signature | bare scene |
|---|---|---|---|---|---|---|
| Sky footage | 0.45× · 0.01% | 0.62× · 0.06% | 0.73× · 0.24% | 0.61× · 0.09% | 0.68× · 0.09% | 1× · 0.70% |
| Foliage footage | 0.25× · 0.11% | 0.35× · 0.17% | 0.49× · 1.34% | 0.34× · 0.42% | 0.35× · 0.24% | 1× · 5.08% |
| Ocean footage | 0.25× · 0.20% | 0.37× · 0.38% | 0.52× · 1.23% | 0.37× · 0.62% | 0.36× · 0.45% | 1× · 3.28% |
| Procedural foliage | 0.46× · 0.01% | 0.55× · 0.01% | 0.67× · 0.52% | 0.63× · 0.11% | 0.63× · 0.05% | 1× · 1.42% |
| Procedural sky | 0.51× · 0% | 0.68× · 0% | 0.73× · 0% | 0.71× · 0% | 0.81× · 0% | 1× · 0% |

- **No treatment adds flicker.** Every one calms the scene, and none
  introduces popping. The tiles change only as the world behind them changes,
  and the grain is fixed to the glass.
- **lens is the outlier.** Turning the view over inside each tile
  amplifies movement, especially in leaves and water.
- **cast is the calmest,** because it hides the most of the world, which
  is not the goal.
- **signature and pressed keep motion legible without nervousness.** Leaves
  still visibly move in the wind, and water still rolls.

### Small crops

At a 160 × 100 crop, the size of a release thumbnail, only the coarse
`cast` tiles stay recognisable; the 12–16 px treatments blur into a fine blue
grid. **Tile size should follow the frame, not the CSS pixel.** The homepage
already does this: it sizes tiles so that 24 columns fill the stage exactly.

### Sources

- **Footage is the better baseline.** The cloud timelapse looks right behind
  every treatment.
- **The procedural sky is close,** and it never loops.
- **Procedural foliage and ocean are comparisons only.** The foliage reads as
  cut-out leaves before the glass, and the ocean has little glitter.
- **The ocean footage is weak:** an overcast rock pool, with no sun on the
  water. Replace it before choosing an ocean scene.

## Performance

Measured in the in-app browser on an Apple M1 (ANGLE Metal), with
`bench(60)`. It forces each frame to finish with a 1-pixel `readPixels`, so the
figures include a fixed synchronisation cost.

| Size (device px) | cast | pixel | lens | pressed | signature |
|---|---|---|---|---|---|
| 2080 × 1300 (1040 × 650 CSS at 2×), procedural sky | 5.7 ms | 5.5 ms | 6.4 ms | 5.8 ms | 5.6 ms |
| 2080 × 1300, sky footage | 4.4 ms | 4.2 ms | 4.4 ms | 6.1 ms | 4.8 ms |
| 780 × 488 (390 CSS phone width at 2×), procedural sky | 3.3 ms | 3.3 ms | 3.0 ms | 3.0 ms | 3.1 ms |
| 780 × 488, sky footage | 2.6 ms | 2.2 ms | 2.4 ms | 2.6 ms | 2.4 ms |

At phone size the numbers barely move, which means the synchronisation
overhead dominates. The real cost there is well under 3 ms on this GPU. The
homepage renders at 30 fps only while the glass is visible, at most 2× device
pixels, with the sky at a third of the resolution. It has not been measured on
an actual phone GPU, which can be 3–5 times slower; that is the next thing to
check.

## Recommendation

Adopt **`signature`** as the starting point for Alicorn's material, with three
changes before it ships:

1. **Size tiles by columns across the frame.** About 24–32 across a hero
   image and 12–16 across a thumbnail, so the grid stays recognisable at every
   size.
2. **Raise refraction to about 0.35,** so the pressed ribs read as glass in
   still frames, not only in motion.
3. **Keep the translucent seams (`groutScene` 0.75) and printed grain
   (0.4).** These are what separate it from both bathroom tile and a pixelate
   filter.

Keep `pressed` as the expressive variant for large, slow scenes, such as a
full-bleed sky behind a release page. Retire `lens` for moving scenes. Keep
`cast` only for the escaped tiles on the homepage, where a few large, heavy
tiles carry the motif well against the page.

Pair the material with the cloud footage, or the procedural sky where a
download is not wanted. Before production, find a sunlit green canopy and a
sunlit open-water clip, and measure on a mid-range phone.
