import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';
import { PYPROJECT, PYDOCLINT_GOOGLE } from '#tests/data/checks/python/project.ts';

/** One correctness finding and one convention finding, to tell the levels apart. */
const RUFF_RULE_SOURCE = 'answer = missing_name\nprint(answer)\n';

/** This function exceeds thirty statements while staying below sixty code lines. */
const FUNCTION_INCREMENT_COUNT = 40;

const FUNCTION_SOURCE = `"""An arithmetic example."""


def increase(value: int) -> int:
    """Increase a value through forty increments."""
${Array.from({ length: FUNCTION_INCREMENT_COUNT }, () => '    value += 1').join('\n')}
    return value
`;

/** An editor that runs Ruff must find the tool file of each scope. */
const RUFF_FORMAT_CASES = [
    { file: 'sample.py', config: '.gspot/config/ruff.toml', formatted: "VALUE = 'example'\r\n" },
    { file: 'app/sample.py', config: '.gspot/config/ruff/app/ruff.toml', formatted: 'VALUE = "example"\n' },
] as const;

/** Python versions whose annotations require different runtime syntax. */
const RUFF_VERSION_CASES = [
    { scope: '', requires: '>=3.8,<4', generics: false, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'legacy', requires: '==3.9.*', generics: true, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'modern', requires: '~=3.10', generics: true, unions: true, annotation: 'list[int] | None' },
] as const;

/** Annotations must remain valid for the project's minimum Python version. */
const VERSION_SOURCE = `"""Annotation examples."""

from typing import List, Optional


def retain(values: Optional[List[int]]) -> Optional[List[int]]:
    """Keep the supplied values."""
    return values
`;

/** Ruff reports the unused import; basedpyright still reports the assignment error. */
const DUPLICATE_IMPORT_SOURCE = `"""An example module."""

import math

TOTAL: int = "one"
`;

const RUFF_RULE_ARGUMENTS = ['rule', '--all', '--output-format', 'json'] as const;

const RUFF_FORMAT_ARGUMENTS = ['format', '--check', '--no-cache'] as const;

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
] as const;

const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple


def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export {
    PYTHON_CASES,
    RUFF_SANDBOX,
    PYTHON_SANDBOX,
    VERSION_SOURCE,
    FUNCTION_SOURCE,
    ARITHMETIC_TESTS,
    RUFF_RULE_SOURCE,
    ARITHMETIC_MODULE,
    RUFF_FORMAT_CASES,
    RUFF_VERSION_CASES,
    RUFF_RULE_ARGUMENTS,
    RUFF_FORMAT_ARGUMENTS,
    ARITHMETIC_MODULE_PATH,
    DUPLICATE_IMPORT_SOURCE,
};
