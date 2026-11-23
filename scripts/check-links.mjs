#!/usr/bin/env node
/**
 * Crawl the built site and verify every internal link and asset resolves.
 *
 * Runs against `dist/` after `astro build`, so it checks what Pages will serve:
 * Astro's base path, directory-style routes, generated assets, Pagefind files,
 * and copied native captures. External URLs are counted, not fetched.
 *
 *   PUBLIC_BASE_PATH=/alicorn node scripts/check-links.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

const rawBase = process.env.PUBLIC_BASE_PATH || '/';
const base = rawBase === '/' ? '' : rawBase.replace(/\/+$/, '');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolve(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }

  if (base) {
    if (decoded !== base && !decoded.startsWith(`${base}/`)) return null;
    decoded = decoded.slice(base.length) || '/';
  }

  const relative = decoded.replace(/^\/+/, '');
  const candidates = [];
  if (decoded.endsWith('/')) {
    candidates.push(join(dist, relative, 'index.html'));
  } else {
    candidates.push(join(dist, relative));
    candidates.push(join(dist, relative, 'index.html'));
    if (!extname(relative)) candidates.push(join(dist, `${relative}.html`));
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

const pages = (await walk(dist)).filter((file) => file.endsWith('.html'));
const seen = new Set();
const broken = [];
const externals = new Set();
let references = 0;
let internal = 0;

const attribute = /(?:href|src)="([^"]*)"/g;

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const url = '/' + page.slice(dist.length + 1).split('\\').join('/');
  const pagePath = (url.endsWith('index.html') ? url.slice(0, -'index.html'.length) : url);
  // Resolve relative references against the URL the browser will see, base
  // path included.
  const pageUrl = `${base}${pagePath}`;

  for (const match of html.matchAll(attribute)) {
    const ref = match[1];
    references += 1;
    if (!ref || ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
      if (ref && !ref.startsWith('#')) externals.add(ref);
      continue;
    }
    internal += 1;

    let resolvedUrl;
    try {
      resolvedUrl = new URL(ref, `https://site.invalid${pageUrl}`);
    } catch {
      broken.push({ page: url, ref, reason: 'unparseable URL' });
      continue;
    }

    const key = `${url} -> ${resolvedUrl.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const target = await resolve(resolvedUrl.pathname);
    if (target) continue;

    const reason = base && !resolvedUrl.pathname.startsWith(`${base}/`) && resolvedUrl.pathname !== base
      ? `missing base path "${base}"`
      : 'no file in dist';
    broken.push({ page: url, ref, reason });
  }
}

console.log(`links: ${pages.length} HTML pages, ${references} references, ${internal} internal, ${externals.size} external URL(s)`);
console.log(`links: base ${JSON.stringify(base || '/')}`);

if (broken.length > 0) {
  console.error(`links: ${broken.length} broken reference(s)`);
  for (const entry of broken.slice(0, 50)) {
    console.error(`  ${entry.page} -> ${entry.ref} (${entry.reason})`);
  }
  if (broken.length > 50) console.error(`  ... ${broken.length - 50} more`);
  process.exit(1);
}

console.log('links: all internal references resolve');
