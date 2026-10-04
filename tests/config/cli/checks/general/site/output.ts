import type { FindingCase } from '#tests/types/harness/check-case.ts';

/** Built-output checks run without acquiring tools. */
export const OUTPUT_CASES: FindingCase[] = [
    {
        check: 'site/size',
        files: {},
        policy: '[site]\nsizes = [{paths = ["**/*.html"], kb = 0}]\n',
        expected: { file: 'gspot.toml', rule: 'size', line: 1 },
        corrected: { files: {}, policy: '[site]\nsizes = [{paths = ["**/*.html"], kb = 10}]\n' },
    },
    {
        check: 'site/sitemap',
        files: {
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://example.test/</loc></url>\n    <url><loc>https://example.test/about.html</loc></url>\n    <url><loc>https://example.test/pricing.html</loc></url>\n</urlset>\n`,
        },
        expected: { file: 'dist/sitemap.xml', rule: 'missing-page', line: 1 },
    },
];
