// Planted repository for the static-site configuration: a small site with a build script, broken one way for each check.
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing } from '#tests/support/expectations.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { SVG, BUILD, STATIC_SITE_HEADERS } from '#tests/inputs/acceptance/source/kits/kits.ts';

const HOME = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>Planted</title>\n        <link rel="stylesheet" href="/site.css" />\n    </head>\n    <body>\n        <h1 class="title">Planted</h1>\n        <a href="/about.html">About</a>\n        <img src="/assets/logo.svg" alt="The logo" />\n    </body>\n</html>\n`;
const ABOUT = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>Planted</title>\n        <link rel="stylesheet" href="/site.css" />\n    </head>\n    <body>\n        <h1 class="title">About</h1>\n        <a href="/">Home</a>\n    </body>\n</html>\n`;

plantedCases(
    'the static-site configuration',
    {
        kits: ['static-site'],
        without: ['spelling', 'naming'],
        files: {
            '.gitignore': 'node_modules\ndist\n',
            'package.json':
                '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {"@types/node": "22.18.6"},\n    "scripts": {\n        "build": "bun build.js"\n    }\n}\n',
            'build.js': BUILD,
            'index.html': HOME,
            'about.html': ABOUT,
            'site.css': '.title {\n    color: #333;\n}\n',
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://planted.test/</loc></url>\n    <url><loc>https://planted.test/about.html</loc></url>\n</urlset>\n`,
            _headers: STATIC_SITE_HEADERS,
            'site.webmanifest': '{\n    "name": "Planted",\n    "icons": [{ "src": "/assets/logo.svg" }]\n}\n',
            'assets/logo.svg': SVG,
        },
    },
    [
        {
            check: 'static-site/build',
            files: { 'build.js': "throw new Error('the build is broken');\n" },
            expected: { file: '', rule: 'build', line: 1 },
        },
        {
            check: 'static-site/build-reproducible',
            files: { 'build.js': `${BUILD}await Bun.write('dist/stamp.txt', String(performance.now()));\n` },
            expected: { file: 'stamp.txt', rule: 'not-reproducible', line: 1 },
        },
        {
            check: 'static-site/html-validate-built',
            files: {
                'about.html': ABOUT.replace(
                    '        <a href="/">Home</a>\n',
                    '        <img src="/assets/logo.svg" />\n',
                ),
            },
            expected: { file: 'dist/about.html', rule: 'wcag/h37', line: 10 },
        },
        {
            check: 'css/dead-selectors',
            files: { 'site.css': '.title {\n    color: #333;\n}\n\n.never-used {\n    margin: 0;\n}\n' },
            expected: { file: 'dist/site.css', rule: 'dead-selector', line: 1 },
        },
        {
            check: 'static-site/links-internal',
            files: { 'about.html': ABOUT.replace('<a href="/">Home</a>', '<a href="/gone.html">Gone</a>') },
            expected: { file: 'about.html', rule: 'broken-link', line: 1 },
        },
        {
            check: 'static-site/size',
            files: {},
            policy: '[tools.site]\nsize_limits = [{paths = ["**/*.html"], kb = 0}]\n',
            expected: { file: '**/*.html', rule: 'size', line: 1 },
            corrected: { files: {}, policy: '[tools.site]\nsize_limits = [{paths = ["**/*.html"], kb = 10}]\n' },
        },
        {
            check: 'static-site/sitemap',
            files: {
                'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://planted.test/</loc></url>\n    <url><loc>https://planted.test/about.html</loc></url>\n    <url><loc>https://planted.test/pricing.html</loc></url>\n</urlset>\n`,
            },
            expected: { file: 'sitemap.xml', rule: 'missing-page', line: 1 },
        },
        {
            check: 'static-site/dead-assets',
            files: { 'assets/unused.png': 'png' },
            expected: { file: 'assets/unused.png', rule: 'dead-asset', line: 1 },
        },
        {
            check: 'static-site/svg-optimized',
            files: {
                'assets/logo.svg':
                    '<?xml version="1.0"?>\n<!-- Drawn in an editor. -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">\n    <path d="M 0.000 0.000 L 8.000 0.000 L 8.000 8.000 L 0.000 8.000 Z"/>\n</svg>\n',
            },
            expected: { file: 'assets/logo.svg', rule: 'svg', line: 1 },
        },
        {
            check: 'static-site/webmanifest',
            files: { 'site.webmanifest': '{\n    "icons": [{ "src": "/assets/gone.png" }]\n}\n' },
            expected: { file: 'site.webmanifest', rule: 'icon', line: 1 },
        },
        {
            check: 'integrity/security-headers',
            files: { _headers: '/*\n    Referrer-Policy: no-referrer\n' },
            expected: { file: '_headers', rule: 'missing-header', line: 1 },
        },
    ],
    (planted) => {
        test(
            'push checks the built site without selecting external links',
            async () => {
                const { root, environment } = planted();
                const checked = await run(
                    root,
                    ['check', '--stage', 'push', '--json'],
                    environment,
                    PLANTED_TIMEOUT_MS * 4,
                );
                expect(checked.code, checked.stdout + checked.stderr).toBe(0);
                const report = JSON.parse(checked.stdout) as RunReport;
                expect(report.checks.map(({ check }) => check)).not.toContain('static-site/links-external');
                expect(report.checks).toContainEqual(containing({ check: 'static-site/build', status: 'ok' }));
            },
            PLANTED_TIMEOUT_MS * 5,
        );
    },
);
