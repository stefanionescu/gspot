// Planted repository for the static-site preset: a small site with a build script, broken one way for each check.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const INIT = [
    'init',
    '--yes',
    '--presets',
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
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n';
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

const CASES: PlantedCase[] = [
    {
        check: 'static-site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: 'did not build the site',
    },
    {
        check: 'static-site/build-reproducible',
        files: { 'build.js': `${BUILD}await Bun.write('dist/stamp.txt', String(performance.now()));\n` },
        expected: 'Two builds of the same tree wrote this file differently',
    },
    {
        check: 'static-site/html-validate-built',
        files: { 'about.html': page('        <h1 class="title">About</h1>\n        <img src="/assets/logo.svg" />\n') },
        expected: 'wcag/h37',
    },
    {
        check: 'css/dead-selectors',
        files: { 'site.css': '.title {\n    color: #333;\n}\n\n.never-used {\n    margin: 0;\n}\n' },
        expected: 'No built page uses the selector .never-used',
    },
    {
        check: 'static-site/links-internal',
        files: { 'about.html': page('        <h1 class="title">About</h1>\n        <a href="/gone.html">Gone</a>\n') },
        expected: 'gone.html answers 404',
    },
    {
        check: 'static-site/size',
        files: {},
        policy: '[tools.site]\nsize_limits = [{paths = ["**/*.html"], kb = 0}]\n',
        expected: 'kB compressed is over the ceiling of 0 kB',
    },
    {
        check: 'static-site/sitemap',
        files: { 'sitemap.xml': SITEMAP('    <url><loc>https://planted.test/pricing.html</loc></url>\n') },
        expected: 'the build wrote no such page',
    },
    {
        check: 'static-site/dead-assets',
        files: { 'assets/unused.png': 'png' },
        expected: 'No page, stylesheet or script names this file',
    },
    {
        check: 'static-site/svg-optimized',
        files: {
            'assets/logo.svg':
                '<?xml version="1.0"?>\n<!-- Drawn in an editor. -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">\n    <path d="M 0.000 0.000 L 8.000 0.000 L 8.000 8.000 L 0.000 8.000 Z"/>\n</svg>\n',
        },
        expected: 'bytes smaller',
    },
    {
        check: 'static-site/webmanifest',
        files: { 'site.webmanifest': '{\n    "icons": [{ "src": "/assets/gone.png" }]\n}\n' },
        expected: 'The icon /assets/gone.png does not exist',
    },
    {
        check: 'integrity/security-headers',
        files: { _headers: '/*\n    Referrer-Policy: no-referrer\n' },
        expected: 'sets no valid x-content-type-options header',
    },
];

describe('the static-site preset', () => {
    test(
        'every check passes on a clean site and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, FILES);
            commitAll(sandbox.path);
            const environment = {
                PATH: toolsPath(['typos', 'ec', 'ast-grep']),
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const checked = await run(sandbox.path, ['check', '--stage', 'push', '--json'], environment);
            const atPush = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atPush.checks.map((check) => check.check)).not.toContain('static-site/links-external');
        },
        PLANTED_TIMEOUT_MS * 10,
    );
});
