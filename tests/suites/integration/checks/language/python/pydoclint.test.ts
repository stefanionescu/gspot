import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PYPROJECT, GOOGLE_PYPROJECT } from '#tests/config/python.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { PYTHON_SANDBOX, ARITHMETIC_MODULE_PATH } from '#tests/config/integration/checks/language/python/sandboxes.ts';

import {
    DOCSTRING_MODULES,
    PYDOCLINT_CHECK_ARGUMENTS,
} from '#tests/config/integration/checks/language/python/pydoclint.ts';

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);

test('pydoclint finds the docstring style of each file and does not ask for types again', async () => {
    const { root } = installedSandbox();
    const files = Object.fromEntries(
        ['', 'app/'].flatMap((scope) => Object.entries(DOCSTRING_MODULES).map(([file, text]) => [scope + file, text])),
    );
    await using _change = await applySandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['python'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: ['python'] }],
            }),
            'pyproject.toml': PYPROJECT,
            'app/pyproject.toml': PYPROJECT,
            ...files,
        },
    });
    const failed = parseCheckReport(await spawnGspot(root, PYDOCLINT_CHECK_ARGUMENTS));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual([
        ['', 'failed'],
        ['app', 'failed'],
    ]);
    expect(listFindingRows(failed.report)).toStrictEqual(
        ['', 'app/'].flatMap((scope) => [
            { file: `${scope}google.py`, line: 1, rule: 'DOC103' },
            { file: `${scope}numpy.py`, line: 5, rule: 'DOC103' },
        ]),
    );
    for (const [file, text] of Object.entries(files))
        await writeFile(join(root, file), text.replace('amount', 'value'));
    const corrected = parseCheckReport(await spawnGspot(root, PYDOCLINT_CHECK_ARGUMENTS));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map((check) => [check.scope, check.status, check.findings])).toStrictEqual([
        ['', 'passed', []],
        ['app', 'passed', []],
    ]);
});

test('pydoclint keeps the authored settings that ask for types in docstrings', async () => {
    const { root } = installedSandbox();
    const project =
        GOOGLE_PYPROJECT +
        `arg-type-hints-in-docstring = true
check_return_types = true
check-yield-types = true
`;
    await using _change = await applySandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['python']),
            'pyproject.toml': project,
            'example/__init__.py': '',
            [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
        },
    });
    const failed = parseCheckReport(await spawnGspot(root, PYDOCLINT_CHECK_ARGUMENTS));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual(
        [3, 15].flatMap((line) =>
            ['DOC109', 'DOC110', 'DOC105', 'DOC203'].map((rule) => ({ file: ARITHMETIC_MODULE_PATH, line, rule })),
        ),
    );
    await writeFile(
        join(root, ARITHMETIC_MODULE_PATH),
        ARITHMETIC_MODULE.replaceAll('value: The number.', 'value (int): The number.')
            .replace('Twice the number.', 'int: Twice the number.')
            .replace('Three times the number.', 'int: Three times the number.'),
    );
    const corrected = parseCheckReport(await spawnGspot(root, PYDOCLINT_CHECK_ARGUMENTS));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await readFile(join(root, 'pyproject.toml'), 'utf8')).toBe(project);
});
