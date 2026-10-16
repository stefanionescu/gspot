import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { spawnGspot, spawnCheckReport } from '#tests/setup/run-gspot.ts';
import { DOCSTRING_MODULES } from '#tests/data/checks/python/docstrings.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { updateSandbox, applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { PYPROJECT, PYDOCLINT_GOOGLE, PYDOCLINT_CHECK_ARGUMENTS } from '#tests/data/checks/python/project.ts';

import {
    PYTHON_CASES,
    PYTHON_SANDBOX,
    ARITHMETIC_MODULE,
    ARITHMETIC_MODULE_PATH,
} from '#tests/data/checks/python/tool-checks.ts';

const installedSandbox = registerSharedSandbox(PYTHON_SANDBOX);

test('init replaces your pyrightconfig.json with a pointer, and basedpyright reports the type error', async () => {
    const typed = `${ARITHMETIC_MODULE}

TOTAL: int = "three"
`;
    const { root, environment } = installedSandbox();
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'python/basedpyright',
            files: { [ARITHMETIC_MODULE_PATH]: typed },
        },
    );
    // The pointer replaces the file; gspot.toml keeps none of the old settings.
    const pointer = await Bun.file(`${root}/pyrightconfig.json`).text();
    expect(pointer).toContain('"extends": "./.gspot/config/basedpyrightconfig.json"');
    expect(pointer).not.toContain('basic');
    const settings = await Bun.file(`${root}/gspot.toml`).text();
    expect(settings).not.toContain('example/skipped.py');
    const command = ['check', '--only', 'python/basedpyright', '--json'];
    const refused = await spawnCheckReport(root, command, environment);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'failed'],
    ]);
    expect(report.checks[0]?.findings).toContainEqual(
        matchFields({
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
    const corrected = await spawnCheckReport(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const accepted = corrected.report;
    expect(accepted.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'passed'],
    ]);
});

test('pydoclint finds the docstring style of each file and does not ask for types again', async () => {
    const { root, environment } = installedSandbox();
    const files = Object.fromEntries(
        ['', 'app/'].flatMap((scope) => Object.entries(DOCSTRING_MODULES).map(([file, text]) => [scope + file, text])),
    );
    await using _change = await applySandboxChanges(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'python/pydoclint',
            files: {
                'gspot.toml': buildSettingsText(['python'], {
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
        },
    );
    const failed = await spawnCheckReport(root, PYDOCLINT_CHECK_ARGUMENTS, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(report.checks.map((check) => [check.scope, check.status])).toStrictEqual([
        ['', 'failed'],
        ['app', 'failed'],
    ]);
    for (const file of Object.keys(files))
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(matchFields({ file, rule: 'DOC103' }));
    for (const [file, text] of Object.entries(files))
        await Bun.write(join(root, file), text.replace('amount', 'value'));
    const corrected = await spawnCheckReport(root, PYDOCLINT_CHECK_ARGUMENTS, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map((check) => [check.scope, check.status, check.findings])).toStrictEqual([
        ['', 'passed', []],
        ['app', 'passed', []],
    ]);
});

test('pydoclint keeps your settings that ask for types in docstrings', async () => {
    const { root, environment } = installedSandbox();
    const project =
        PYPROJECT +
        '\n' +
        PYDOCLINT_GOOGLE +
        `arg-type-hints-in-docstring = true
check_return_types = true
check-yield-types = true
`;
    await using _change = await applySandboxChanges(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'python/pydoclint',
            files: {
                'gspot.toml': buildSettingsText(['python']),
                'pyproject.toml': project,
                'example/__init__.py': '',
                [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
            },
        },
    );
    const failed = await spawnCheckReport(root, PYDOCLINT_CHECK_ARGUMENTS, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks[0]!.findings).toContainEqual(
        matchFields({ file: ARITHMETIC_MODULE_PATH, rule: 'DOC105' }),
    );
    await Bun.write(
        join(root, ARITHMETIC_MODULE_PATH),
        ARITHMETIC_MODULE.replaceAll('value: The number.', 'value (int): The number.')
            .replace('Twice the number.', 'int: Twice the number.')
            .replace('Three times the number.', 'int: Three times the number.'),
    );
    const corrected = await spawnCheckReport(root, PYDOCLINT_CHECK_ARGUMENTS, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(join(root, 'pyproject.toml')).text()).toBe(project);
});

for (const entry of PYTHON_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        const result = await runCheckSample(installedSandbox(), entry, PYTHON_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}
