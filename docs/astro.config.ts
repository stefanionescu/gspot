import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';
import { chromium } from 'playwright';
import { createMermaidRenderer } from 'mermaid-isomorphic';
import { defineHastPlugin, type HastPluginEntry } from 'satteri';
import cliPackage from '#cli-package' with { type: 'json' };
import { defineConfig, passthroughImageService } from 'astro/config';
import { LLMS_PAGES, AGENT_FACTS, AGENT_STEPS, AGENT_EVALUATION } from '#docs/reference/setup.ts';
import { SIDEBAR, EDIT_URL, SITE_TITLE, REPOSITORY_URL, README_OPENING_BLOCKS } from '#docs/config/site.ts';

const FAVICON = '/favicon.svg';
const ICONS = [
    { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
] as const;

function readReadmeSentence(): string {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const [, paragraph] = readme.split('\n\n', README_OPENING_BLOCKS);
    if (paragraph === undefined || paragraph === '')
        throw new Error('README.md must open with a paragraph after its title.');
    const [first] = new Intl.Segmenter('en', { granularity: 'sentence' }).segment(
        paragraph.replaceAll('\n', ' ').trim(),
    );
    if (first === undefined) throw new Error('README.md must contain an opening sentence.');
    return first.segment.trim();
}

const README_OPENING = readReadmeSentence();

// Mermaid computes its derived colors from literal values, so these repeat the colors of src/theme.css.
const MERMAID_THEMES = {
    light: {
        background: '#fafafa',
        mainBkg: '#edf1ff',
        primaryColor: '#edf1ff',
        primaryTextColor: '#141b30',
        primaryBorderColor: '#2457ff',
        secondaryColor: '#f5f5f5',
        tertiaryColor: '#f5f5f5',
        lineColor: '#606060',
        textColor: '#141b30',
        edgeLabelBackground: '#fafafa',
        clusterBkg: '#f5f5f5',
        clusterBorder: '#a3a3a3',
    },
    dark: {
        background: '#0b1020',
        mainBkg: '#192754',
        primaryColor: '#192754',
        primaryTextColor: '#fafafa',
        primaryBorderColor: '#88a5ff',
        secondaryColor: '#141b30',
        tertiaryColor: '#141b30',
        lineColor: '#a3a3a3',
        textColor: '#fafafa',
        edgeLabelBackground: '#0b1020',
        clusterBkg: '#141b30',
        clusterBorder: '#525252',
    },
} as const;
const MERMAID_FONT = '"Geist Variable", sans-serif';
const MERMAID_FONT_STYLES = new URL('node_modules/@fontsource-variable/geist/index.css', import.meta.url);
const PLAYWRIGHT_CLI = fileURLToPath(new URL('node_modules/playwright/cli.js', import.meta.url));
const MERMAID_CLASS = 'language-mermaid';
const MERMAID_SOURCE_CLASS = 'mermaid-source';
const MERMAID_SOURCE = /<pre class="mermaid-source" data-diagram="([A-Za-z0-9+/=]*)"[^>]*>[^<]*<\/pre>/gu;

/**
Mark each `mermaid` code block for the build, which renders it once Chromium can run. The marker keeps the diagram
source as text, so the dev server shows the source, and `data-diagram` keeps it exact.
*/
const MERMAID_SOURCE_PLUGIN = defineHastPlugin({
    name: 'gspot-mermaid-source',
    element: {
        filter: ['pre'],
        visit(node) {
            const [code] = node.children;
            const classes = code?.type === 'element' ? code.properties['className'] : undefined;
            if (code?.type !== 'element' || !Array.isArray(classes) || !classes.includes(MERMAID_CLASS)) return;
            const [text] = code.children;
            if (text?.type !== 'text') throw new Error('A mermaid code block holds markup instead of plain text.');
            return {
                type: 'element',
                tagName: 'pre',
                properties: {
                    className: [MERMAID_SOURCE_CLASS],
                    dataDiagram: Buffer.from(text.value).toString('base64'),
                },
                children: [text],
            };
        },
    },
});

async function renderMermaidTheme(diagrams: string[], theme: keyof typeof MERMAID_THEMES): Promise<string[]> {
    const renderDiagrams = createMermaidRenderer({ browserType: chromium });
    const results = await renderDiagrams(diagrams, {
        css: MERMAID_FONT_STYLES,
        prefix: `mermaid-${theme}`,
        mermaidConfig: { theme: 'base', fontFamily: MERMAID_FONT, themeVariables: MERMAID_THEMES[theme] },
    });
    return results.map((result) => {
        if (result.status === 'rejected')
            throw new Error(`Mermaid could not render a diagram: ${String(result.reason)}`);
        return result.value.svg;
    });
}

/**
Replace each Mermaid marker in the built pages with a light and a dark SVG. The stylesheet shows the one that matches
the `data-theme` of the page. Chromium renders them, so the build installs it first, as Playwright pins it.

@param folder the build output
*/
async function renderMermaidPages(folder: URL): Promise<void> {
    const pages = readdirSync(folder, { recursive: true, encoding: 'utf8' })
        .filter((path) => path.endsWith('.html'))
        .map((path) => ({ file: new URL(path, folder), html: readFileSync(new URL(path, folder), 'utf8') }))
        .filter(({ html }) => html.includes(MERMAID_SOURCE_CLASS));
    const diagrams = pages.flatMap(({ html }) =>
        [...html.matchAll(MERMAID_SOURCE)].map(([, encoded = '']) => Buffer.from(encoded, 'base64').toString('utf8')),
    );
    if (diagrams.length === 0) return;
    await promisify(execFile)(process.execPath, [PLAYWRIGHT_CLI, 'install', '--only-shell', 'chromium']);
    const [light = [], dark = []] = await Promise.all([
        renderMermaidTheme(diagrams, 'light'),
        renderMermaidTheme(diagrams, 'dark'),
    ]);
    let index = 0;
    for (const { file, html } of pages) {
        const rendered = html.replaceAll(MERMAID_SOURCE, () => {
            const variants = `<div class="mermaid-diagram-light">${light[index] ?? ''}</div><div class="mermaid-diagram-dark">${dark[index] ?? ''}</div>`;
            index += 1;
            return `<div class="mermaid-diagram">${variants}</div>`;
        });
        writeFileSync(file, rendered);
    }
}

export default defineConfig({
    site: cliPackage.homepage,
    image: { service: passthroughImageService() },
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
    redirects: {
        '/start/overview/': '/start/quickstart/',
        '/start/footprint/': '/reference/generated-files/',
        '/configure/files/': '/use/ignore/#ignore-files-in-every-check',
    },
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
        {
            name: 'gspot-mermaid',
            hooks: {
                'astro:config:setup': ({ config }) => {
                    const { processor } = config.markdown;
                    if (processor.name !== 'satteri')
                        throw new Error('The Mermaid diagrams need the satteri Markdown processor.');
                    (processor.options as { hastPlugins: HastPluginEntry[] }).hastPlugins.unshift(
                        MERMAID_SOURCE_PLUGIN,
                    );
                },
                'astro:build:done': ({ dir }) => renderMermaidPages(dir),
            },
        },
        starlight({
            title: SITE_TITLE,
            favicon: FAVICON,
            disable404Route: true,
            plugins: [
                starlightLlmsTxt({
                    projectName: 'gspot',
                    description: cliPackage.description,
                    details: `${README_OPENING}\n\nThis documentation covers ${cliPackage.name} ${cliPackage.version}.\n\n${AGENT_FACTS}\n\n${AGENT_EVALUATION}\n\n${AGENT_STEPS}`,
                    ...LLMS_PAGES,
                }),
            ],
            head: ICONS.map((attrs) => ({ tag: 'link', attrs })),
            components: {
                Head: './src/components/starlight/Head.astro',
                Header: './src/components/starlight/Header.astro',
                Footer: './src/components/starlight/Footer.astro',
                Hero: './src/components/starlight/Hero.astro',
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
    ],
});
