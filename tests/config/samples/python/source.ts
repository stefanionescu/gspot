// Python source and project files shared by configuration tests.
export const CLEAN_MODULE =
    '"""Arithmetic examples used by these tests."""\n\n\ndef double(value: int) -> int:\n    """Double a number.\n\n    Args:\n        value: The number.\n\n    Returns:\n        Twice the number.\n\n    """\n    return value * 2\n';

export const MODULE_PATH = 'example/math.py';

export const PYPROJECT =
    '[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = []\n';

/** The configurations the Python structure sandbox leaves out after init. */
export const EXCLUDED_CONFIGURATIONS = ['naming', 'spelling', 'dependencies'];

export const PYTHON_MODULE_HEADER = '"""A test module."""\n\n\n';
