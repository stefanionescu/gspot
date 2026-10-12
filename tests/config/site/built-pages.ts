import { STATIC_SITE_FILES } from '#tests/config/site/project.ts';

/** Built-output checks run without acquiring tools. */
const BUILT_PAGE_CASES = [
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
    rule: 'dead-selector',
    line: 1,
    message: 'No built page uses the selector .unused.',
} as const;

const USED_SELECTOR_BODY =
    '<p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script>';

const USED_SELECTOR_CSS = String.raw`.print\:hidden { display: none; }.w-1\/2 { width: 50%; }.feedback.show { opacity: 1; }.pagefind-ui__result { color: blue; }.pagefind-ui__loading { opacity: 0.5; }.unused { color: red; }:focus-visible { outline: 3px solid blue; }.unused:focus-visible { color: red; }.reviewed:focus-visible { color: purple; }`;

const REVIEWED_SELECTOR_SETTINGS = `
[tools.purgecss]
safelist = { value = ["reviewed"], reason = "The script adds this reviewed class at runtime." }
`;

const OUTPUT_CASES = [
    {
        name: 'links',
        check: 'site/linkinator',
        body: '<a href="/missing.html">Missing</a>',
        finding: {
            check: 'site/linkinator',
            file: 'dist/index.html',
            rule: 'broken-link',
            line: 1,
            message: 'missing.html answers 404.',
        },
    },
    {
        name: 'fragments',
        check: 'site/linkinator',
        body: '<h1 id="good">Good</h1><a href="#good">Good</a><a href="#missing">Missing</a><a name="encoded id"></a><a href="#encoded%20id">Encoded</a>',
        finding: {
            check: 'site/linkinator',
            file: 'dist/index.html',
            rule: 'broken-link',
            line: 1,
            message: 'index.html#missing has no matching fragment.',
        },
    },
    {
        name: 'public origins and orphan pages',
        check: 'site/linkinator',
        body: '<p>Landing page</p>',
        files: {
            'sitemap.xml': STATIC_SITE_FILES['sitemap.xml'],
            'orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#missing">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
        finding: {
            check: 'site/linkinator',
            file: 'dist/orphan.html',
            rule: 'broken-link',
            line: 1,
            message: 'orphan.html#missing has no matching fragment.',
        },
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        body: '<img src="image.png">',
        finding: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    },
    {
        name: 'selectors at level recommended',
        level: 'recommended',
        check: 'site/purgecss',
        body: USED_SELECTOR_BODY,
        finding: SELECTOR_FINDING,
    },
] as const;

/** Built pages with one located accessibility finding and its fix. */
const MISSING_ALT_PAGE = `<!doctype html>
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

const ALT_TEXT_PAGE = `<!doctype html>
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

const SITE_PAGE_HEAD = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>';

export {
    OUTPUT_CASES,
    ALT_TEXT_PAGE,
    SITE_PAGE_HEAD,
    BUILT_PAGE_CASES,
    MISSING_ALT_PAGE,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_SETTINGS,
};
