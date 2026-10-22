const PYTHON_PROJECT_OPTIONS = `requires-python = ">=3.12"
dependencies = []
`;

const PYDOCLINT_GOOGLE = `[tool.pydoclint]
style = "google"
`;

export const PYPROJECT = `[project]
name = "example"
version = "1.0.0"
${PYTHON_PROJECT_OPTIONS}`;

export const PYTEST_PYPROJECT = `[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;

/** The shared Python project with Google-style pydoclint settings. */
export const GOOGLE_PYPROJECT = `${PYPROJECT}\n${PYDOCLINT_GOOGLE}`;
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
