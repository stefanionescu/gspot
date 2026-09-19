// The manual: Starlight over the generated reference and the hand-written guides, with llms.txt from the same pages.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
    site: 'https://gspot.dev',
    integrations: [
        starlight({
            title: 'gspot',
            description: 'CLI to lint and enforce rules for LLM generated code bases.',
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stefanionescu/gspot' }],
            plugins: [starlightLinksValidator(), starlightLlmsTxt()],
            sidebar: [
                { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
                {
                    label: 'Reference',
                    items: [
                        { label: 'Commands', items: [{ autogenerate: { directory: 'reference/commands' } }] },
                        { label: 'Presets', items: [{ autogenerate: { directory: 'reference/presets' } }] },
                        {
                            label: 'Checks',
                            collapsed: true,
                            items: [{ autogenerate: { directory: 'reference/rules' } }],
                        },
                        { label: 'Settings', slug: 'reference/settings' },
                        { label: 'Engines', slug: 'reference/engines' },
                        { label: 'Decisions', slug: 'reference/decisions' },
                    ],
                },
            ],
        }),
    ],
});
