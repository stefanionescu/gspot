import { sourceRevision } from './source';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
// The manual: Starlight over the generated reference and the hand-written guides, with llms.txt from the same pages.
import { copyFileSync, mkdirSync } from 'node:fs';

export default defineConfig({
    site: 'https://gspot.dev',
    integrations: [
        {
            name: 'gspot-schema',
            hooks: {
                'astro:build:done': ({ dir }) => {
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
            editLink: { baseUrl: `https://github.com/stefanionescu/gspot/edit/${sourceRevision}/docs/` },
            description: 'Repository checks and coding-agent rules, configured together.',
            customCss: ['./src/styles/theme.css'],
            head: [{ tag: 'meta', attrs: { property: 'og:image', content: 'https://gspot.dev/brand/social.png' } }],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stefanionescu/gspot' }],
            plugins: [starlightLlmsTxt()],
            disable404Route: true,
            sidebar: [
                {
                    label: 'Start',
                    items: [
                        { label: 'Install', slug: 'guides/install' },
                        { label: 'Run your first check', slug: 'guides/quick-start' },
                        { label: 'Adopt in an existing repository', slug: 'guides/existing-repository' },
                    ],
                },
                {
                    label: 'Daily work',
                    items: [
                        { label: 'Read and resolve findings', slug: 'guides/you-got-a-finding' },
                        { label: 'Choose checks and exceptions', slug: 'guides/customize' },
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
