import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    STYLESHEETS,
    TAILWIND_FILES,
    TAILWIND_TABLES,
    STYLELINT_TABLES,
    STYLELINT_COMMAND,
    CORRECTED_STYLESHEETS,
    ALL_LEVEL_STYLELINT_TABLES,
} from '#tests/config/integration/checks/language/css.ts';

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
        expect(failed.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'failed' },
            { scope: 'app', status: 'failed' },
        ]);
        const rows = [
            { line: 2, rule: 'color-hex-length' },
            ...(level === 'all' ? [{ line: 3, rule: 'number-max-precision' }] : []),
            { line: 4, rule: 'property-no-vendor-prefix' },
        ];
        expect(listFindingRows(failed.report)).toStrictEqual(
            ['build/site.css', 'app/site.css'].flatMap((file) => rows.map((row) => ({ file, ...row }))),
        );
        await createFileTree(root, CORRECTED_STYLESHEETS);
        const corrected = parseCheckReport(await spawnGspot(root, [...STYLELINT_COMMAND]));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'css/stylelint', scope: '', status: 'passed', findings: [] },
            { check: 'css/stylelint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
);

test("Stylelint run by an editor finds the scope's config file and checks your build folder", async () => {
    const root = installedSandbox().root;
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['css'], { level: 'all', tables: ALL_LEVEL_STYLELINT_TABLES }),
            'package.json': '{"private":true}\n',
            ...STYLESHEETS,
        },
    });

    const tool = join(root, `${GSPOT_PATHS.nodeModules}/.bin/stylelint`);
    const failed = await runCommand([tool, '--formatter', 'json', 'build/site.css'], { cwd: root });
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    const [result] = JSON.parse(failed.stderr) as { warnings: { rule: string; line: number }[] }[];
    expect(result!.warnings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([
        { rule: 'color-hex-length', line: 2 },
        { rule: 'number-max-precision', line: 3 },
        { rule: 'property-no-vendor-prefix', line: 4 },
    ]);
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
    expect(failed.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'failed' },
        { scope: 'app', status: 'passed' },
        { scope: 'other', status: 'failed' },
    ]);
    expect(listFindingRows(failed.report)).toStrictEqual(
        ['build/site.css', 'other/site.css'].flatMap((file) => [
            { file, line: 1, rule: 'at-rule-no-unknown' },
            { file, line: 4, rule: 'declaration-property-value-no-unknown' },
            { file, line: 4, rule: 'function-no-unknown' },
        ]),
    );
    await writeFile(join(root, 'app/site.css'), 'a { color: #ggg; }\n');
    const invalidValue = parseCheckReport(
        await spawnGspot(root, ['check', 'app', '--only', 'css/stylelint', '--json']),
    );
    expect(invalidValue.code, invalidValue.stdout + invalidValue.stderr).toBe(1);
    expect(listFindingRows(invalidValue.report)).toStrictEqual([
        { file: 'app/site.css', line: 1, rule: 'declaration-property-value-no-unknown' },
    ]);
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
