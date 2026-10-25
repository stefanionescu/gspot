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
