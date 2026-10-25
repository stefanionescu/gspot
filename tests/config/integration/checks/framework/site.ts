const CORRECTED_INDEX_PAGE =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>';

const UNUSED_STYLE = '.unused { color: red; }';

export const TWO_SITE_TABLES = `[[ignore]]
check = "site/html-validate"
rule = "wcag/h37"
paths = ["app/**"]
reason = "Application alternative text is supplied by the rendering environment."
[[scope]]
path = "app"
configurations = ["site"]
site.build_folder = "app/dist"
[[scope]]
path = "other"
configurations = ["site"]
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

export const BUILT_HTML_SITES = [
    { name: 'a root HTML configuration', configurations: ['html'], files: { 'index.html': ALT_TEXT_PAGE } },
    { name: 'site-only child configurations', configurations: [], files: {} },
] as const;

const SELECTOR_FINDING = {
    file: 'dist/style.css',
    rule: 'unused-selector',
    line: 1,
    message: 'No built page uses the selector .unused.',
} as const;

export const OUTPUT_CASES = [
    {
        name: 'links',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><a href="/missing.html">Missing</a></body></html>',
            'pages/style.css': UNUSED_STYLE,
        },
        findings: [
            {
                check: 'site/lychee',
                file: 'dist/index.html',
                rule: 'ERROR',
                line: 1,
                message: `{file-url}missing.html (at 1:104) | File not found. Check if file exists and path is correct`,
            },
        ],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
        },
    },
    {
        name: 'fragments',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><h1 id="good">Good</h1><a href="#good">Good</a><a href="#missing">Missing</a><a name="encoded id"></a><a href="#encoded%20id">Encoded</a></body></html>',
            'pages/style.css': UNUSED_STYLE,
        },
        findings: [
            {
                check: 'site/lychee',
                file: 'dist/index.html',
                rule: 'ERROR',
                line: 1,
                message: `{file-url}index.html#missing (at 1:151) | Cannot find fragment`,
            },
        ],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
        },
    },
    {
        name: 'public origins and orphan pages',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p>Landing page</p></body></html>',
            'pages/style.css': UNUSED_STYLE,
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
                message: `{file-url}orphan.html#missing (at 1:126) | Cannot find fragment | Remaps: https://example.test/orphan.html#missing --> {file-url}orphan.html#missing`,
            },
        ],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
            'pages/orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#good">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><img src="image.png"></body></html>',
            'pages/style.css': UNUSED_STYLE,
        },
        findings: [{ file: 'dist/index.html', rule: 'wcag/h37', line: 1 }],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
        },
    },
    {
        name: 'selectors at level recommended',
        check: 'site/purgecss',
        level: 'recommended',
        tables: `
[tools.purgecss]
safelist = { value = ["reviewed"], reason = "The script adds this reviewed class at runtime." }
`,
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
