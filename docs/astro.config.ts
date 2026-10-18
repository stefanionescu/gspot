import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { writeAgentFiles } from './src/agents.ts';
import starlightLlmsTxt from 'starlight-llms-txt';
import { pruneUnusedStyles } from './src/styles.ts';
import { SIDEBAR } from './src/config/navigation.ts';
import { readReferenceData } from '#cli/reference.ts';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { description } from '@gspothq/cli/package.json' with { type: 'json' };
import { LLMS_PAGES, AGENT_STEPS, LLMS_DESCRIPTION } from './src/config/setup.ts';

import {
    FAVICON,
    EDIT_URL,
    SITE_URL,
    SOCIAL_IMAGE,
    FONT_PACKAGES,
    REPOSITORY_URL,
    APPLE_TOUCH_ICON,
    SOCIAL_IMAGE_ALT,
    SOCIAL_IMAGE_SIZE,
    FIRST_PAINT_TARGET,
} from './src/config/site.ts';

export default defineConfig({
    site: SITE_URL,
    // Fetch a page when the pointer rests on its link, so the click opens it from the cache.
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
    vite: {
        resolve: {
            tsconfigPaths: true,
            // starlight-llms-txt exports no Markdown converter, so the Markdown copy of each page imports its file.
            alias: {
                'starlight-llms-txt/markdown': fileURLToPath(
                    new URL('node_modules/starlight-llms-txt/entryToSimpleMarkdown.ts', import.meta.url),
                ),
            },
        },
        // Compile imported CLI code down to ES2022.
        oxc: { target: 'es2022' },
        // Astro uses a compiled Node.js add-on for Markdown. Bun must find it in docs/node_modules,
        // so the package lists it as a dependency and keeps Vite from bundling it.
        environments: { prerender: { resolve: { external: ['satteri'] } } },
    },
    integrations: [
        {
            name: 'settings-schema',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const { schema, schemaFile } = readReferenceData();
                    await writeFile(new URL(schemaFile, dir), JSON.stringify(schema) + '\n');
                },
            },
        },
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
        {
            name: 'agent-files',
            hooks: { 'astro:build:done': ({ dir }) => writeAgentFiles(dir) },
        },
        starlight({
            title: 'gspot',
            // Links each page to its Markdown copy.
            routeMiddleware: './src/route-data.ts',
            favicon: FAVICON,
            // Writes /llms.txt with the steps for coding agents, and /llms-full.txt and /llms-small.txt with the docs.
            plugins: [
                starlightLlmsTxt({
                    projectName: 'gspot',
                    description: LLMS_DESCRIPTION,
                    details: AGENT_STEPS,
                    ...LLMS_PAGES,
                }),
            ],
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
                { tag: 'meta', attrs: { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: APPLE_TOUCH_ICON } },
                // Wait for the browser to parse the article before painting a new page.
                { tag: 'link', attrs: { rel: 'expect', href: FIRST_PAINT_TARGET, blocking: 'render' } },
            ],
            components: {
                Header: './src/components/starlight/Header.astro',
                Footer: './src/components/starlight/Footer.astro',
                SiteTitle: './src/components/starlight/SiteTitle.astro',
                ThemeProvider: './src/components/starlight/ThemeProvider.astro',
                ThemeSelect: './src/components/starlight/ThemeSelect.astro',
                MobileMenuToggle: './src/components/starlight/MobileMenuToggle.astro',
                Sidebar: './src/components/starlight/Sidebar.astro',
                MarkdownContent: './src/components/starlight/MarkdownContent.astro',
                Hero: './src/components/starlight/Hero.astro',
            },
            expressiveCode: {
                defaultProps: { frame: 'code', wrap: true, hangingIndent: 2 },
                styleOverrides: {
                    borderRadius: '0.5rem',
                    codePaddingBlock: '0.875rem',
                    frames: {
                        editorTabBarBackground: 'var(--sl-color-gray-7, var(--sl-color-gray-6))',
                        editorActiveTabForeground: 'var(--sl-color-gray-3)',
                        editorActiveTabIndicatorTopColor: 'transparent',
                        editorTabBarBorderBottomColor: 'var(--sl-color-gray-5)',
                    },
                },
            },
            editLink: { baseUrl: EDIT_URL },
            description,
            customCss: ['./src/theme.css'],
            social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY_URL }],
            sidebar: SIDEBAR,
        }),
        {
            name: 'styles',
            hooks: { 'astro:build:done': ({ dir }) => pruneUnusedStyles(dir) },
        },
    ],
});
