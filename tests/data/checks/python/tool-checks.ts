import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';
import { GOOGLE_PYPROJECT } from '#tests/data/checks/python/project.ts';

/** One correctness finding and one convention finding, to tell the levels apart. */
export const RUFF_RULE_SOURCE = 'answer = missing_name\nprint(answer)\n';

/** An editor that runs Ruff must find the tool file of each scope. */
export const RUFF_FORMAT_CASES = [
    {
        file: 'sample.py',
        formatted: "VALUE = 'example'\r\n",
    },
    {
        file: 'app/sample.py',
        formatted: 'VALUE = "example"\n',
    },
] as const;

/** Python versions whose annotations require different runtime syntax. */
export const RUFF_VERSION_CASES = [
    { scope: '', requires: '>=3.8,<4', generics: false, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'legacy', requires: '==3.9.*', generics: true, unions: false, annotation: 'Optional[List[int]]' },
    { scope: 'modern', requires: '~=3.10', generics: true, unions: true, annotation: 'list[int] | None' },
] as const;

/** Annotations must remain valid for the project's minimum Python version. */
export const VERSION_SOURCE = `"""Annotation examples."""

from typing import List, Optional

def retain(values: Optional[List[int]]) -> Optional[List[int]]:
    """Keep the supplied values."""
    return values
`;

/** Ruff reports the unused import; basedpyright still reports the assignment error. */
export const DUPLICATE_IMPORT_SOURCE = `"""An example module."""

import math

TOTAL: int = "one"
`;

export const RUFF_RULE_ARGUMENTS = ['rule', '--all', '--output-format', 'json'] as const;

export const RUFF_FORMAT_ARGUMENTS = ['format', '--check', '--no-cache'] as const;

// pydoclint gets the Google docstring style from the project.

export const ARITHMETIC_MODULE_PATH = 'example/math.py';

export const ARITHMETIC_MODULE = `"""Arithmetic examples used by these tests."""

def double(value: int) -> int:
    """Double a number.

    Args:
        value: The number.

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

export const PYTHON_SANDBOX = {
    configurations: ['python'],
    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
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

export const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple

def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
