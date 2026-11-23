/**
 * Prefix site-root links and images in Markdown/MDX with the Astro base path.
 *
 * Astro applies `base` to routes it generates, but it does not rewrite absolute
 * paths written in content. The consolidated site is served from
 * `https://carnival-science.github.io/Alicorn/`, so `/docs/...` must become
 * `/Alicorn/docs/...`. Only internal, root-absolute values are touched;
 * external URLs, protocol-relative URLs, and fragments are left alone.
 *
 * Both plain HTML elements and MDX JSX elements are handled: content pages mix
 * Markdown links with JSX wrappers, and MDX keeps those as `mdxJsx*Element`
 * nodes with an attribute list instead of a properties object.
 */
export default function rehypeBaseLinks() {
  const raw = process.env.PUBLIC_BASE_PATH || '/';
  const base = raw === '/' ? '' : raw.replace(/\/+$/, '');

  return (tree) => {
    if (!base) return;
    visit(tree);
  };

  function visit(node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'element') {
      if (node.tagName === 'a' && node.properties) {
        node.properties.href = prefix(node.properties.href);
      }
      if ((node.tagName === 'img' || node.tagName === 'source' || node.tagName === 'video') && node.properties) {
        node.properties.src = prefix(node.properties.src);
      }
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const tag = node.name;
      for (const attribute of node.attributes || []) {
        if (attribute.type !== 'mdxJsxAttribute') continue;
        if (attribute.name === 'href' && tag === 'a') {
          attribute.value = prefix(attribute.value);
        }
        if (attribute.name === 'src' && (tag === 'img' || tag === 'source' || tag === 'video')) {
          attribute.value = prefix(attribute.value);
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child);
    }
  }

  function prefix(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
      return value;
    }
    if (value === base || value.startsWith(`${base}/`)) return value;
    return `${base}${value}`;
  }
}
