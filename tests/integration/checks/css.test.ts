import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    STYLESHEETS,
    TAILWIND_FILES,
    TAILWIND_TABLES,
    STYLELINT_TABLES,
    STYLELINT_COMMAND,
    CORRECTED_STYLESHEETS,
    ALL_LEVEL_STYLELINT_TABLES,
} from '#tests/data/checks/css.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['css'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n', ...STYLESHEETS },
});

test.each([...LEVELS])(
    "Stylelint at level %s applies each scope's lint rule options and no other lint rules",
    async (level) => {
        const root = installedSandbox().root;
        await using _change = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSandboxSettings(['css'], {
                    level,
                    tables: level === 'all' ? ALL_LEVEL_STYLELINT_TABLES : STYLELINT_TABLES,
                }),
                'package.json': '{"private":true}\n',
                ...STYLESHEETS,
            },
        });
        const failed = parseCheckReport(await spawnGspot(root, [...STYLELINT_COMMAND]));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const failedReport = failed.report;
        expect(failedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'failed' },
            { check: 'css/stylelint', scope: 'app', status: 'failed' },
        ]);
        const findings = failedReport.checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(
            matchItems([
                matchFields({ file: 'build/site.css', rule: 'color-hex-length', line: 2 }),
                matchFields({ file: 'app/site.css', rule: 'color-hex-length', line: 2 }),
                matchFields({ file: 'build/site.css', rule: 'property-no-vendor-prefix', line: 4 }),
                matchFields({ file: 'app/site.css', rule: 'property-no-vendor-prefix', line: 4 }),
            ]),
        );
        expect(findings.filter(({ rule }) => rule === 'number-max-precision').map(({ file }) => file)).toStrictEqual(
            level === 'all' ? ['build/site.css', 'app/site.css'] : [],
        );
        await createFileTree(root, CORRECTED_STYLESHEETS);
        const corrected = parseCheckReport(await spawnGspot(root, [...STYLELINT_COMMAND]));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const correctedReport = corrected.report;
        expect(correctedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'passed', findings: [] },
            { check: 'css/stylelint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
);

test("Stylelint run by an editor finds the scope's tool file and checks your build folder", async () => {
    const root = installedSandbox().root;
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['css'], { level: 'all', tables: ALL_LEVEL_STYLELINT_TABLES }),
            'package.json': '{"private":true}\n',
            ...STYLESHEETS,
        },
    });

    const tool = join(root, '.gspot/node_modules/.bin/stylelint');
    const failed = await runCommand([tool, 'build/site.css'], { cwd: root });
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    expect(failed.stdout + failed.stderr).toContain('property-no-vendor-prefix');
    await createFileTree(root, CORRECTED_STYLESHEETS);
    for (const folder of ['', 'app']) {
        const native = await runCommand([tool, folder === '' ? 'build/site.css' : 'site.css'], {
            cwd: join(root, folder),
        });
        expect(native.code, native.stdout + native.stderr).toBe(0);
    }
});

test('Stylelint accepts Tailwind syntax only in the scope that declares Tailwind', async () => {
    const root = installedSandbox().root;
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['css', 'nextjs'], { level: 'all', tables: TAILWIND_TABLES }),
            ...TAILWIND_FILES,
        },
    });
    const failed = parseCheckReport(await spawnGspot(root, [...STYLELINT_COMMAND]));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(report.checks.find((check) => check.scope === 'app')).toMatchObject({
        status: 'passed',
        findings: [],
    });
    expect(report.checks.flatMap((check) => check.findings)).toStrictEqual(
        matchItems([
            matchFields({ file: 'build/site.css', rule: 'at-rule-no-unknown', line: 1 }),
            matchFields({ file: 'other/site.css', rule: 'at-rule-no-unknown', line: 1 }),
            matchFields({ file: 'build/site.css', rule: 'function-no-unknown', line: 4 }),
            matchFields({ file: 'other/site.css', rule: 'function-no-unknown', line: 4 }),
        ]),
    );
    await writeFile(join(root, 'app/site.css'), 'a { color: #ggg; }\n');
    const invalidValue = parseCheckReport(
        await spawnGspot(root, ['check', 'app', '--only', 'css/stylelint', '--json']),
    );
    expect(invalidValue.code, invalidValue.stdout + invalidValue.stderr).toBe(1);
    expect(invalidValue.report.checks.flatMap((check) => check.findings)).toStrictEqual(
        matchItems([matchFields({ file: 'app/site.css', rule: 'declaration-property-value-no-unknown', line: 1 })]),
    );
    await writeFile(join(root, 'app/site.css'), TAILWIND_FILES['app/site.css']);
    await writeFile(join(root, 'build/site.css'), 'a { color: red; }\n');
    await writeFile(join(root, 'other/site.css'), 'a { color: red; }\n');
    const corrected = parseCheckReport(await spawnGspot(root, [...STYLELINT_COMMAND]));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { scope: '', status: 'passed', findings: [] },
        { scope: 'app', status: 'passed', findings: [] },
        { scope: 'other', status: 'passed', findings: [] },
    ]);
});
