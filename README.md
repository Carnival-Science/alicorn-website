# Alicorn website

The single public documentation site for Alicorn and its optional component
library, AliKit. It is published on GitHub Pages at
<https://carnival-science.github.io/alicorn/>.

The site has one Astro build with two surfaces:

| Route | Contents |
|---|---|
| `/` | The portal: what Alicorn is, the runtime model, and where to start. |
| `/docs/` | Starlight documentation: getting started, guide, reference, research, development, project. |
| `/components/` | The AliKit catalog: overview, native previews, per-component contracts, package catalog. |
| `/docs/reference/manifest/` | The machine-readable `components.json` registry. |
| `/components.json` | The registry itself, copied into the build. |

## Build locally

```sh
cd website
npm ci
npm run dev
```

The site is at <http://localhost:4321/>. Search is indexed by Pagefind during
the production build.

```sh
npm run build       # static output in website/dist/
npm run preview
```

## Base path

GitHub Pages serves a project site under `/alicorn/`, so the build receives
`PUBLIC_BASE_PATH=/alicorn`. `PUBLIC_SITE_URL` is the origin used for canonical
and social URLs. Both are build-time only and default to `/` and unset.

Because Astro does not rewrite absolute links written in content, two helpers
apply the base:

- `src/lib/rehype-base-links.mjs` prefixes `/...` links and images in
  Markdown/MDX (including MDX JSX elements).
- `src/lib/paths.ts` (`withBase`) does the same for hand-written `.astro`
  pages.

Verify a base-path build locally before publishing:

```powershell
$env:PUBLIC_BASE_PATH='/alicorn'
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

The pin is `website/alikit-catalog.json`. To publish a new AliKit revision:

1. Set `revision` to the alicorn-kit commit to publish (a full 40-character SHA).
2. Run `npm run sync:catalog` from `website/`.
3. Review the content and capture diff, then `npm run build`.
4. Commit the prose, the captures, `components.json`, and the pin together.

`npm run check:catalog` re-fetches the catalog and exits non-zero when the
committed copy is stale. The Pages workflow runs it before every deploy, so the
published site cannot silently disagree with the pin.

The sync writes only these managed paths:

| Source (alicorn-kit) | Destination (this repository) |
|---|---|
| `website/src/content/docs/components/*.mdx` | `website/src/content/docs/components/*.mdx` |
| `website/src/content/docs/components.md` | `website/src/content/docs/components/catalog.mdx` |
| `website/src/content/docs/manifest.mdx` | `website/src/content/docs/docs/reference/manifest.mdx` |
| `website/src/content/docs/compatibility.md` | `website/src/content/docs/docs/reference/compatibility.md` |
| `website/public/captures/*.png` | `website/public/captures/*.png` |
| `components.json` | `website/public/components.json` and `website/src/data/alikit-components.json` |

Content is fetched from `raw.githubusercontent.com` at the pinned SHA, so the
script needs no local alicorn-kit checkout and behaves the same on Windows and
Linux. Link rewrites and sidebar order are applied at sync time; edit those in
`scripts/sync-alikit-catalog.mjs`, not in the copied pages.

## Structure

| Path | Contents |
|---|---|
| `src/pages/` | Portal landing page, build page, project notes, and the `/alikit` redirect. |
| `src/layouts/PortalLayout.astro` | Shared portal shell, metadata, navigation, and copy behavior. |
| `src/components/portal/` | Landing-page sections, including the Alicorn/AliKit layer stack. |
| `src/components/docs/` | Starlight title, search, and footer overrides. |
| `src/components/Capture.astro` | Native capture figure used by component pages. |
| `src/components/CatalogCard.astro` | Catalog card used by the component overview. |
| `src/content/docs/docs/` | Guide, reference, research, development, and project pages. |
| `src/content/docs/components/` | Synced AliKit component pages (do not edit by hand). |
| `src/styles/docs.css` | Alicorn palette and typography for Starlight. |
| `src/styles/catalog.css` | Catalog grid, capture, and contract styles. |
| `src/styles/portal.css` | Responsive portal design. |
| `src/data/site.ts` | Shared project facts and links. |
| `public/captures/` | Native PNG previews, synced from AliKit. |
| `public/components.json` | Machine-readable component registry, synced from AliKit. |
| `public/assets/`, `public/fonts/` | Product screenshot and bundled Atkinson Hyperlegible fonts. |

The repository documentation remains the normative, detailed reference. Website
pages summarize it and link to the relevant source files.

## Deploy

`.github/workflows/pages.yml` builds and deploys on a push to `master` that
touches `website/**` or `docs/**`, and on manual dispatch. It uses the standard
`configure-pages` / `upload-pages-artifact` / `deploy-pages` actions, verifies
the AliKit pin, builds with the Pages base path, and crawls internal links
before uploading `website/dist`.

The former AliKit standalone site is retired; its repository now serves a
redirect to `/components/` here.
