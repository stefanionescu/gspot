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
                'gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents',
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
                        { label: 'Existing repositories', slug: 'guides/existing-repository' },
                    ],
                },
                {
                    label: 'Guides',
                    collapsed: true,
                    items: [
                        { label: 'Fix findings', slug: 'guides/findings' },
                        { label: 'The policy file', slug: 'guides/customize' },
                        { label: 'Coding agents', slug: 'guides/agents' },
                        { label: 'Hooks and CI', slug: 'guides/hooks-and-ci' },
                        { label: 'Generated files', slug: 'guides/generated-files' },
                        { label: 'Monorepos', slug: 'guides/scopes' },
                        { label: 'Team profiles', slug: 'guides/profiles' },
                        { label: 'Package managers', slug: 'guides/without-mise' },
                        { label: 'Custom checks', slug: 'guides/custom-checks' },
                        { label: 'Tests and coverage', slug: 'guides/testing' },
                        { label: 'Dependency licenses', slug: 'guides/dependency-licenses' },
                        { label: 'Security', slug: 'guides/security' },
                        { label: 'Troubleshooting', slug: 'guides/troubleshooting' },
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
                            label: 'Kits',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/kits' } }],
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
                        { label: 'Policy file', slug: 'reference/configuration' },
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
