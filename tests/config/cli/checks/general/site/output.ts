import { STATIC_SITE_FILES } from '#tests/config/samples/site.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

/** Built-output checks run without acquiring tools. */
export const CASES: FindingCase[] = [
    {
        check: 'site/size',
        files: {},
        policy: '[site]\nmax_kilobytes = [{paths = ["**/*.html"], kb = 0}]\n',
        expected: { file: 'gspot.toml', rule: 'size', line: 1 },
        corrected: { files: {}, policy: '[site]\nmax_kilobytes = [{paths = ["**/*.html"], kb = 10}]\n' },
    },
    {
        check: 'site/sitemap',
        files: {
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://example.test/</loc></url>\n    <url><loc>https://example.test/about.html</loc></url>\n    <url><loc>https://example.test/pricing.html</loc></url>\n</urlset>\n`,
        },
        expected: { file: 'dist/sitemap.xml', rule: 'missing-page', line: 1 },
    },
];

/** Authored inputs and configuration selection for the built-output checks. */
export const REPOSITORY: InProcessScenario = {
    configurations: ['site'],
    files: STATIC_SITE_FILES,
};

/** Native analyzer diagnostics for fatal, absent, and malformed reports. */
export const SITE_REPORTS = [
    {
        name: 'links',
        check: 'site/linkinator',
        fatal: 'Linkinator failed: Test tool diagnostic',
        reports: [
            { output: '', reason: 'Linkinator returned no JSON report.' },
            { output: '{ broken', reason: 'JSON Parse error' },
            { output: '{}', reason: 'Invalid input: expected array, received undefined' },
        ],
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        fatal: 'HTML validation failed: Test tool diagnostic',
        reports: [
            { output: '', reason: 'JSON Parse error: Unexpected EOF' },
            { output: '{ broken', reason: 'JSON Parse error' },
            { output: '{}', reason: 'Invalid input: expected array, received object' },
        ],
    },
    {
        name: 'selectors',
        check: 'site/purgecss',
        fatal: 'Unused CSS analysis failed: Test tool diagnostic',
        reports: [
            { output: '', reason: 'JSON Parse error: Unexpected EOF' },
            { output: '{ broken', reason: 'JSON Parse error' },
            { output: '{}', reason: 'Invalid input: expected array, received object' },
        ],
    },
] as const;
