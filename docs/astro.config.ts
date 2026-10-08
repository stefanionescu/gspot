import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
import { mkdir, copyFile } from 'node:fs/promises';
import { SIDEBAR } from './src/config/navigation.ts';

export default defineConfig({
    site: 'https://generativespotting.com',
    // Lower CLI syntax for Vite and keep the Markdown native loader at its installed package origin.
    vite: { oxc: { target: 'es2022' }, environments: { prerender: { resolve: { external: ['satteri'] } } } },
    integrations: [
        {
            name: 'font-licenses',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const licenses = new URL('licenses/', dir);
                    await mkdir(licenses, { recursive: true });
                    for (const font of ['geist', 'geist-mono']) {
                        await copyFile(
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
                    attrs: {
                        property: 'og:image',
                        content: 'https://generativespotting.com/brand/identity/social.png',
                    },
                },
                { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: 'The gspot logo.' } },
                { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
                {
                    tag: 'meta',
                    attrs: {
                        name: 'twitter:image',
                        content: 'https://generativespotting.com/brand/identity/social.png',
                    },
                },
            ],
            components: {
                Header: './src/components/starlight/Header.astro',
                SiteTitle: './src/components/starlight/SiteTitle.astro',
                Search: './src/components/starlight/Search.astro',
            },
            expressiveCode: { defaultProps: { frame: 'code' } },
            editLink: { baseUrl: 'https://github.com/stefanionescu/gspot/edit/main/docs/' },
            description:
                'gspot sets up linters and checks for the languages in your repository and installs rules for coding agents',
            customCss: ['./src/theme.css'],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stefanionescu/gspot' }],
            plugins: [starlightLlmsTxt()],
            sidebar: SIDEBAR,
        }),
    ],
});
