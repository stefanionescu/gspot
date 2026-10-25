import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/config/integration/checks/testing/samples.ts';

export const PYTEST_PYPROJECT = `[project]
name = "example"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
`;

const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple

def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

export const PYTEST_SANDBOX = {
    configurations: ['python', 'pytest', 'naming'],
    files: {
        'pyproject.toml': PYTEST_PYPROJECT,
        'example/__init__.py': '"""The package."""\n',
        'example/math.py': ARITHMETIC_MODULE,
        'tests/__init__.py': '"""Arithmetic tests."""\n',
        'tests/test_math.py': ARITHMETIC_TESTS,
    },
} as const;

export const PYTEST_CASES = [
    {
        check: 'pytest/coverage',
        files: {
            'tests/test_math.py': `"""Tests of the arithmetic."""

from example.math import double, triple


def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
`,
        },
        settings: '[coverage]\nlines = 95\n',
        expected: { message: 'FAIL Required test coverage of 95% not reached. Total coverage: 85.71%' },
        corrected: { files: { 'tests/test_math.py': ARITHMETIC_TESTS } },
    },
] as const;

export const COVERAGE_LIMIT_CASES = [
    {
        limit: 80,
        coverage: COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80'),
        code: 2,
        result: {
            status: 'missing',
            note: 'pytest-cov is not installed. Install pytest-cov in the Python environment used by pytest.',
            coverage: undefined,
        },
    },
    {
        limit: 0,
        coverage: COVERAGE_ZERO_LIMITS,
        code: 0,
        result: { status: 'passed', note: undefined, coverage: false },
    },
] as const;
