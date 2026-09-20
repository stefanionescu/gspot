import { symlinkSync } from 'node:fs';
// Planted repository for the html preset: an image with no text alternative, an inline handler, and copy written into a template.
import { delimiter, join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'html',
    '--without',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const page = (body: string): string =>
    `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n${body}    </body>\n</html>\n`;
const CLEAN = page(
    '        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" alt="{{ logo_alt }}" />\n        <script type="application/ld+json">{"@type": "Thing"}</script>\n        <script src="/app.js"></script>\n',
);
const TEMPLATES = '[tools.html]\ntemplate_files = ["pages/**/*.html"]\n';

const CASES: PlantedCase[] = [
    {
        check: 'html/html-validate',
        files: { 'pages/home.html': page('        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" />\n') },
        expected: 'wcag/h37',
    },
    {
        check: 'html/scripts',
        files: { 'pages/home.html': page('        <button type="button" onclick="go()">{{ label }}</button>\n') },
        expected: 'The onclick attribute is inline script',
    },
    {
        check: 'html/scripts',
        files: { 'pages/home.html': page('        <script>window.go = 1;</script>\n') },
        expected: 'An inline script runs only under a policy',
    },
    {
        check: 'html/copy',
        files: { 'pages/home.html': page('        <h1>Welcome to the shop</h1>\n') },
        policy: TEMPLATES,
        expected: 'belongs in the content file',
    },
];

describe('the html preset', () => {
    test(
        'every html check fires on its planted defect',
        async () => {
            await using sandbox = await createSandbox({
                '.gitignore': 'node_modules\n',
                'package.json': '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n',
                'pages/home.html': CLEAN,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await install(sandbox.path, INIT, environment);
            for (const planted of CASES) {
                const clean = await runPlanted(sandbox.path, { ...planted, files: {} }, environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
