# Alicorn website

The single public documentation site for Alicorn and its optional component
library, AliKit. It is published on GitHub Pages at
<https://carnival-science.github.io/alicorn-website/>.

This repository is private: the Alicorn source repository does not ship the
site, so cloning Alicorn gives you the runtime and the Markdown docs, not a
second copy of the site build. The Alicorn repository keeps a redirect at the
old Pages URL (<https://carnival-science.github.io/Alicorn/>) so existing links
continue to work.

The site has one Astro build with three surfaces:

| Route | Contents |
|---|---|
| `/` | The homepage: the WebGPU app stage, the runtime model, and AliKit, composed as one object. |
| `/docs/` | Starlight documentation: getting started, guide, reference, research, development, project. |
| `/components/` | The AliKit catalog: overview, native previews, per-component contracts, package catalog. |
| `/docs/reference/manifest/` | The machine-readable `components.json` registry. |
| `/components.json` | The registry itself, copied into the build. |

## The homepage

The homepage is a quiet sheet in the manner of early-2000s studio sites. A
small pixel-font nav (`src/lib/pixel-font.ts`) sits over a heavy rule and
switches the text column between Runtime, Identity, AliKit, Build, and Notes.
The app stage is on the right, and the documentation tabs hang from a second
rule at the foot. On standby the stage shows a sky through square glass
tiles (`src/lib/glass-sky.ts`, WebGL). Each tile gathers the light behind it
the way a pixel does, and the clouds and sunlight breathe on slow, unrelated
periods. It renders at 30 fps and pauses when it is off screen. Panel changes
repaint with a raster dissolve.
`?still` renders the settled page without motion for captures.

### The stage

`src/lib/stage.ts` reserves the stage for an Alicorn app built for WebGPU. Set
`stage.module` to the URL of an ES module whose default export is a
`StageMount`. It receives the canvas, an abort signal, and a status callback.
Then replace `stage.source` with the files a visitor can open from
**Peek source**. Until then the stage shows the glass sky, and the drawer
shows the documented starter, marked as a placeholder.

## Build locally

```sh
npm ci
npm run dev
```

The site is at <http://localhost:4321/>. Search is indexed by Pagefind during
the production build.

```sh
npm run build       # static output in dist/
npm run preview
npm run check:links # crawl internal references in the built output
```

## Base path

GitHub Pages serves a project site under the repository path. This repository is
`alicorn-website`, so the deployed base is `/alicorn-website/` and Pages URLs are
case-sensitive: the mixed-case `/Alicorn-website/` does not serve the site. The
Pages workflow takes the base from `actions/configure-pages`, so no casing is
hard-coded. `PUBLIC_SITE_URL` is the origin used for canonical and social URLs.
Both are build-time only and default to `/` and unset.

Because Astro does not rewrite absolute links written in content, two helpers
apply the base:

- `src/lib/rehype-base-links.mjs` prefixes `/...` links and images in
  Markdown/MDX (including MDX JSX elements).
- `src/lib/paths.ts` (`withBase`) does the same for hand-written `.astro`
  pages.

Verify a base-path build locally before publishing:

```powershell
$env:PUBLIC_BASE_PATH='/alicorn-website'
$env:PUBLIC_SITE_URL='https://carnival-science.github.io'
npm run build
npm run check:links
```

## AliKit catalog sourcing

AliKit remains the authoring home for component documentation. The component
package, tests, example, theme data, native capture, page prose, and
`components.json` all live in
[samanshaiza004/alicorn-kit](https://github.com/samanshaiza004/alicorn-kit).
This site publishes that catalog at a pinned revision instead of forking it, so
a component page cannot drift from the component.

The pin is `alikit-catalog.json` at the repository root. It currently points at
alicorn-kit `fded57a94e6a2c5bf44d8b980befe5a260ff5ed5`. To publish a new AliKit
revision:

1. Set `revision` to the alicorn-kit commit to publish (a full 40-character SHA).
2. Run `npm run sync:catalog` from the repository root.
3. Review the content and capture diff, then `npm run build`.
4. Commit the prose, the captures, `components.json`, and the pin together.

The pin may intentionally lag `alicorn-kit` main when a newer commit is still a
prototype; publish a reviewed catalog revision, not every upstream commit.

`npm run check:catalog` re-fetches the catalog and exits non-zero when the
committed copy is stale. The Pages workflow runs it before every deploy, so the
published site cannot silently disagree with the pin.

The sync writes only these managed paths:

| Source (alicorn-kit) | Destination (this repository) |
|---|---|
| `website/src/content/docs/components/*.mdx` | `src/content/docs/components/*.mdx` |
| `website/src/content/docs/components.md` | `src/content/docs/components/catalog.mdx` |
| `website/src/content/docs/manifest.mdx` | `src/content/docs/docs/reference/manifest.mdx` |
| `website/src/content/docs/compatibility.md` | `src/content/docs/docs/reference/compatibility.md` |
| `website/public/captures/*.png` | `public/captures/*.png` |
| `components.json` | `public/components.json` and `src/data/alikit-components.json` |

Content is fetched from `raw.githubusercontent.com` at the pinned SHA, so the
script needs no local alicorn-kit checkout and behaves the same on Windows and
Linux. Link rewrites and sidebar order are applied at sync time; edit those in
`scripts/sync-alikit-catalog.mjs`, not in the copied pages.

## Structure

| Path | Contents |
|---|---|
| `src/pages/` | Portal landing page, build page, project notes, and the `/alikit` redirect. |
| `src/layouts/PortalLayout.astro` | Shared portal shell, metadata, navigation, and copy behavior. |
| `src/components/object/` | Homepage stage, source drawer, text panels, and pixel text. |
| `src/components/portal/` | Shared site masthead and footer. |
| `src/components/docs/` | Starlight title, search, and footer overrides. |
| `src/components/Capture.astro` | Native capture figure used by component pages. |
| `src/components/CatalogCard.astro` | Catalog card used by the component overview. |
| `src/content/docs/docs/` | Guide, reference, research, development, and project pages. |
| `src/content/docs/components/` | Synced AliKit component pages (do not edit by hand). |
| `src/styles/` | Alicorn palette, catalog, and portal styles. |
| `src/data/site.ts` | Shared project facts and links. |
| `public/captures/` | Native PNG previews, synced from AliKit. |
| `public/components.json` | Machine-readable component registry, synced from AliKit. |
| `public/assets/`, `public/fonts/` | Product screenshot and bundled Atkinson Hyperlegible fonts. |
| `scripts/` | Catalog sync and built-site link crawl. |

The Alicorn repository documentation remains the normative, detailed reference.
Website pages summarize it and link to the relevant source files.

## Deploy

`.github/workflows/pages.yml` builds and deploys on a push to `main` and on
manual dispatch. It uses the standard `configure-pages` /
`upload-pages-artifact` / `deploy-pages` actions, verifies the AliKit pin,
builds with the Pages base path, and crawls internal links before uploading
`dist`.

A separate `Build website` workflow runs the catalog pin check, the base-path
build, and the internal link crawl on every push and pull request, so the build
stays verified even while Pages deployment is unavailable.

## Private repository Pages caveat

GitHub Pages can publish from a private repository only on a paid plan (GitHub
Team or Enterprise for organizations; Free organizations and personal Free
accounts cannot publish Pages from private repositories). Depending on the plan,
the published site is world-readable by default, and access control ("Private"
site visibility, signed-in viewers only) is an Enterprise Cloud feature. If this
organization is on the Free plan, either upgrade the plan or publish the built
output to a separate public repository while this source stays private. Verify
the deployed URL with an unauthenticated request after any plan or visibility
change.

## History

This repository was split from the Alicorn repository's `website/` directory
with `git subtree split -P website` at Alicorn commit `4182ae1`, so the site
keeps its full file history. The former standalone AliKit catalog site is
retired; alicorn-kit keeps only a redirect to `/components/` here.
