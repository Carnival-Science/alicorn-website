// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import rehypeBaseLinks from './src/lib/rehype-base-links.mjs';

const repository = 'https://github.com/Carnival-Science/Alicorn';
const base = process.env.PUBLIC_BASE_PATH || '/';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || undefined,
  base: base === '/' ? undefined : base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: { port: Number(process.env.PORT) || 4321 },
  markdown: { rehypePlugins: [rehypeBaseLinks] },
  integrations: [
    starlight({
      title: 'Alicorn',
      description:
        'An experimental native GUI runtime for Odin, with AliKit components, explicit contracts, and native previews.',
      tagline: 'Direct to write. Retained to run.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/docs.css', './src/styles/catalog.css'],
      editLink: { baseUrl: repository + '/edit/master/website/' },
      lastUpdated: false,
      pagination: true,
      credits: false,
      disable404Route: true,
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      components: {
        SiteTitle: './src/components/docs/SiteTitle.astro',
        Search: './src/components/docs/Search.astro',
        Footer: './src/components/docs/Footer.astro',
      },
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#f1eee5' } },
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { slug: 'docs' },
            { slug: 'docs/getting-started/requirements' },
            { slug: 'docs/getting-started/first-app' },
          ],
        },
        {
          label: 'Guide',
          items: [
            { slug: 'docs/concepts/retained-runtime' },
            { slug: 'docs/concepts/invalidation' },
            { slug: 'docs/guides/themes-and-components' },
            { slug: 'docs/guides/component-authoring' },
            { slug: 'docs/guides/accessibility' },
          ],
        },
        {
          label: 'Components',
          items: [
            { slug: 'components' },
            { autogenerate: { directory: 'components' } },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'docs/reference/api-and-examples' },
            { slug: 'docs/reference/manifest' },
            { slug: 'docs/reference/compatibility' },
          ],
        },
        {
          label: 'Research',
          items: [
            { slug: 'docs/research' },
            { slug: 'docs/research/layout-scopes' },
          ],
        },
        {
          label: 'Development',
          items: [{ slug: 'docs/development/build-and-test' }],
        },
        {
          label: 'Project',
          items: [{ slug: 'docs/project/status' }],
        },
      ],
    }),
  ],
});
