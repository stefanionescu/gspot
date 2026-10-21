import { GOOGLE_PYPROJECT } from '#tests/data/checks/python/project.ts';

export const CLEAN_PYTHON_MODULE = `"""Prices."""


def _rounded(amount: float) -> float:
    """Round to cents, half up."""
    shifted = amount * 100
    whole = int(shifted + 0.5)
    return whole / 100


def total(prices: list[float]) -> float:
    """Add prices and round the sum."""
    summed = sum(prices)
    checked = max(summed, 0.0)
    return _rounded(checked) + _rounded(0.0)


__all__ = ["total"]
`;

export const PYTHON_MODULE_SANDBOX = {
    configurations: ['python'],

    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': CLEAN_PYTHON_MODULE,
    },
} as const;

export const LONG_PYTHON_FILE = `VALUE_0 = 0
VALUE_1 = 1
VALUE_2 = 2
VALUE_3 = 3
VALUE_4 = 4
VALUE_5 = 5
VALUE_6 = 6
VALUE_7 = 7
VALUE_8 = 8
VALUE_9 = 9
VALUE_10 = 10
VALUE_11 = 11
VALUE_12 = 12`;

export const PYTHON_MODULE_CASES = [
    {
        check: 'python/placeholder-docstrings',
        files: {
            'example/empty.py': `"""A test module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
        },
        expected: { file: 'example/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
] as const;
