import { BASE_INSTALLED_FILES } from '#tests/config/integration/general.ts';

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
        fixed: VERSION_SOURCE.replaceAll('Optional[List[int]]', 'list[int] | None'),
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
    finding: { line: 8, rule: 'PLR0913' },
} as const;

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

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const RUFF_SUPPRESSIONS = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
] as const;
