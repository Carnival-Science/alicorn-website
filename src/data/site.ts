/**
 * Shared Alicorn facts and links for the portal and documentation chrome.
 */
import { withBase } from '../lib/paths';

export const repository = 'https://github.com/Carnival-Science/Alicorn';
export const alikitRepository = 'https://github.com/samanshaiza004/alicorn-kit';

export const site = {
  name: 'Alicorn',
  tagline: 'Direct to write. Retained to run.',
  description:
    'Alicorn is an experimental native GUI runtime for Odin. AliKit is its optional source-level component library. Both keep application data and policy in your app.',
  repository,
  issues: repository + '/issues',
  releases: repository + '/releases',
  source: repository + '/tree/master',
} as const;

export const channels = [
  { label: 'OVERVIEW', href: withBase('/') },
  { label: 'COMPONENTS', href: withBase('/components') },
  { label: 'DOCS', href: withBase('/docs') },
  { label: 'BUILD', href: withBase('/downloads') },
  { label: 'NOTES', href: withBase('/blog') },
];

export const facts = [
  { label: 'LANGUAGE', value: 'Odin' },
  { label: 'NATIVE HOST', value: 'SDL3 · SDL_GPU (+ WebGPU)' },
  { label: 'STATE', value: 'Owned by your application' },
  { label: 'RUNTIME', value: 'Retained · dirty-driven' },
  { label: 'MATURITY', value: 'Experimental' },
];

export const footerLinks = [
  { label: 'Documentation', href: withBase('/docs') },
  { label: 'Components', href: withBase('/components') },
  { label: 'Component registry', href: withBase('/docs/reference/manifest') },
  { label: 'Examples', href: withBase('/docs/reference/api-and-examples') },
  { label: 'AliKit source', href: alikitRepository },
  { label: 'Source', href: repository },
  { label: 'Issues', href: repository + '/issues' },
  { label: 'License', href: repository + '/blob/master/LICENSE' },
];

export const jumpTargets = [
  { label: 'First native app', href: withBase('/docs/getting-started/first-app') },
  { label: 'Runtime model', href: withBase('/docs/concepts/retained-runtime') },
  { label: 'Invalidation and identity', href: withBase('/docs/concepts/invalidation') },
  { label: 'Component catalog', href: withBase('/components') },
  { label: 'Component authoring', href: withBase('/docs/guides/component-authoring') },
  { label: 'Themes and custom controls', href: withBase('/docs/guides/themes-and-components') },
  { label: 'Accessibility status', href: withBase('/docs/guides/accessibility') },
  { label: 'API and examples', href: withBase('/docs/reference/api-and-examples') },
  { label: 'Build and test', href: withBase('/docs/development/build-and-test') },
  { label: 'Project status', href: withBase('/docs/project/status') },
];

export const docsLinks = [
  { label: 'Getting started', href: withBase('/docs/getting-started/requirements') },
  { label: 'Runtime model', href: withBase('/docs/concepts/retained-runtime') },
  { label: 'Component catalog', href: withBase('/components') },
  { label: 'Themes and components', href: withBase('/docs/guides/themes-and-components') },
  { label: 'Accessibility', href: withBase('/docs/guides/accessibility') },
];
