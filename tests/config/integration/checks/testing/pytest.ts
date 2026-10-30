import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';

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

const HALF_COVERED_SOURCE =
    'def first():\n    return 1\ndef second():\n    return 2\ndef third():\n    return 3\ndef fourth():\n    return 4\n';

export const PYTEST_CASES = [
    {
        check: 'pytest/coverage',
        files: {
            'example/__init__.py': '',
            'example/math.py': HALF_COVERED_SOURCE,
            'tests/test_math.py': `from example.math import first, second, third, fourth\n\ndef test_functions():\n${Array.from({ length: 40 }, () => '    assert callable(first) and callable(second) and callable(third) and callable(fourth)').join('\n')}\n`,
        },
        settings: '[coverage]\nlines = 80\n',
        expected: {},
        corrected: {
            files: {
                'example/__init__.py': '',
                'example/math.py': HALF_COVERED_SOURCE,
                'tests/test_math.py':
                    'from example.math import first, second, third, fourth\n\ndef test_functions():\n    assert [first(), second(), third(), fourth()] == [1, 2, 3, 4]\n',
            },
        },
    },
] as const;

export const COVERAGE_LIMIT_CASES = [
    {
        limit: 80,
        coverage: '[coverage]\nlines = 80\n',
        code: 2,
        result: {
            status: 'missing',
            note: 'pytest-cov is not installed. Install pytest-cov in the Python environment used by pytest.',
            coverage: undefined,
        },
    },
    {
        limit: 0,
        coverage:
            '[coverage]\nlines = { value = 0, reason = "This test checks execution without coverage collection." }\n',
        code: 0,
        result: { status: 'passed', note: undefined, coverage: false },
    },
] as const;
