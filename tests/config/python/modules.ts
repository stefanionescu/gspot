import { PYPROJECT, PYDOCLINT_GOOGLE } from '#tests/config/python/project.ts';

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

const PYTHON_MODULE_REPOSITORY = {
    configurations: ['python'],

    files: {
        'pyproject.toml': PYPROJECT + '\n' + PYDOCLINT_GOOGLE,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': CLEAN_PYTHON_MODULE,
    },
} as const;

const LONG_PYTHON_FILE = `VALUE_0 = 0
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

const LONG_FUNCTION_BODY = `    step_0 = 0
    step_1 = 1
    step_2 = 2
    step_3 = 3
    step_4 = 4`;

const PYTHON_MODULE_CASES = [
    {
        check: 'python/function-size',
        settings: '[limits]\nfunction_lines = 6\n',
        files: {
            'example/long.py': `"""A test module."""


def long_one() -> None:
    """Hold many steps."""
${LONG_FUNCTION_BODY}
`,
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
        check: 'python/module-getattr',
        files: {
            'example/lazy.py': `"""A test module."""\n\n\ndef __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n`,
        },
        expected: { file: 'example/lazy.py', rule: 'lazy-export', line: 4 },
    },
] as const;

/** An exception response whose correction keeps its cause private. */
const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

const PYTHON_MODULE_HEADER = '"""A test module."""\n\n\n';

export {
    FASTAPI_SOURCE,
    LONG_PYTHON_FILE,
    CLEAN_PYTHON_MODULE,
    PYTHON_MODULE_CASES,
    PYTHON_MODULE_HEADER,
    PYTHON_MODULE_REPOSITORY,
};
