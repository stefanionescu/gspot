import { isWindows } from '#tests/setup/system/platform.ts';
import { SITE_SETTINGS } from '#tests/config/checks/framework/site/pages.ts';

// Lychee prints a local file URL with a third slash on Windows.
const FILE_URL = isWindows ? 'file:///' : 'file://';

export const SITE_CASES = [
    {
        check: 'site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: { file: '', rule: 'build', line: 1 },
    },
] as const;

/** The root checks HTML; two site scopes run their own builds, and one accessibility ignore covers the app scope. */
export const TWO_SITE_TABLES = `[[ignore]]
check = "site/html-validate"
rule = "wcag/h37"
paths = ["app/**"]
reason = "Application alternative text is supplied by the rendering environment."
[[scope]]
path = "app"
configurations = ["site"]
site.build_command = ["node", "build.mjs"]
site.build_folder = "app/dist"
[[scope]]
path = "other"
configurations = ["site"]
site.build_command = ["node", "build.mjs"]
site.build_folder = "other/dist"
`;

export const ALT_TEXT_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg" alt="Example">
</main>
</body>
</html>
`;

/** Rule ignores stay inside their site, with or without an HTML configuration at the root. */
export const BUILT_HTML_SITES = [
    { name: 'a root HTML configuration', configurations: ['html'], files: { 'index.html': ALT_TEXT_PAGE } },
    { name: 'site-only child configurations', configurations: [], files: {} },
] as const;

export const SITE_OUTPUT_BUILD = `import { cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await cp('pages', 'dist', { recursive: true });
`;

const SELECTOR_FINDING = {
    file: 'dist/style.css',
    rule: 'unused-selector',
    line: 1,
    message: 'No built page uses the selector .unused.',
} as const;

const REVIEWED_SELECTOR_TABLES = `
[tools.purgecss]
safelist = { value = ["reviewed"], reason = "The script adds this reviewed class at runtime." }
`;

export const OUTPUT_CASES = [
    {
        name: 'links',
        check: 'site/lychee',
        settings: SITE_SETTINGS,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><a href="/missing.html">Missing</a></body></html>',
            'pages/style.css': '.unused { color: red; }',
        },
        findings: [
            {
                check: 'site/lychee',
                file: 'dist/index.html',
                rule: 'ERROR',
                line: 1,
                message: `${FILE_URL}missing.html (at 1:104) | File not found. Check if file exists and path is correct`,
            },
        ],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>',
        },
    },
    {
        name: 'fragments',
        check: 'site/lychee',
        settings: SITE_SETTINGS,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><h1 id="good">Good</h1><a href="#good">Good</a><a href="#missing">Missing</a><a name="encoded id"></a><a href="#encoded%20id">Encoded</a></body></html>',
            'pages/style.css': '.unused { color: red; }',
        },
        findings: [
            {
                check: 'site/lychee',
                file: 'dist/index.html',
                rule: 'ERROR',
                line: 1,
                message: `${FILE_URL}index.html#missing (at 1:151) | Cannot find fragment`,
            },
        ],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>',
        },
    },
    {
        name: 'public origins and orphan pages',
        check: 'site/lychee',
        settings: SITE_SETTINGS,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p>Landing page</p></body></html>',
            'pages/style.css': '.unused { color: red; }',
            'pages/sitemap.xml':
                '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://example.test/</loc></url>\n    <url><loc>https://example.test/about.html</loc></url>\n</urlset>\n',
            'pages/orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#missing">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
        findings: [
            {
                check: 'site/lychee',
                file: 'dist/orphan.html',
                rule: 'ERROR',
                line: 1,
                message: `${FILE_URL}orphan.html#missing (at 1:126) | Cannot find fragment | Remaps: https://example.test/orphan.html#missing --> ${FILE_URL}orphan.html#missing`,
            },
        ],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>',
            'pages/orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#good">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        settings: SITE_SETTINGS,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><img src="image.png"></body></html>',
            'pages/style.css': '.unused { color: red; }',
        },
        findings: [{ file: 'dist/index.html', rule: 'wcag/h37', line: 1 }],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>',
        },
    },
    {
        name: 'selectors at level recommended',
        check: 'site/purgecss',
        settings: SITE_SETTINGS.replace('all', 'recommended') + REVIEWED_SELECTOR_TABLES,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script></body></html>',
            'pages/style.css': String.raw`.print\:hidden { display: none; }.w-1\/2 { width: 50%; }.feedback.show { opacity: 1; }.pagefind-ui__result { color: blue; }.pagefind-ui__loading { opacity: 0.5; }.unused { color: red; }:focus-visible { outline: 3px solid blue; }.unused:focus-visible { color: red; }.reviewed:focus-visible { color: purple; }`,
        },
        findings: [
            SELECTOR_FINDING,
            {
                file: 'dist/style.css',
                rule: 'unused-selector',
                line: 1,
                message: 'No built page uses the selector .unused:focus-visible.',
            },
        ],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script><p class="unused">Example</p></body></html>',
        },
    },
] as const;

/** Built pages with one located accessibility finding and its fix. */
export const MISSING_ALT_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg">
</main>
</body>
</html>
`;

export const SITE_PAGE_HEAD =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>';
