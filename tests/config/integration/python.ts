import { GOOGLE_PYPROJECT } from '#tests/config/setup/languages.ts';
import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';

export const PYDOCLINT_CHECK_ARGUMENTS = ['check', '--only', 'python/pydoclint', '--json'] as const;

export const DOCSTRING_MODULES = {
    'google.py': `def double(value: int) -> int:
    """Double a number.

    Args:
        amount: The number.

    Returns:
        Twice the number.
    """
    return value * 2
`,
    'numpy.py': `EXAMPLE = """
Args:
"""

def double(value: int) -> int:
    """Double a number.

    Parameters
    ----------
    amount
        The number.

    Returns
    -------
    The doubled number.
    """
    return value * 2
`,
} as const;

export const RUFF_FORMAT_CASES = [
    {
        file: 'sample.py',
        formatted: "VALUE = 'example'\n",
    },
    {
        file: 'app/sample.py',
        formatted: 'VALUE = "example"\n',
    },
] as const;

export const UNUSED_IMPORT_SOURCE = `"""An example module."""

import math

TOTAL: int = "one"
`;

export const PYTEST_SAMPLE = `"""Sample declarations."""

import pytest


@pytest.fixture()
def example() -> int:
    """Provide a reusable value."""
    return 1
`;

export const VERSION_SOURCE = `"""Annotation examples."""

from typing import List, Optional


def retain(values: Optional[List[int]]) -> Optional[List[int]]:
    """Keep the supplied values."""
    return values
`;

export const RUFF_VERSION_CASES = [
    { scope: '', requires: '>=3.8,<4', rules: ['FA100', 'FA100', 'FA100', 'FA100'], fixed: VERSION_SOURCE },
    {
        scope: 'legacy',
        requires: '==3.9.*',
        rules: ['UP035', 'FA100', 'UP006', 'FA100', 'UP006'],
        fixed: VERSION_SOURCE,
    },
    {
        scope: 'modern',
        requires: '~=3.10',
        rules: ['UP035', 'UP045', 'UP006', 'UP045', 'UP006'],
        fixed: VERSION_SOURCE.replace('from typing import List, Optional\n', '').replaceAll(
            'Optional[List[int]]',
            'list[int] | None',
        ),
    },
] as const;

export const PARAMETER_LIMIT_CASE = {
    language: 'python',
    file: 'example.py',
    source: `"""Parameter-limit samples."""


def _seven(value0: int, value1: int, value2: int, value3: int, value4: int, value5: int, value6: int) -> int:
    return value0 + value1 + value2 + value3 + value4 + value5 + value6


def _eight(
    value0: int,
    value1: int,
    value2: int,
    value3: int,
    value4: int,
    value5: int,
    value6: int,
    value7: int,
) -> int:
    return value0 + value1 + value2 + value3 + value4 + value5 + value6 + value7
`,
    finding: { code: 'PLR0913', location: { row: 8 } },
    failureStatus: 1,
} as const;

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
        'example/__init__.py': '"""The test package."""\n',
        [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
    },
} as const;

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
