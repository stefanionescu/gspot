import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { applyChanges } from '#tests/setup/files.ts';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { DOCSTRING_MODULES } from '#tests/config/python/docstrings.ts';
import { PYPROJECT, PYDOCLINT_GOOGLE } from '#tests/config/python/project.ts';

import {
    PYTHON_CASES,
    PYTHON_SANDBOX,
    ARITHMETIC_MODULE,
    ARITHMETIC_MODULE_PATH,
} from '#tests/config/python/arithmetic.ts';

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);

test('init replaces your pyrightconfig.json with a pointer, and basedpyright reports the type error', async () => {
    const typed = `${ARITHMETIC_MODULE}

TOTAL: int = "three"
`;
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const restore = await applyChanges(root, {
        check: 'python/basedpyright',
        files: { [ARITHMETIC_MODULE_PATH]: typed },
    });
    state.defer(restore);
    // The pointer replaces the file; gspot.toml keeps none of the old settings.
    const pointer = await Bun.file(`${root}/pyrightconfig.json`).text();
    expect(pointer).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
    expect(pointer).not.toContain('basic');
    const settings = await Bun.file(`${root}/gspot.toml`).text();
    expect(settings).not.toContain('example/skipped.py');
    const command = ['check', '--only', 'python/basedpyright', '--json'];
    const refused = await spawnGspot(root, command, environment);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'failed'],
    ]);
    expect(report.checks[0]?.findings).toContainEqual(
        containing({
            file: ARITHMETIC_MODULE_PATH,
            rule: 'reportAssignmentType',
        }),
    );
    await Bun.write(
        `${root}/${ARITHMETIC_MODULE_PATH}`,
        `${ARITHMETIC_MODULE}

TOTAL: int = 3
`,
    );
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const accepted = JSON.parse(corrected.stdout) as RunReport;
    expect(accepted.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'passed'],
    ]);
});

test('pydoclint finds the docstring style of each file and does not ask for types again', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const files = Object.fromEntries(
        ['', 'app/'].flatMap((scope) => Object.entries(DOCSTRING_MODULES).map(([file, text]) => [scope + file, text])),
    );
    const restore = await applyChanges(root, {
        check: 'python/pydoclint',
        files: {
            'gspot.toml': settingsText(['python'], {
                level: 'all',
                tables: `[[scope]]
path = "app"

configurations = ["python"]
`,
            }),
            'pyproject.toml': PYPROJECT,
            'app/pyproject.toml': PYPROJECT,
            ...files,
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const prepared = await spawnGspot(root, ['apply']);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    const args = ['check', '--only', 'python/pydoclint', '--json'];
    const failed = await spawnGspot(root, args, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(report.checks.map((check) => [check.scope, check.status])).toStrictEqual([
        ['', 'failed'],
        ['app', 'failed'],
    ]);
    for (const file of Object.keys(files))
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(containing({ file, rule: 'DOC103' }));
    for (const [file, text] of Object.entries(files))
        await Bun.write(join(root, file), text.replace('amount', 'value'));
    const corrected = await spawnGspot(root, args, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        (JSON.parse(corrected.stdout) as RunReport).checks.map((check) => [check.scope, check.status, check.findings]),
    ).toStrictEqual([
        ['', 'passed', []],
        ['app', 'passed', []],
    ]);
});

test('pydoclint keeps your settings that ask for types in docstrings', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const project =
        PYPROJECT +
        '\n' +
        PYDOCLINT_GOOGLE +
        `arg-type-hints-in-docstring = true
check_return_types = true
check-yield-types = true
`;
    const restore = await applyChanges(root, {
        check: 'python/pydoclint',
        files: {
            'gspot.toml': settingsText(['python']),
            'pyproject.toml': project,
            'example/__init__.py': '',
            [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const prepared = await spawnGspot(root, ['apply']);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    const args = ['check', '--only', 'python/pydoclint', '--json'];
    const failed = await spawnGspot(root, args, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: ARITHMETIC_MODULE_PATH, rule: 'DOC105' }),
    );
    await Bun.write(
        join(root, ARITHMETIC_MODULE_PATH),
        ARITHMETIC_MODULE.replaceAll('value: The number.', 'value (int): The number.')
            .replace('Twice the number.', 'int: Twice the number.')
            .replace('Three times the number.', 'int: Three times the number.'),
    );
    const corrected = await spawnGspot(root, args, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(root, 'pyproject.toml')).text()).toBe(project);
});

for (const entry of PYTHON_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, PYTHON_SANDBOX);
    });
}
