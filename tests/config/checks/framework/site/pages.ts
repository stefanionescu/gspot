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

export const INVALID_SITEMAP_URLS = ['/', 'https://example.test/%E0%A4/'];
