import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the Python structure checks: one module shaped wrong for each check.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';

import {
    STRUCTURE_CLEAN,
    STRUCTURE_INIT,
    STRUCTURE_PROJECT,
} from '#tests/constants/acceptance/source/configurations/python.ts';

const module = (body: string): string => `"""A planted module."""\n\n\n${body}`;
const LONG_BODY = Array.from({ length: 61 }, (_, index) => `    step_${String(index)} = ${String(index)}`).join('\n');
const LONG_FILE = Array.from({ length: 301 }, (_, index) => `VALUE_${String(index)} = ${String(index)}`).join('\n');

const CASES: FindingCase[] = [
    {
        check: 'python/file-length',
        files: { 'planted/big.py': module(`${LONG_FILE}\n`) },
        expected: { file: 'planted/big.py', rule: 'file-lines', line: 1 },
    },
    {
        check: 'python/function-length',
        files: { 'planted/long.py': module(`def long_one() -> None:\n    """Hold many steps."""\n${LONG_BODY}\n`) },
        expected: { file: 'planted/long.py', rule: 'function-lines', line: 4 },
    },
    {
        check: 'python/trivial-function',
        files: {
            'planted/tiny.py': module(
                'def tiny(value: int) -> int:\n    """Add one to a number."""\n    return value + 1\n\n\ndef caller() -> int:\n    """Call the tiny one, then do more."""\n    first = tiny(1)\n    second = first * 2\n    return second - 1\n',
            ),
        },
        expected: { file: 'planted/tiny.py', rule: 'trivial-function', line: 4 },
    },
    {
        check: 'python/trivial-function',
        files: {
            'planted/forward.py': module(
                'def forward(left: int, right: int) -> int:\n    """Forward to the builtin."""\n    return max(left, right)\n',
            ),
        },
        expected: { file: 'planted/forward.py', rule: 'trivial-function', line: 4 },
    },
    {
        check: 'python/placeholder-docstring',
        files: {
            'planted/empty.py': module(
                'def load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n',
            ),
        },
        expected: { file: 'planted/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
    {
        check: 'python/private-prefix',
        files: {
            'planted/leaky.py': module(
                'def shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n',
            ),
        },
        expected: { file: 'planted/leaky.py', rule: 'private-prefix', line: 9 },
    },
    {
        check: 'python/private-before-public',
        files: {
            'planted/order.py': module(
                'def shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n',
            ),
        },
        expected: { file: 'planted/order.py', rule: 'private-before-public', line: 9 },
    },
    {
        check: 'python/exports-at-bottom',
        files: {
            'planted/top.py': module(
                '__all__ = ["shown"]\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n',
            ),
        },
        expected: { file: 'planted/top.py', rule: 'exports-at-bottom', line: 4 },
    },
    {
        check: 'python/no-lazy-exports',
        files: {
            'planted/lazy.py': module(
                'def __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n',
            ),
        },
        expected: { file: 'planted/lazy.py', rule: 'no-lazy-exports', line: 4 },
    },
    {
        check: 'python/package-exports',
        files: { 'planted/__init__.py': module('__all__ = ["a", "b", "c"]\n') },
        policy: '[structure.python]\nmax_package_exports = 2\n',
        expected: { file: 'planted/__init__.py', rule: 'package-exports', line: 4 },
    },
    {
        check: 'python/import-cycles',
        files: {
            'planted/left.py': module('from planted import right\n\nVALUE = right\n'),
            'planted/right.py': module('from planted import left\n\nVALUE = left\n'),
        },
        expected: { file: 'planted/left.py', rule: 'import-cycle', line: 1 },
    },
    {
        check: 'python/no-singletons',
        files: { 'planted/shared.py': module('class Store:\n    """Holds things."""\n\n\nstore = Store()\n') },
        expected: { file: 'planted/shared.py', rule: 'no-singletons', line: 8 },
    },
];

describe('the Python structure checks', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts corrected modules',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': STRUCTURE_PROJECT,
                'planted/__init__.py': '"""The planted package."""\n',
                'planted/prices.py': STRUCTURE_CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, STRUCTURE_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            const corrected = await runPlanted(
                sandbox.path,
                {
                    ...planted,
                    files: Object.fromEntries(Object.keys(planted.files).map((path) => [path, STRUCTURE_CLEAN])),
                },
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
