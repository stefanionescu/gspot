import { join } from 'node:path';
import { PurgeCSS } from 'purgecss';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
import { SIDEBAR } from './src/config/navigation.ts';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';

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
            favicon: '/brand/identity/mark/light.svg',
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
        {
            name: 'unused-css',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const output = fileURLToPath(dir);
                    const styles = await new PurgeCSS().purge({
                        css: [join(output, '**/*.css')],
                        content: [join(output, '**/*.html'), join(output, '**/*.js')],
                        defaultExtractor: (content) =>
                            (content.match(/[\w/:-]+/g) ?? []).map((token) => {
                                let end = token.length;
                                while (token[end - 1] === ':') end--;
                                return token.slice(0, end);
                            }),
                        safelist: { standard: [/^:[\w-]+$/u] },
                    });
                    for (const style of styles) {
                        if (style.file === undefined) throw new Error('PurgeCSS returned no stylesheet path.');
                        await writeFile(style.file, style.css);
                    }
                },
            },
        },
    ],
});
