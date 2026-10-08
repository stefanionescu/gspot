import { PYPROJECT } from '#tests/config/samples/python.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const STRUCTURE_CLEAN =
    '"""Prices."""\n\n\ndef _rounded(amount: float) -> float:\n    """Round to cents, half up."""\n    shifted = amount * 100\n    whole = int(shifted + 0.5)\n    return whole / 100\n\n\ndef total(prices: list[float]) -> float:\n    """Add prices and round the sum."""\n    summed = sum(prices)\n    checked = max(summed, 0.0)\n    return _rounded(checked) + _rounded(0.0)\n\n\n__all__ = ["total"]\n';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['python'],
    modules: false,
    installs: false,
    files: {
        'pyproject.toml': PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': STRUCTURE_CLEAN,
    },
};

export const LONG_FILE =
    'VALUE_0 = 0\nVALUE_1 = 1\nVALUE_2 = 2\nVALUE_3 = 3\nVALUE_4 = 4\nVALUE_5 = 5\nVALUE_6 = 6\nVALUE_7 = 7\nVALUE_8 = 8\nVALUE_9 = 9\nVALUE_10 = 10\nVALUE_11 = 11\nVALUE_12 = 12';

export const LONG_BODY = '    step_0 = 0\n    step_1 = 1\n    step_2 = 2\n    step_3 = 3\n    step_4 = 4';

export const CASES: FindingCase[] = [
    {
        check: 'structure/file-lines',
        policy: '[limits]\nfile_lines = 12\n',
        files: { 'example/big.py': `"""A test module."""\n\n\n${LONG_FILE}\n` },
        expected: { file: 'example/big.py', rule: 'file-lines', line: 1 },
    },
    {
        check: 'python/function-size',
        policy: '[limits]\nfunction_lines = 6\n',
        files: {
            'example/long.py': `"""A test module."""\n\n\ndef long_one() -> None:\n    """Hold many steps."""\n${LONG_BODY}\n`,
        },
        expected: { file: 'example/long.py', rule: 'function-lines', line: 4 },
    },
    {
        check: 'python/placeholder-docstrings',
        files: {
            'example/empty.py': `"""A test module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
        },
        expected: { file: 'example/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
    {
        check: 'python/lazy-exports',
        files: {
            'example/lazy.py': `"""A test module."""\n\n\ndef __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n`,
        },
        expected: { file: 'example/lazy.py', rule: 'lazy-export', line: 4 },
    },
];
