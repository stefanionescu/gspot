import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    STYLESHEETS,
    TAILWIND_FILES,
    FIXED_STYLESHEETS,
    STYLELINT_COMMAND,
    TAILWIND_SETTINGS,
    STYLELINT_SETTINGS,
    ALL_LEVEL_STYLELINT_SETTINGS,
} from '#tests/data/checks/css.ts';

const installedSandbox = registerSharedSandbox({
    configurations: ['css'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n', ...STYLESHEETS },
});

/**
 * Apply the settings in the shared sandbox, then run Stylelint, which must fail.
 *
 * @param sandboxRoot the folder of the shared sandbox.
 * @returns the report of the failed run.
 */
async function runStylelintAfterApply(sandboxRoot: string): Promise<RunReport> {
    const applied = await spawnGspot(sandboxRoot, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failed = await spawnGspot(sandboxRoot, [...STYLELINT_COMMAND]);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    return JSON.parse(failed.stdout) as RunReport;
}

test.each([...LEVELS])(
    "Stylelint at level %s applies each scope's lint rule options and no other lint rules",
    async (level) => {
        const root = installedSandbox().root;
        await using _change = await updateSandbox(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSettingsText(['css'], {
                    level,
                    tables: level === 'all' ? ALL_LEVEL_STYLELINT_SETTINGS : STYLELINT_SETTINGS,
                }),
                'package.json': '{"private":true}\n',
                ...STYLESHEETS,
            },
        });
        const failedReport = await runStylelintAfterApply(root);
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
        await createFileTree(root, FIXED_STYLESHEETS);
        const corrected = await spawnGspot(root, [...STYLELINT_COMMAND]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const correctedReport = JSON.parse(corrected.stdout) as RunReport;
        expect(correctedReport.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'passed', findings: [] },
            { check: 'css/stylelint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
);

test("Stylelint run by an editor finds the scope's tool file and checks your build folder", async () => {
    const root = installedSandbox().root;
    await using _change = await updateSandbox(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText(['css'], { level: 'all', tables: ALL_LEVEL_STYLELINT_SETTINGS }),
            'package.json': '{"private":true}\n',
            ...STYLESHEETS,
        },
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const tool = join(root, '.gspot/node_modules/.bin/stylelint');
    const failed = await runCommand([tool, 'build/site.css'], { cwd: root });
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    expect(failed.stdout + failed.stderr).toContain('property-no-vendor-prefix');
    await createFileTree(root, FIXED_STYLESHEETS);
    for (const folder of ['', 'app']) {
        const native = await runCommand([tool, folder === '' ? 'build/site.css' : 'site.css'], {
            cwd: join(root, folder),
        });
        expect(native.code, native.stdout + native.stderr).toBe(0);
    }
});

test('Stylelint accepts Tailwind syntax only in the scope that declares Tailwind', async () => {
    const root = installedSandbox().root;
    await using _change = await updateSandbox(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText(['css', 'nextjs'], { level: 'all', tables: TAILWIND_SETTINGS }),
            ...TAILWIND_FILES,
        },
    });
    const report = await runStylelintAfterApply(root);
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
    await Bun.write(join(root, 'app/site.css'), 'a { color: #ggg; }\n');
    const invalidValue = await spawnGspot(root, ['check', 'app', '--only', 'css/stylelint', '--json']);
    expect(invalidValue.code, invalidValue.stdout + invalidValue.stderr).toBe(1);
    expect((JSON.parse(invalidValue.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual(
        matchItems([matchFields({ file: 'app/site.css', rule: 'declaration-property-value-no-unknown', line: 1 })]),
    );
    await Bun.write(join(root, 'app/site.css'), TAILWIND_FILES['app/site.css']);
    await Bun.write(join(root, 'build/site.css'), 'a { color: red; }\n');
    await Bun.write(join(root, 'other/site.css'), 'a { color: red; }\n');
    const corrected = await spawnGspot(root, [...STYLELINT_COMMAND]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { scope: '', status: 'passed', findings: [] },
        { scope: 'app', status: 'passed', findings: [] },
        { scope: 'other', status: 'passed', findings: [] },
    ]);
});
