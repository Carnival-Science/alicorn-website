/**
 * Prefix a site-root path with Astro's configured base path.
 *
 * Hand-written pages use this because Astro does not rewrite `href` values in
 * `.astro` components. Markdown links are handled by `rehype-base-links.mjs`.
 */
const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/+$/, '');

export const withBase = (path: string): string => {
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith('#')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
};
