#!/usr/bin/env node
/**
 * Sync the AliKit component catalog into the Alicorn website.
 *
 * AliKit stays the authoring home for component documentation: the package,
 * its tests, its browser demo, the page prose, and
 * `components.json` all live in the alicorn-kit repository. This site is the
 * single public documentation surface, so the catalog is copied here at a
 * pinned revision instead of forked.
 *
 * The pin lives in `alikit-catalog.json` at the repository root. To update it:
 *
 *   1. Change `revision` to the alicorn-kit commit to publish.
 *   2. Run `npm run sync:catalog` from the repository root.
 *   3. Review the content diff, run `npm run build`, and commit both.
 *
 * `npm run check:catalog` (or `--check`) fetches the same files and exits
 * non-zero when the committed copy has drifted. CI runs it before a deploy.
 *
 * Files are fetched from raw.githubusercontent.com so the script needs no git
 * checkout and runs identically on Windows and Linux. Nothing outside the
 * managed paths below is touched.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const website = join(here, '..');
const check = process.argv.includes('--check');

const pin = JSON.parse(await readFile(join(website, 'alikit-catalog.json'), 'utf8'));
const revision = pin.revision;
if (!/^[0-9a-f]{40}$/.test(revision)) {
  console.error(`alikit-catalog.json: revision must be a full 40-character commit SHA, got "${revision}"`);
  process.exit(1);
}

const match = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(pin.repository);
if (!match) {
  console.error(`alikit-catalog.json: cannot read owner/repo from "${pin.repository}"`);
  process.exit(1);
}
const [, owner, repo] = match;
const sourceRoot = pin.sourceRoot || 'website';

const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${revision}/`;

/** Text substitutions applied to synced pages so links resolve on this site. */
const rewrites = [
  ['href="../../compatibility/"', 'href="/docs/reference/compatibility/"'],
  ['href="../../manifest/"', 'href="/docs/reference/manifest/"'],
  ['](../compatibility/)', '](/docs/reference/compatibility/)'],
  ['](../manifest/)', '](/docs/reference/manifest/)'],
  ['](manifest/)', '](/docs/reference/manifest/)'],
  ['](compatibility/)', '](/docs/reference/compatibility/)'],
  [
    'The website copies it to\n`/components.json` at build time',
    'The Alicorn website copies it to\n`/components.json` when the catalog is synced',
  ],
];

async function fetchText(path, rewrite = true) {
  const url = rawBase + path;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  const text = await response.text();
  return rewrite ? within(text) : text;
}


/**
 * Height in pixels of each interactive browser demo.
 */
const demoHeights = {
  'command-palette': 440,
  'data-grid': 480,
  'icon-picker': 480,
  menu: 360,
  notices: 440,
  'palette-parts': 420,
  progress: 480,
  'radio-group': 440,
  segmented: 340,
  sidebar: 440,
  table: 480,
  'tree-view': 420,
};

/**
 * Replace AliKit's native screenshot section with the live WebGPU demo. Pages
 * without an embed lose the screenshot and its import as well.
 */
function withDemo(text, slug) {
  const height = demoHeights[slug];
  const captureImport = "import Capture from '../../../components/Capture.astro';\n";
  const demoImport = "import ComponentDemo from '../../../components/ComponentDemo.astro';\n";
  const captureTag = /<Capture\b[^>]*\/>\s*/i;
  const note = /<div class="preview-note">[\s\S]*?<\/div>\s*/i;
  let output = text;

  if (height) {
    output = output.replace(captureImport, demoImport);
    if (!output.includes(demoImport)) {
      output = output.replace(/(^---\n[\s\S]*?^---\n)/m, "$1" + demoImport);
    }
    const demo = '<ComponentDemo id="' + slug + '" height={' + height + '} />\n\n';
    if (captureTag.test(output)) {
      output = output.replace(captureTag, demo);
    } else if (!output.includes('<ComponentDemo id="' + slug + '"')) {
      output = output.replace(/(## Preview\s*\n)/, "$1\n" + demo);
    }
  } else {
    output = output.replace(captureImport, "").replace(captureTag, "");
  }

  return output.replace(note, "");
}

function withoutCaptureMetadata(manifest) {
  delete manifest.validation?.captures;
  for (const component of manifest.components ?? []) {
    delete component.capture;
    delete component.captureNote;
  }
  return manifest;
}

function withoutCaptureManifestDocs(text) {
  return text
    .replace(/^\|[^|\n]*capture[^|\n]*\|[^\n]*\r?\n/gim, "")
    .replace(/^\s*"capture":\s*"[^"]*",\s*\r?\n/gm, "");
}

function withoutNativeCaptureCompatibility(text) {
  return text
    .replace(
      /The native captures in this catalog were produced from the examples built against that Alicorn\s+revision with the SDL_GPU Direct3D 12 backend on Windows\./,
      "The browser previews are compiled from the AliKit examples against the Alicorn revision recorded here and rendered by Alicorn's WebGPU host.",
    )
    .replace(
      /4\. Rebuild the examples and re-capture the catalog with[\s\S]*?capture_catalog\.ps1[^\n]*\n/,
      "4. Rebuild and verify every browser component preview in the Alicorn website.\n",
    );
}

function withoutNativeCaptureCatalogText(text) {
  return text
    .replace(/native preview/gi, "interactive preview")
    .replace(/native captures?/gi, "browser previews")
    .replace(/capture, dependencies/gi, "dependencies");
}

function within(text) {
  for (const [from, to] of rewrites) text = text.split(from).join(to);
  return text;
}

function slugFromPage(page) {
  const segments = page.split('/').filter(Boolean);
  return segments[segments.length - 1];
}

/**
 * Add Starlight sidebar metadata to a synced page. AliKit owns the prose; the
 * consolidated site owns the reading order, so this is applied at sync time
 * rather than edited upstream.
 */
function withSidebar(text, lines) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return text;
  return `${text.slice(0, end + 1)}${lines}\n${text.slice(end + 1)}`;
}

/**
 * The package catalog was authored at `/components/` and links siblings
 * relatively. It now lives at `/components/catalog/`, so make those links
 * absolute before publishing.
 */
function rewriteCatalogLinks(text, entries) {
  for (const entry of entries) {
    const slug = slugFromPage(entry.page);
    text = text.split(`](${slug}/)`).join(`](/components/${slug}/)`);
  }
  return text;
}

const manifest = withoutCaptureMetadata(JSON.parse(await fetchText('components.json', false)));
const components = manifest.components.filter((component) => component.page);

/** @type {{ path: string, contents: string | Buffer }[]} */
const outputs = [];

for (const [index, component] of components.entries()) {
  const slug = slugFromPage(component.page);
  const page = await fetchText(`${sourceRoot}/src/content/docs/components/${slug}.mdx`);
  outputs.push({
    path: posix.join('src/content/docs/components', `${slug}.mdx`),
    contents: withSidebar(withDemo(page, slug), `sidebar:\n  order: ${index + 1}`),
  });
}

outputs.push(
  {
    path: 'src/content/docs/components/catalog.mdx',
    contents: withSidebar(
      withoutNativeCaptureCatalogText(rewriteCatalogLinks(await fetchText(`${sourceRoot}/src/content/docs/components.md`), components)),
      'sidebar:\n  label: Package catalog\n  order: 100',
    ),
  },
  {
    path: 'src/content/docs/docs/reference/manifest.mdx',
    contents: withoutCaptureManifestDocs(await fetchText(`${sourceRoot}/src/content/docs/manifest.mdx`)),
  },
  {
    path: 'src/content/docs/docs/reference/compatibility.md',
    contents: withoutNativeCaptureCompatibility(await fetchText(`${sourceRoot}/src/content/docs/compatibility.md`)),
  },
  {
    path: 'public/components.json',
    contents: JSON.stringify(manifest, null, 2) + '\n',
  },
  {
    // The overview page renders the catalog from the registry. `public/` cannot
    // be imported by Vite, so the same bytes are also written under src/data/.
    path: 'src/data/alikit-components.json',
    contents: JSON.stringify(manifest, null, 2) + '\n',
  },
);

// Stale managed files are reported, and removed only in write mode.
const stale = [];
async function listManaged(directory) {
  try {
    return await readdir(join(website, directory), { withFileTypes: true });
  } catch {
    return [];
  }
}

for (const file of await listManaged('src/content/docs/components')) {
  if (file.isFile() && file.name.endsWith('.mdx')) {
    const rel = posix.join('src/content/docs/components', file.name);
    if (!outputs.some((output) => output.path === rel)) stale.push(rel);
  }
}
for (const file of await listManaged('public/captures')) {
  if (file.isFile() && /\.(?:png|jpe?g|webp|gif|avif)$/i.test(file.name)) {
    stale.push(posix.join('public/captures', file.name));
  }
}

const drift = [];
for (const output of outputs) {
  const target = join(website, output.path);
  let current = null;
  try {
    current = await readFile(target);
  } catch {
    current = null;
  }
  const next = typeof output.contents === 'string' ? Buffer.from(output.contents) : output.contents;
  if (current && current.equals(next)) continue;
  drift.push(output.path);
  if (!check) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, next);
  }
}

if (!check) {
  for (const path of stale) await rm(join(website, path));
}

const label = check ? 'check' : 'sync';
const changed = drift.length + stale.length;
console.log(`${label}: alicorn-kit ${owner}/${repo}@${revision}`);
console.log(`${label}: ${components.length} component pages, live previews, manifest + compatibility + registry`);
console.log(`${label}: ${changed === 0 ? 'already current' : `${changed} file(s) ${check ? 'out of date' : 'updated'}`}`);
for (const path of drift) console.log(`  ${check ? 'stale' : 'wrote'} ${path}`);
for (const path of stale) console.log(`  ${check ? 'extra' : 'removed'} ${path}`);

if (check && changed > 0) {
  console.error('check: run "npm run sync:catalog" and commit the result');
  process.exit(1);
}
