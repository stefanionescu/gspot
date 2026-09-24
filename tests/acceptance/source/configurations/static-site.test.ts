import { join } from 'node:path';
import { reportSchema } from '#cli/output/schema.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the static-site configuration: a small site with a build script, broken one way for each check.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'static-site',
    '--without',
    'spelling',
    'naming',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const page = (body: string): string =>
    `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>Planted</title>\n        <link rel="stylesheet" href="/site.css" />\n    </head>\n    <body>\n${body}    </body>\n</html>\n`;
const HOME = page(
    '        <h1 class="title">Planted</h1>\n        <a href="/about.html">About</a>\n        <img src="/assets/logo.svg" alt="The logo" />\n',
);
const ABOUT = page('        <h1 class="title">About</h1>\n        <a href="/">Home</a>\n');
const BUILD =
    "// Copies the pages, the stylesheet, the sitemap and the assets into dist.\nimport { cpSync, mkdirSync, rmSync } from 'node:fs';\n\nrmSync('dist', { recursive: true, force: true });\nmkdirSync('dist', { recursive: true });\nfor (const name of ['index.html', 'about.html', 'site.css', 'sitemap.xml']) cpSync(name, `dist/${name}`);\ncpSync('assets', 'dist/assets', { recursive: true });\n";
const SITEMAP = (extra: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://planted.test/</loc></url>\n    <url><loc>https://planted.test/about.html</loc></url>\n${extra}</urlset>\n`;
const HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: strict-origin-when-cross-origin\n    X-Frame-Options: DENY\n';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
const FILES = {
    '.gitignore': 'node_modules\ndist\n',
    'package.json':
        '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "scripts": {\n        "build": "bun build.js"\n    }\n}\n',
    'build.js': BUILD,
    'index.html': HOME,
    'about.html': ABOUT,
    'site.css': '.title {\n    color: #333;\n}\n',
    'sitemap.xml': SITEMAP(''),
    _headers: HEADERS,
    'site.webmanifest': '{\n    "name": "Planted",\n    "icons": [{ "src": "/assets/logo.svg" }]\n}\n',
    'assets/logo.svg': SVG,
};

const CASES: FindingCase[] = [
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
        files: { 'about.html': page('        <h1 class="title">About</h1>\n        <img src="/assets/logo.svg" />\n') },
        expected: { file: 'dist/about.html', rule: 'wcag/h37', line: 11 },
    },
    {
        check: 'css/dead-selectors',
        files: { 'site.css': '.title {\n    color: #333;\n}\n\n.never-used {\n    margin: 0;\n}\n' },
        expected: { file: 'dist/site.css', rule: 'dead-selector', line: 1 },
    },
    {
        check: 'static-site/links-internal',
        files: { 'about.html': page('        <h1 class="title">About</h1>\n        <a href="/gone.html">Gone</a>\n') },
        expected: { file: './about.html', rule: 'broken-link', line: 1 },
    },
    {
        check: 'static-site/size',
        files: {},
        policy: '[tools.site]\nsize_limits = [{paths = ["**/*.html"], kb = 0}]\n',
        expected: { file: '**/*.html', rule: 'size', line: 1 },
    },
    {
        check: 'static-site/sitemap',
        files: { 'sitemap.xml': SITEMAP('    <url><loc>https://planted.test/pricing.html</loc></url>\n') },
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
];

describe('the static-site configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, FILES);
            commitAll(sandbox.path);
            const environment = {
                PATH: toolsPath(['typos', 'ec', 'ast-grep']),
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                const report = reportSchema.parse(
                    await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
                );
                expect(report.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
                expect(report.checks[0]?.findings).toContainEqual(
                    expect.objectContaining({ check: planted.check, ...planted.expected }),
                );
                const corrected =
                    planted.check === 'static-site/size'
                        ? await runPlanted(
                              sandbox.path,
                              {
                                  ...planted,
                                  files: {},
                                  policy: '[tools.site]\nsize_limits = [{paths = ["**/*.html"], kb = 10}]\n',
                              },
                              environment,
                          )
                        : await run(
                              sandbox.path,
                              ['check', '--only', planted.check, '--no-cache', '--json'],
                              environment,
                          );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(
                    reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json()).checks,
                ).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
            }
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});

test(
    'push checks the built site without selecting external links',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, FILES);
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['typos', 'ec', 'ast-grep']) };
        await install(sandbox.path, INIT, environment);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const checked = await run(sandbox.path, ['check', '--stage', 'push', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = reportSchema.parse(JSON.parse(checked.stdout));
        expect(report.checks.map(({ check }) => check)).not.toContain('static-site/links-external');
        expect(report.checks).toContainEqual(expect.objectContaining({ check: 'static-site/build', status: 'ok' }));
    },
    PLANTED_TIMEOUT_MS * 3,
);
