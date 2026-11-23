#!/usr/bin/env node
/**
 * Sync the AliKit component catalog into the Alicorn website.
 *
 * AliKit stays the authoring home for component documentation: the package,
 * its tests, its native example, the capture, the page prose, and
 * `components.json` all live in the alicorn-kit repository. This site is the
 * single public documentation surface, so the catalog is copied here at a
 * pinned revision instead of forked.
 *
 * The pin lives in `website/alikit-catalog.json`. To update it:
 *
 *   1. Change `revision` to the alicorn-kit commit to publish.
 *   2. Run `npm run sync:catalog` from `website/`.
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
const capturePattern = /^website\/public\/captures\/([^/]+\.png)$/;

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

async function fetchBytes(path) {
  const url = rawBase + path;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
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

const manifest = JSON.parse(await fetchText('components.json', false));
const components = manifest.components.filter((component) => component.page);

/** @type {{ path: string, contents: string | Buffer }[]} */
const outputs = [];
const wantedCaptures = new Set();

for (const [index, component] of components.entries()) {
  const slug = slugFromPage(component.page);
  const page = await fetchText(`${sourceRoot}/src/content/docs/components/${slug}.mdx`);
  outputs.push({
    path: posix.join('src/content/docs/components', `${slug}.mdx`),
    contents: withSidebar(page, `sidebar:\n  order: ${index + 1}`),
  });

  // The page is the authority for its preview; the manifest `capture` field is
  // a secondary hint because older entries may omit it.
  const referenced = [...page.matchAll(/captures\/[a-z0-9-]+\.png/gi)].map((match) => posix.basename(match[0]));
  const capture = capturePattern.exec(component.capture || '');
  if (capture) referenced.push(capture[1]);
  if (referenced.length === 0) {
    console.warn(`warn: ${component.id} names no native capture`);
  }
  for (const name of new Set(referenced)) wantedCaptures.add(name);
}

for (const name of [...wantedCaptures].sort()) {
  outputs.push({
    path: posix.join('public/captures', name),
    contents: await fetchBytes(`website/public/captures/${name}`),
  });
}

outputs.push(
  {
    path: 'src/content/docs/components/catalog.mdx',
    contents: withSidebar(
      rewriteCatalogLinks(await fetchText(`${sourceRoot}/src/content/docs/components.md`), components),
      'sidebar:\n  label: Package catalog\n  order: 100',
    ),
  },
  {
    path: 'src/content/docs/docs/reference/manifest.mdx',
    contents: await fetchText(`${sourceRoot}/src/content/docs/manifest.mdx`),
  },
  {
    path: 'src/content/docs/docs/reference/compatibility.md',
    contents: await fetchText(`${sourceRoot}/src/content/docs/compatibility.md`),
  },
  {
    path: 'public/components.json',
    contents: await fetchText('components.json', false),
  },
  {
    // The overview page renders the catalog from the registry. `public/` cannot
    // be imported by Vite, so the same bytes are also written under src/data/.
    path: 'src/data/alikit-components.json',
    contents: await fetchText('components.json', false),
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
  if (file.isFile() && file.name.endsWith('.png') && !wantedCaptures.has(file.name)) {
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
console.log(`${label}: ${components.length} component pages, ${wantedCaptures.size} captures, manifest + compatibility + registry`);
console.log(`${label}: ${changed === 0 ? 'already current' : `${changed} file(s) ${check ? 'out of date' : 'updated'}`}`);
for (const path of drift) console.log(`  ${check ? 'stale' : 'wrote'} ${path}`);
for (const path of stale) console.log(`  ${check ? 'extra' : 'removed'} ${path}`);

if (check && changed > 0) {
  console.error('check: run "npm run sync:catalog" and commit the result');
  process.exit(1);
}
