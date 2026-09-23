// Planted repository for the Python structure checks: one module shaped wrong for each check.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/support/cli/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'python',
    '--without',
    'naming',
    'spelling',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PROJECT = '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n';
const CLEAN =
    '"""Prices."""\n\n\ndef _rounded(amount: float) -> float:\n    """Round to cents, half up."""\n    shifted = amount * 100\n    whole = int(shifted + 0.5)\n    return whole / 100\n\n\ndef total(prices: list[float]) -> float:\n    """Add prices and round the sum."""\n    summed = sum(prices)\n    checked = max(summed, 0.0)\n    return _rounded(checked) + _rounded(0.0)\n\n\n__all__ = ["total"]\n';
const module = (body: string): string => `"""A planted module."""\n\n\n${body}`;
const LONG_BODY = Array.from({ length: 61 }, (_, index) => `    step_${String(index)} = ${String(index)}`).join('\n');
const LONG_FILE = Array.from({ length: 301 }, (_, index) => `VALUE_${String(index)} = ${String(index)}`).join('\n');

const CASES: PlantedCase[] = [
    {
        check: 'python/file-length',
        files: { 'planted/big.py': module(`${LONG_FILE}\n`) },
        expected: 'code lines is over the ceiling of 300',
    },
    {
        check: 'python/function-length',
        files: { 'planted/long.py': module(`def long_one() -> None:\n    """Hold many steps."""\n${LONG_BODY}\n`) },
        expected: 'over the ceiling of 60',
    },
    {
        check: 'python/trivial-function',
        files: {
            'planted/tiny.py': module(
                'def tiny(value: int) -> int:\n    """Add one to a number."""\n    return value + 1\n\n\ndef caller() -> int:\n    """Call the tiny one, then do more."""\n    first = tiny(1)\n    second = first * 2\n    return second - 1\n',
            ),
        },
        expected: 'tiny has 1 executable statements',
    },
    {
        check: 'python/trivial-function',
        files: {
            'planted/forward.py': module(
                'def forward(left: int, right: int) -> int:\n    """Forward to the builtin."""\n    return max(left, right)\n',
            ),
        },
        expected: 'forward has 1 executable statements',
    },
    {
        check: 'python/placeholder-docstring',
        files: {
            'planted/empty.py': module(
                'def load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n',
            ),
        },
        expected: 'says nothing the name does not',
    },
    {
        check: 'python/private-prefix',
        files: {
            'planted/leaky.py': module(
                'def shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n',
            ),
        },
        expected: 'hidden is not in __all__',
    },
    {
        check: 'python/private-before-public',
        files: {
            'planted/order.py': module(
                'def shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n',
            ),
        },
        expected: '_part is private and sits below a public function',
    },
    {
        check: 'python/exports-at-bottom',
        files: {
            'planted/top.py': module(
                '__all__ = ["shown"]\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n',
            ),
        },
        expected: '__all__ is the last statement of the module',
    },
    {
        check: 'python/no-lazy-exports',
        files: {
            'planted/lazy.py': module(
                'def __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n',
            ),
        },
        expected: 'makes names appear at run time',
    },
    {
        check: 'python/package-exports',
        files: { 'planted/__init__.py': module('__all__ = ["a", "b", "c"]\n') },
        policy: '[structure.python]\nmax_package_exports = 2\n',
        expected: 'exports 3 names, over the ceiling of 2',
    },
    {
        check: 'python/import-cycles',
        files: {
            'planted/left.py': module('from planted import right\n\nVALUE = right\n'),
            'planted/right.py': module('from planted import left\n\nVALUE = left\n'),
        },
        expected: 'planted.left -> planted.right -> planted.left',
    },
    {
        check: 'python/no-singletons',
        files: { 'planted/shared.py': module('class Store:\n    """Holds things."""\n\n\nstore = Store()\n') },
        expected: 'store is built when the module is imported',
    },
];

describe('the Python structure checks', () => {
    test(
        'every check passes on a clean module and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'pyproject.toml': PROJECT,
                'planted/__init__.py': '"""The planted package."""\n',
                'planted/prices.py': CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
