import { GOOGLE_PYPROJECT } from '#tests/config/python.ts';

const CLEAN_PYTHON_MODULE = `"""Prices."""


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
    cleanSource: CLEAN_PYTHON_MODULE,

    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': CLEAN_PYTHON_MODULE,
    },
} as const;

export const PLACEHOLDER_DOCSTRING_CASES = [
    {
        check: 'python/placeholder-docstrings',
        files: { 'example/users.py': 'class UserStore:\n    """User store."""\n    pass\n' },
        expected: { file: 'example/users.py', rule: 'placeholder-docstring', line: 1 },
    },
    {
        check: 'python/placeholder-docstrings',
        files: {
            'example/empty.py': `"""A test module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
        },
        expected: { file: 'example/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
] as const;
