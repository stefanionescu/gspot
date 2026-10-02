// Planted repository for the static-site configuration: a small site with a build script, broken one way for each check.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { install } from '#tests/harness/tools/install.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

const BUILD =
    "// Copies the pages, the stylesheet, the sitemap and the assets into dist.\nimport { cpSync, rmSync, mkdirSync } from 'node:fs';\n\nrmSync('dist', { recursive: true, force: true });\nmkdirSync('dist', { recursive: true });\nfor (const name of ['index.html', 'about.html', 'site.css', 'sitemap.xml']) cpSync(name, `dist/${name}`);\ncpSync('assets', 'dist/assets', { recursive: true });\n";

const STATIC_SITE_HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: strict-origin-when-cross-origin\n    X-Frame-Options: DENY\n';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';

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
            check: 'static-site/size',
            files: {},
            policy: '[tools.site]\nsizes = [{paths = ["**/*.html"], kb = 0}]\n',
            expected: { file: '**/*.html', rule: 'size', line: 1 },
            corrected: { files: {}, policy: '[tools.site]\nsizes = [{paths = ["**/*.html"], kb = 10}]\n' },
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
                const checked = await spawnGspot(
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

const COMMAND = ['check', '--only', 'static-site/svg-optimized', '--json'];

// Recommended savings thresholds and strict optimization both accept corrected bytes.
async function expectSvgThresholds(root: string, svg: string): Promise<void> {
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const small = await spawnGspot(root, COMMAND);
    expect(small.code, small.stdout + small.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const large = await spawnGspot(root, COMMAND);
    expect(large.code, large.stdout + large.stderr).toBe(1);
    expect((JSON.parse(large.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({ file: 'icon.svg', rule: 'svg' }),
    ]);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const strict = await spawnGspot(root, COMMAND);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    await Bun.write(join(root, 'icon.svg'), svg);
    const corrected = await spawnGspot(root, COMMAND);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'static-site/svg-optimized', status: 'ok', files: 1, findings: [] },
    ]);
}

// Explicit file selection excludes malformed neighbors, which fail when selected.
async function expectSvgSelection(root: string, svg: string): Promise<void> {
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg);
    await Bun.write(join(root, 'other.svg'), '<svg><broken>');
    // A path goes before --only, which takes every word up to the next command option.
    const selected = await spawnGspot(root, ['check', 'icon.svg', ...COMMAND.slice(1)]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const malformed = await spawnGspot(root, COMMAND);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks[0]!.status).toBe('error');
    await Bun.write(join(root, 'other.svg'), svg);
    const repaired = await spawnGspot(root, COMMAND);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect((JSON.parse(repaired.stdout) as RunReport).checks).toMatchObject([
        { check: 'static-site/svg-optimized', status: 'ok', files: 2, findings: [] },
    ]);
}

test.each([
    { scenario: 'enforces level thresholds', verify: expectSvgThresholds },
    { scenario: 'checks exact file inputs', verify: expectSvgSelection },
])(
    'native SVG optimization $scenario',
    async ({ verify }) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n',
        });
        await install(root, initArgs(['static-site']), {}, ['spelling', 'naming']);
        const native = await processes.run(
            [join(root, '.gspot/node_modules/.bin/svgo'), '--input', 'icon.svg', '--output', '-'],
            { cwd: root },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        await verify(root, native.stdout);
    },
    PLANTED_TIMEOUT_MS * 3,
);
