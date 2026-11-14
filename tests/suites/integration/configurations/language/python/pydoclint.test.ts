import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/python.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { PYPROJECT, GOOGLE_PYPROJECT } from '#tests/config/setup/languages.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

const PYDOCLINT_CHECK_ARGUMENTS = ['check', '--only', 'python/pydoclint', '--json'] as const;

const DOCSTRING_MODULES = {
    'google.py': `def double(value: int) -> int:
    """Double a number.

    Args:
        amount: The number.

    Returns:
        Twice the number.
    """
    return value * 2
`,
    'numpy.py': `EXAMPLE = """
Args:
"""

def double(value: int) -> int:
    """Double a number.

    Parameters
    ----------
    amount
        The number.

    Returns
    -------
    The doubled number.
    """
    return value * 2
`,
} as const;

const ARITHMETIC_MODULE_PATH = 'example/math.py';

const PYTHON_SANDBOX = {
    configurations: ['python'],
    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
    },
} as const;

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);

test('pydoclint finds the docstring style of each file and does not ask for types again', async () => {
    const { root } = installedSandbox();
    const files = Object.fromEntries(
        ['', 'app/'].flatMap((scope) => Object.entries(DOCSTRING_MODULES).map(([file, text]) => [scope + file, text])),
    );
    await using _change = await writeSandboxChanges(installedSandbox(), {
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
    const project = `${GOOGLE_PYPROJECT}arg-type-hints-in-docstring = true
check_return_types = true
check-yield-types = true
`;
    await using _change = await writeSandboxChanges(installedSandbox(), {
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
});
