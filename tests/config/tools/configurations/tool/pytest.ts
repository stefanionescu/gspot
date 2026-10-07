export const ARITHMETIC_TESTS =
    '"""Tests of the arithmetic."""\n\nfrom example.math import double, triple\n\n\ndef test_multiplication() -> None:\n    """Both functions multiply."""\n    assert double(2) == 4\n    assert triple(2) == 6\n';

export const MATH =
    '"""Arithmetic."""\n\n\ndef double(value: int) -> int:\n    """Double a number."""\n    return value * 2\n\n\ndef triple(value: int) -> int:\n    """Triple a number."""\n    return value * 3\n';

export const PROJECT = `[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;
