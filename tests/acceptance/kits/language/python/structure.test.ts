// Planted repository for the Python structure checks: one module shaped wrong for each check.
import { STRUCTURE_PROJECT } from '#tests/samples/python.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

const STRUCTURE_CLEAN =
    '"""Prices."""\n\n\ndef _rounded(amount: float) -> float:\n    """Round to cents, half up."""\n    shifted = amount * 100\n    whole = int(shifted + 0.5)\n    return whole / 100\n\n\ndef total(prices: list[float]) -> float:\n    """Add prices and round the sum."""\n    summed = sum(prices)\n    checked = max(summed, 0.0)\n    return _rounded(checked) + _rounded(0.0)\n\n\n__all__ = ["total"]\n';

const LONG_BODY = Array.from({ length: 61 }, (_, index) => `    step_${String(index)} = ${String(index)}`).join('\n');
const LONG_FILE = Array.from({ length: 301 }, (_, index) => `VALUE_${String(index)} = ${String(index)}`).join('\n');

plantedCases(
    'the Python structure checks',
    {
        kits: ['python'],
        modules: false,
        without: ['naming', 'spelling', 'dependencies'],
        tools: ['ruff'],
        files: {
            'pyproject.toml': STRUCTURE_PROJECT,
            'planted/__init__.py': '"""The planted package."""\n',
            'planted/prices.py': STRUCTURE_CLEAN,
        },
        corrected: (planted) => ({
            files: Object.fromEntries(Object.keys(planted.files).map((path) => [path, STRUCTURE_CLEAN])),
        }),
    },
    [
        {
            check: 'python/file-length',
            files: { 'planted/big.py': `"""A planted module."""\n\n\n${LONG_FILE}\n` },
            expected: { file: 'planted/big.py', rule: 'file-lines', line: 1 },
        },
        {
            check: 'python/function-length',
            files: {
                'planted/long.py': `"""A planted module."""\n\n\ndef long_one() -> None:\n    """Hold many steps."""\n${LONG_BODY}\n`,
            },
            expected: { file: 'planted/long.py', rule: 'function-lines', line: 4 },
        },
        {
            check: 'python/trivial-function',
            files: {
                'planted/tiny.py': `"""A planted module."""\n\n\ndef tiny(value: int) -> int:\n    """Add one to a number."""\n    return value + 1\n\n\ndef caller() -> int:\n    """Call the tiny one, then do more."""\n    first = tiny(1)\n    second = first * 2\n    return second - 1\n`,
            },
            expected: { file: 'planted/tiny.py', rule: 'trivial-function', line: 4 },
        },
        {
            check: 'python/trivial-function',
            files: {
                'planted/forward.py': `"""A planted module."""\n\n\ndef forward(left: int, right: int) -> int:\n    """Forward to the builtin."""\n    return max(left, right)\n`,
            },
            expected: { file: 'planted/forward.py', rule: 'trivial-function', line: 4 },
        },
        {
            check: 'python/placeholder-docstring',
            files: {
                'planted/empty.py': `"""A planted module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
            },
            expected: { file: 'planted/empty.py', rule: 'placeholder-docstring', line: 4 },
        },
        {
            check: 'python/private-prefix',
            files: {
                'planted/leaky.py': `"""A planted module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
            },
            expected: { file: 'planted/leaky.py', rule: 'private-prefix', line: 9 },
        },
        {
            check: 'python/private-before-public',
            files: {
                'planted/order.py': `"""A planted module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n`,
            },
            expected: { file: 'planted/order.py', rule: 'private-before-public', line: 9 },
        },
        {
            check: 'python/exports-at-bottom',
            files: {
                'planted/top.py': `"""A planted module."""\n\n\n__all__ = ["shown"]\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n`,
            },
            expected: { file: 'planted/top.py', rule: 'exports-at-bottom', line: 4 },
        },
        {
            check: 'python/import-comments',
            files: {
                'planted/noted.py': `"""A planted module."""\n\nimport os\n# the path tools\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n`,
            },
            expected: { file: 'planted/noted.py', rule: 'import-comment', line: 4 },
        },
        {
            check: 'python/export-order',
            files: {
                'planted/listed.py': `"""A planted module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown", "ab"]\n`,
            },
            expected: { file: 'planted/listed.py', rule: 'export-order', line: 14 },
        },
        {
            check: 'python/no-lazy-exports',
            files: {
                'planted/lazy.py': `"""A planted module."""\n\n\ndef __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n`,
            },
            expected: { file: 'planted/lazy.py', rule: 'no-lazy-exports', line: 4 },
        },
        {
            check: 'python/package-exports',
            files: { 'planted/__init__.py': `"""A planted module."""\n\n\n__all__ = ["a", "b", "c"]\n` },
            policy: '[structure.python]\nmax_package_exports = 2\n',
            expected: { file: 'planted/__init__.py', rule: 'package-exports', line: 4 },
        },
        {
            check: 'python/no-singletons',
            files: {
                'planted/shared.py': `"""A planted module."""\n\n\nclass Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
            },
            expected: { file: 'planted/shared.py', rule: 'no-singletons', line: 8 },
        },
    ],
);
