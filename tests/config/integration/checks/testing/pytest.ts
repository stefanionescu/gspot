import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';

export const PYTEST_PYPROJECT = `[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;

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
