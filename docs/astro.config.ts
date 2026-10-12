import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { purgeStyles } from './src/styles.ts';
import { mkdir, copyFile } from 'node:fs/promises';
import { SIDEBAR } from './src/config/navigation.ts';
import { description } from '@gspothq/cli/package.json' with { type: 'json' };
import { LOGO, SITE_URL, SOCIAL_IMAGE, FONT_PACKAGES, REPOSITORY_URL, SOCIAL_IMAGE_SIZE } from './src/config/site.ts';

export default defineConfig({
    site: SITE_URL,
    vite: {
        resolve: { tsconfigPaths: true },
        // Compile imported CLI code down to ES2022.
        oxc: { target: 'es2022' },
        // Astro uses a compiled Node.js add-on for Markdown. Bun must find it in docs/node_modules,
        // so the package lists it as a dependency and keeps Vite from bundling it.
        environments: { prerender: { resolve: { external: ['satteri'] } } },
    },
    integrations: [
        {
            name: 'font-licenses',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const licenses = new URL('licenses/', dir);
                    await mkdir(licenses, { recursive: true });
                    for (const font of FONT_PACKAGES) {
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
            favicon: LOGO,
            head: [
                {
                    tag: 'meta',
                    attrs: {
                        property: 'og:image',
                        content: `${SITE_URL}${SOCIAL_IMAGE}`,
                    },
                },
                { tag: 'meta', attrs: { property: 'og:image:width', content: String(SOCIAL_IMAGE_SIZE.width) } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: String(SOCIAL_IMAGE_SIZE.height) } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: 'The gspot logo.' } },
            ],
            components: {
                SiteTitle: './src/components/starlight/SiteTitle.astro',
            },
            expressiveCode: { defaultProps: { frame: 'code' } },
            editLink: { baseUrl: 'https://github.com/stefanionescu/gspot/edit/main/docs/' },
            description,
            customCss: ['./src/theme.css'],
            social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY_URL }],
            sidebar: SIDEBAR.map((group) =>
                'items' in group
                    ? {
                          ...group,
                          items: group.items.map((item) =>
                              'items' in item ? { ...item, items: [...item.items] } : item,
                          ),
                      }
                    : group,
            ),
        }),
        {
            name: 'styles',
            hooks: { 'astro:build:done': ({ dir }) => purgeStyles(dir) },
        },
    ],
});
