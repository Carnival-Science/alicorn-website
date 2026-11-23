# Footage sources

Source clips for the material lab. The originals were downloaded on
2026-11-23 into `lab/footage-raw/`, which git ignores. The loops in this
folder were cut from them with ffmpeg: 960×540, VP9, no audio. The `.jpg`
next to each loop is its first frame, used as the poster and still-photo
scene. The lab only uses these files in development, and they are never
copied into the site build.

| Loop | Original | Author | Licence | What was done |
|---|---|---|---|---|
| `sky.webm` | [Clouds transformations.webm](https://commons.wikimedia.org/wiki/File:Clouds_transformations.webm), 1920×1080, 24.7 s, VP9 | Igor da Bari, own work (Moscow, 10 July 2017) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Scaled to 960×540. The last 2.5 s are crossfaded into the first 2.5 s, so the loop is 22.2 s with no visible seam. |
| `foliage.webm` | [Wind in tree AppletonFarms Massachusetts 2024-10.webm](https://commons.wikimedia.org/wiki/File:Wind_in_tree_AppletonFarms_Massachusetts_2024-10.webm), 1920×1080, 5.4 s, VP9 | Oakley413, own work (Appleton Farms, Massachusetts) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Cropped to the upper-left canopy (1120×630) to leave out the trunk, slowed to 0.71×, then played forward and back to make a 15 s loop. |
| `ocean.webm` | [Mesa del Mar waves 2.webm](https://commons.wikimedia.org/wiki/File:Mesa_del_Mar_waves_2.webm), 1920×1080, 28.8 s, AV1 | Photograph by Mike Peel (www.mikepeel.net) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Cropped to the water (1280×720 from y = 360). The last 2 s are crossfaded into the first 2 s, so the loop is 26.8 s. |

The CC BY-SA adaptations (`foliage.webm`, `ocean.webm` and their posters)
are shared under CC BY-SA 4.0. `sky.webm` and its poster are shared under
CC BY 4.0. Credit the authors above if any of these appear outside the lab.

## Limits of this baseline

- **Sky:** a good baseline: blue sky, cumulus, and a static camera.
- **Foliage:** an autumn tree, so the leaves are yellow, not the sunlit green
  the brief asks for, and branches cross the frame. The forward-and-back loop
  hides the cut, but a careful viewer can see the motion reverse.
- **Ocean:** overcast, filmed over a rock pool, with no sun glitter. It shows
  how water moves, not what colour it is. Replace it before choosing an ocean
  scene for production.

To rebuild the loops, see `scripts/lab-footage.sh`.
