import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { copyFileSync, mkdirSync } from 'node:fs';
import starlightLlmsTxt from 'starlight-llms-txt';
import { sourceRevision } from './src/content/revision';

export default defineConfig({
    site: 'https://gspot.dev',
    // Lower resource-management syntax before Bun evaluates CLI-backed references through Vite.
    vite: { oxc: { target: 'es2022' } },
    integrations: [
        {
            name: 'gspot-schema',
            hooks: {
                'astro:build:done': ({ dir }) => {
                    const licenses = new URL('licenses/', dir);
                    mkdirSync(licenses, { recursive: true });
                    for (const font of ['geist', 'geist-mono']) {
                        copyFileSync(
                            new URL(`./node_modules/@fontsource-variable/${font}/LICENSE`, import.meta.url),
                            new URL(`${font}.txt`, licenses),
                        );
                    }
                    const directory = new URL('schema/', dir);
                    mkdirSync(directory, { recursive: true });
                    copyFileSync(
                        new URL('../gspot.schema.json', import.meta.url),
                        new URL('gspot.schema.json', directory),
                    );
                },
            },
        },
        starlight({
            title: 'gspot',
            head: [
                { tag: 'meta', attrs: { property: 'og:image', content: 'https://gspot.dev/brand/social.png' } },
                { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: 'gspot Sweet spot mark and wordmark' } },
                { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
                { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://gspot.dev/brand/social.png' } },
            ],
            components: { Hero: './src/components/Hero.astro', SiteTitle: './src/components/SiteTitle.astro', Search: './src/components/Search.astro' },
            expressiveCode: { defaultProps: { frame: 'code' } },
            routeMiddleware: './src/route-metadata.ts',
            editLink: { baseUrl: `https://github.com/stefanionescu/gspot/edit/${sourceRevision}/docs/` },
            description: 'CLI to lint and enforce rules for LLM generated codebases',
            customCss: ['./src/styles/theme.css'],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stefanionescu/gspot' }],
            plugins: [starlightLlmsTxt()],
            sidebar: [
                {
                    label: 'Start',
                    items: [
                        { label: 'Overview', slug: 'guides/overview' },
                        { label: 'Install', slug: 'guides/install' },
                        { label: 'Run your first check', slug: 'guides/quick-start' },
                        { label: 'Check client environment access', slug: 'guides/client-environment' },
                        { label: 'Adopt in an existing repository', slug: 'guides/existing-repository' },
                    ],
                },
                {
                    label: 'Daily work',
                    items: [
                        { label: 'Read and resolve findings', slug: 'guides/you-got-a-finding' },
                        { label: 'Choose checks and exceptions', slug: 'guides/customize' },
                        { label: 'Preset catalog', slug: 'reference/presets/index' },
                        { label: 'Share profiles', slug: 'guides/profiles' },
                        { label: 'Work with agents', slug: 'guides/agents' },
                    ],
                },
                {
                    label: 'Integrate',
                    items: [
                        { label: 'Hooks and CI', slug: 'guides/hooks-and-ci' },
                        { label: 'Scopes and monorepos', slug: 'guides/scopes' },
                        { label: 'Without mise', slug: 'guides/without-mise' },
                        { label: 'Add a custom check', slug: 'guides/custom-checks' },
                        { label: 'Tests and coverage', slug: 'guides/testing' },
                        { label: 'Dependency licenses', slug: 'guides/dependency-licenses' },
                        { label: 'Security checks', slug: 'guides/security' },
                    ],
                },
                {
                    label: 'Maintain',
                    items: [
                        { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
                        { label: 'Uninstall and recover', slug: 'guides/uninstall' },
                        { label: 'Build and contribute', slug: 'guides/build' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        {
                            label: 'Commands',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/commands' } }],
                        },
                        {
                            label: 'Presets',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/presets' } }],
                        },
                        {
                            label: 'Checks',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/rules' } }],
                        },
                        {
                            label: 'Standalone plugin',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/plugin' } }],
                        },
                        { label: 'Settings', slug: 'reference/settings' },
                        { label: 'Configuration fields', slug: 'reference/configuration' },
                        { label: 'Engines', slug: 'reference/engines' },
                    ],
                },
            ],
        }),
    ],
});
