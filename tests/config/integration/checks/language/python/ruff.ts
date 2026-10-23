export const RUFF_RULE_SOURCE = '"""An arithmetic example."""\n\nanswer = missing_name\nprint(answer)\n';

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

export const RUFF_RULE_ARGUMENTS = ['rule', '--all', '--output-format', 'json'] as const;

export const RUFF_FORMAT_ARGUMENTS = ['format', '--check', '--no-cache'] as const;

export const PYTEST_SAMPLE = `"""Sample declarations."""

import pytest


@pytest.fixture()
def example() -> int:
    """Provide a reusable value."""
    return 1
`;
