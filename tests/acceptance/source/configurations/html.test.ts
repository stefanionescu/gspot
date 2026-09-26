import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the html configuration: an image with no text alternative, an inline handler, and copy written into a template.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { HTML_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { TEMPLATES } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const page = (body: string): string =>
    `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n${body}    </body>\n</html>\n`;
const CLEAN = page(
    '        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" alt="{{ logo_alt }}" />\n        <script type="application/ld+json">{"@type": "Thing"}</script>\n        <script src="/app.js"></script>\n',
);
const CASES: FindingCase[] = [
    {
        check: 'html/html-validate',
        files: { 'pages/home.html': page('        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" />\n') },
        expected: { file: 'pages/home.html', rule: 'wcag/h37', line: 9 },
    },
    {
        check: 'html/scripts',
        files: { 'pages/home.html': page('        <button type="button" onclick="go()">{{ label }}</button>\n') },
        expected: { file: 'pages/home.html', rule: 'handler-attribute', line: 8 },
    },
    {
        check: 'html/scripts',
        files: { 'pages/home.html': page('        <script>window.go = 1;</script>\n') },
        expected: { file: 'pages/home.html', rule: 'inline-script', line: 8 },
    },
    {
        check: 'html/copy',
        files: { 'pages/home.html': page('        <h1>Welcome to the shop</h1>\n') },
        policy: TEMPLATES,
        expected: { file: 'pages/home.html', rule: 'literal-text', line: 8 },
    },
];

describe('the html configuration', () => {
    test.each(CASES)(
        '$check rejects $expected.rule and accepts corrected markup',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n',
                'pages/home.html': CLEAN,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec'])}` };
            await installAtLevel(sandbox.path, HTML_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failedReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failedReport.checks[0]?.findings).toContainEqual(
                containing({ check: planted.check, ...planted.expected }),
            );
            const corrected = await runPlanted(sandbox.path, { ...planted, files: {} }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(
                reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json()).checks,
            ).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
