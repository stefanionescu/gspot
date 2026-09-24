import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the html configuration: an image with no text alternative, an inline handler, and copy written into a template.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--configurations',
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
        expected: 'Move executable inline script to a script file.',
    },
    {
        check: 'html/copy',
        files: { 'pages/home.html': page('        <h1>Welcome to the shop</h1>\n') },
        policy: TEMPLATES,
        expected: 'belongs in the content file',
    },
];

describe('the html configuration', () => {
    test(
        'every html check fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n',
                'pages/home.html': CLEAN,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
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
