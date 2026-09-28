import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
import { mkdirSync, copyFileSync } from 'node:fs';
import { sourceRevision } from './src/content/revision.ts';

export default defineConfig({
    site: 'https://gspot.dev',
    // Lower resource-management syntax before Bun evaluates CLI-backed references through Vite.
    vite: { oxc: { target: 'es2022' } },
    integrations: [
        {
            name: 'font-licenses',
            hooks: {
                'astro:build:done': ({ dir }) => {
                    const licenses = new URL('licenses/', dir);
                    mkdirSync(licenses, { recursive: true });
                    for (const font of ['geist', 'geist-mono']) {
                        copyFileSync(
                            new URL(`node_modules/@fontsource-variable/${font}/LICENSE`, import.meta.url),
                            new URL(`${font}.txt`, licenses),
                        );
                    }
                },
            },
        },
        starlight({
            title: 'gspot',
            head: [
                {
                    tag: 'meta',
                    attrs: { property: 'og:image', content: 'https://gspot.dev/brand/identity/social.png' },
                },
                { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: 'gspot Sweet spot mark and wordmark' } },
                { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
                {
                    tag: 'meta',
                    attrs: { name: 'twitter:image', content: 'https://gspot.dev/brand/identity/social.png' },
                },
            ],
            components: {
                Header: './src/components/starlight/Header.astro',
                Footer: './src/components/starlight/Footer.astro',
                ThemeSelect: './src/components/starlight/ThemeSelect.astro',
                Hero: './src/components/starlight/Hero.astro',
                SiteTitle: './src/components/starlight/SiteTitle.astro',
                Search: './src/components/starlight/Search.astro',
            },
            expressiveCode: { defaultProps: { frame: 'code' } },
            routeMiddleware: './src/route-metadata.ts',
            editLink: { baseUrl: `https://github.com/stefanionescu/gspot/edit/${sourceRevision}/docs/` },
            description:
                'gspot configures linters, runs checks, and generates instructions for coding agents from one configuration file',
            customCss: ['./src/theme.css'],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stefanionescu/gspot' }],
            plugins: [starlightLlmsTxt()],
            sidebar: [
                {
                    label: 'Get started',
                    collapsed: true,
                    items: [
                        { label: 'Overview', slug: 'guides/overview' },
                        { label: 'Install', slug: 'guides/install' },
                        { label: 'Quickstart', slug: 'guides/quick-start' },
                        { label: 'Client environment variables', slug: 'guides/client-environment' },
                        { label: 'Existing repositories', slug: 'guides/existing-repository' },
                    ],
                },
                {
                    label: 'Guides',
                    collapsed: true,
                    items: [
                        { label: 'Fix findings', slug: 'guides/you-got-a-finding' },
                        { label: 'Configuration', slug: 'guides/customize' },
                        { label: 'Generated files', slug: 'guides/generated-files' },
                        { label: 'Team profiles', slug: 'guides/profiles' },
                        { label: 'Coding agents', slug: 'guides/agents' },
                        { label: 'Hooks and CI', slug: 'guides/hooks-and-ci' },
                        { label: 'Monorepos', slug: 'guides/scopes' },
                        { label: 'Package managers', slug: 'guides/without-mise' },
                        { label: 'Custom checks', slug: 'guides/custom-checks' },
                        { label: 'Tests and coverage', slug: 'guides/testing' },
                        { label: 'Dependency licenses', slug: 'guides/dependency-licenses' },
                        { label: 'Security', slug: 'guides/security' },
                        { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
                        { label: 'Uninstall', slug: 'guides/uninstall' },
                    ],
                },
                {
                    label: 'Reference',
                    collapsed: true,
                    items: [
                        {
                            label: 'Commands',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/commands' } }],
                        },
                        {
                            label: 'Configurations',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/configurations' } }],
                        },
                        {
                            label: 'Checks',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/rules' } }],
                        },
                        {
                            label: 'ESLint plugin',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/plugin' } }],
                        },
                        { label: 'Settings', slug: 'reference/settings' },
                        { label: 'Configuration file', slug: 'reference/configuration' },
                    ],
                },
                {
                    label: 'Development',
                    collapsed: true,
                    items: [
                        { label: 'Build and contribute', slug: 'guides/build' },
                        { label: 'Check engines', slug: 'development/engines' },
                    ],
                },
            ],
        }),
    ],
});
