import { PYPROJECT, PYDOCLINT_GOOGLE, PYTHON_PROJECT_OPTIONS } from '#tests/config/python/project.ts';

// pydoclint gets the Google docstring style from the project.

const ARITHMETIC_MODULE_PATH = 'example/math.py';

const ARITHMETIC_DOUBLE_HEADER = `"""Arithmetic examples used by these tests."""


def double(value: int) -> int:
    """Double a number.

    Args:
`;

const ARITHMETIC_MODULE = `${ARITHMETIC_DOUBLE_HEADER}        value: The number.

    Returns:
        Twice the number.

    """
    return value * 2


def triple(value: int) -> int:
    """Triple a number.

    Args:
        value: The number.

    Returns:
        Three times the number.

    """
    return value * 3
`;

const PYTHON_SANDBOX = {
    configurations: ['python'],

    tools: ['ruff', 'basedpyright'],
    files: {
        'pyproject.toml': PYPROJECT + '\n' + PYDOCLINT_GOOGLE,
        'pyrightconfig.json': `{
    "typeCheckingMode": "basic",
    "exclude": [".venv", "example/skipped.py"]
}
`,
        'example/skipped.py': '"""A file the old setup left out."""\n',
        'example/__init__.py': '"""The test package."""\n',
        [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
    },
} as const;

const ARITHMETIC_DOUBLE_RETURNS = `
    Returns:
        int: Twice the number.

    """
`;

const PYTHON_CASES = [
    {
        check: 'python/ruff',
        files: {
            [ARITHMETIC_MODULE_PATH]: `${ARITHMETIC_MODULE}

def run(code: str) -> object:
    """Run code.

    Args:
        code (str): The code.

    Returns:
        object: What it gave.

    """
    return eval(code)
`,
        },
        expected: { file: ARITHMETIC_MODULE_PATH, rule: 'S307', line: 40 },
    },
    {
        check: 'python/ruff-format',
        files: {
            [ARITHMETIC_MODULE_PATH]: `${ARITHMETIC_DOUBLE_HEADER}        value (int): The number.
${ARITHMETIC_DOUBLE_RETURNS}    return value*2
`,
        },
        expected: { file: ARITHMETIC_MODULE_PATH },
    },
    {
        check: 'python/basedpyright',
        files: {
            [ARITHMETIC_MODULE_PATH]: `${ARITHMETIC_DOUBLE_HEADER}        value (int): The number.
${ARITHMETIC_DOUBLE_RETURNS}    return str(value)
`,
        },
        expected: { file: ARITHMETIC_MODULE_PATH, rule: 'reportReturnType', line: 14 },
    },
    {
        check: 'python/pydoclint',
        files: {
            [ARITHMETIC_MODULE_PATH]: `${ARITHMETIC_DOUBLE_HEADER}        amount (int): The number.
${ARITHMETIC_DOUBLE_RETURNS}    return value * 2
`,
        },
        expected: { file: ARITHMETIC_MODULE_PATH, rule: 'DOC103', line: 4 },
    },
    {
        check: 'python/pyproject',
        files: {
            'pyproject.toml': `[project]
name = "example"
version = 7
${PYTHON_PROJECT_OPTIONS}
${PYDOCLINT_GOOGLE}`,
        },
        expected: { file: 'pyproject.toml' },
    },
] as const;

const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple


def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

export { PYTHON_CASES, PYTHON_SANDBOX, ARITHMETIC_TESTS, ARITHMETIC_MODULE, ARITHMETIC_MODULE_PATH };
