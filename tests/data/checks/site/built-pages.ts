/** Built-output checks run without installing tools. */
export const BUILT_PAGE_CASES = [
    {
        check: 'site/size',
        files: {},
        settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 0
`,
        expected: { file: 'gspot.toml', rule: 'size', line: 1 },
        corrected: {
            files: {},
            settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 10
`,
        },
    },
    {
        check: 'site/sitemap',
        files: {
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.test/</loc></url>
    <url><loc>https://example.test/about.html</loc></url>
    <url><loc>https://example.test/pricing.html</loc></url>
</urlset>
`,
        },
        expected: { file: 'dist/sitemap.xml', rule: 'missing-page', line: 1 },
    },
] as const;

const SELECTOR_FINDING = {
    file: 'dist/style.css',
    rule: 'unused-selector',
    line: 1,
    message: 'No built page uses the selector .unused.',
} as const;

const REVIEWED_SELECTOR_SETTINGS = `
[tools.purgecss]
safelist = { value = ["reviewed"], reason = "The script adds this reviewed class at runtime." }
`;

/** Settings that select the site build checks at level all. */
export const SITE_SETTINGS = `level = "all"
configurations = ["site"]
[site]
build_command = ["bun", "build.js"]
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
                message: 'file://missing.html (at 1:104) | File not found. Check if file exists and path is correct',
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
                message: 'file://index.html#missing (at 1:151) | Cannot find fragment',
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
                message:
                    'file://orphan.html#missing (at 1:126) | Cannot find fragment | Remaps: https://example.test/orphan.html#missing --> file://orphan.html#missing',
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
        settings: SITE_SETTINGS.replace('all', 'recommended') + REVIEWED_SELECTOR_SETTINGS,
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

export const SITE_PAGE_HEAD =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>';
