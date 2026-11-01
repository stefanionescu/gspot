import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';
import { SIDEBAR } from '#docs/config/navigation.ts';
import { pruneUnusedStyles } from '#docs/unused-styles.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { LLMS_PAGES, AGENT_STEPS } from '#docs/reference/setup.ts';
import { defineConfig, passthroughImageService } from 'astro/config';

import {
    FAVICON,
    EDIT_URL,
    SITE_TITLE,
    SOCIAL_IMAGE,
    REPOSITORY_URL,
    APPLE_TOUCH_ICON,
    SOCIAL_IMAGE_ALT,
    SOCIAL_IMAGE_SIZE,
} from '#docs/config/site.ts';

function readReadmeSentence(): string {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const [, paragraph] = readme.split('\n\n');
    if (paragraph === undefined || paragraph === '')
        throw new Error('README.md must open with a paragraph after its title.');
    const [first] = new Intl.Segmenter('en', { granularity: 'sentence' }).segment(
        paragraph.replaceAll('\n', ' ').trim(),
    );
    if (first === undefined) throw new Error('README.md must contain an opening sentence.');
    return first.segment.trim();
}

const README_OPENING = readReadmeSentence();

export default defineConfig({
    site: cliPackage.homepage,
    image: { service: passthroughImageService() },
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
    vite: {
        define: { 'import.meta.env.PUBLIC_GSPOT_README_OPENING': JSON.stringify(README_OPENING) },
        resolve: {
            tsconfigPaths: true,
            alias: {
                '#docs': fileURLToPath(new URL('src', import.meta.url)),
                '#cli-package': fileURLToPath(new URL('../packages/cli/package.json', import.meta.url)),
            },
        },
        oxc: { target: 'es2022' },
        environments: { prerender: { resolve: { external: ['satteri'] } } },
    },
    integrations: [
        starlight({
            title: SITE_TITLE,
            favicon: FAVICON,
            plugins: [
                starlightLlmsTxt({
                    projectName: 'gspot',
                    description: cliPackage.description,
                    details: `${README_OPENING}\n\n${AGENT_STEPS}`,
                    ...LLMS_PAGES,
                }),
            ],
            head: [
                {
                    tag: 'meta',
                    attrs: {
                        property: 'og:image',
                        content: `${cliPackage.homepage}${SOCIAL_IMAGE}`,
                    },
                },
                { tag: 'meta', attrs: { property: 'og:image:width', content: String(SOCIAL_IMAGE_SIZE.width) } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: String(SOCIAL_IMAGE_SIZE.height) } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: APPLE_TOUCH_ICON } },
            ],
            components: {
                Head: './src/components/starlight/Head.astro',
                Header: './src/components/starlight/Header.astro',
                Hero: './src/components/home/hero/Hero.astro',
                SiteTitle: './src/components/starlight/SiteTitle.astro',
                ThemeProvider: './src/components/starlight/theme/Provider.astro',
                ThemeSelect: './src/components/starlight/theme/Select.astro',
                MobileMenuToggle: './src/components/starlight/MobileMenuToggle.astro',
                Sidebar: './src/components/starlight/Sidebar.astro',
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
