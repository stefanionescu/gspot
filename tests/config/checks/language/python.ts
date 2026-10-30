import { GOOGLE_PYPROJECT } from '#tests/config/python.ts';

export const DEPTRY_SCOPE_PATHS = {
    '': {
        excluded: ['.gspot/tool.py', 'app/main.py', 'app/nested/main.py', 'other/main.py'],
        kept: ['main.py', 'application/main.py'],
    },
    app: { excluded: ['.gspot/tool.py', 'nested/main.py'], kept: ['main.py', 'nestedness/main.py'] },
    'app/nested': { excluded: ['.gspot/tool.py'], kept: ['main.py'] },
    other: { excluded: ['.gspot/tool.py'], kept: ['main.py'] },
} as const;

export const FUNCTION_SIZE_SOURCE = `def short():
    # A comment.

    return 1


def long(value):
    first = value
    second = first
    return second
`;

export const LOCKED_SCOPE_SETTINGS = {
    level: 'all',
    scopes: [
        { path: 'locked', configurations: ['python'] },
        { path: 'other', configurations: ['python'] },
    ],
} as const;

export const REQUIREMENTS_FILE_FINDING = {
    check: 'python/pip-installs',
    file: 'locked/requirements.txt',
    line: 1,
    rule: 'requirements-file',
    fixable: false,
    message:
        'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
    help: 'Export the requirements file from the lockfile, declare it generated, and replace `pip install` with the locked command. Accept a reviewed path with `gspot ignore python/pip-installs --paths <glob> --reason "<why>"`.',
} as const;

const CLEAN_PYTHON_MODULE = `"""Prices."""


def _rounded(amount: float) -> float:
    """Round to cents, half up."""
    shifted = amount * 100
    whole = int(shifted + 0.5)
    return whole / 100


def total(prices: list[float]) -> float:
    """Add prices and round the sum."""
    summed = sum(prices)
    checked = max(summed, 0.0)
    return _rounded(checked) + _rounded(0.0)


__all__ = ["total"]
`;

export const PYTHON_MODULE_SANDBOX = {
    configurations: ['python'],
    cleanSource: CLEAN_PYTHON_MODULE,

    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': CLEAN_PYTHON_MODULE,
    },
} as const;

export const PLACEHOLDER_DOCSTRING_CASES = [
    {
        check: 'python/placeholder-docstrings',
        files: { 'example/users.py': 'class UserStore:\n    """User store."""\n    pass\n' },
        expected: { file: 'example/users.py', rule: 'placeholder-docstring', line: 1 },
    },
    {
        check: 'python/placeholder-docstrings',
        files: {
            'example/empty.py': `"""A test module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
        },
        expected: { file: 'example/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
] as const;

export const GOOGLE_DOCSTRING_MODULE = `def double(value: int) -> int:
    """Double it.

    Args:
        wrong: A number.
    """
    return value * 2
`;

export const NUMPY_DOCSTRING_MODULE = `def double(value: int) -> int:
    """Double it.

    Parameters
    ----------
    value
        A number.
    """
    return value * 2
`;

export const PYDOCLINT_PROJECT_CASES = [
    {
        name: 'uses the Google setting without project configuration',
        project: '',
        setting: 'google',
        expected: 'google',
    },
    {
        name: 'uses the project Google convention before a NumPy setting',
        project: '[tool.ruff.lint.pydocstyle]\nconvention = "google"\n',
        setting: 'numpy',
        expected: 'google',
    },
    {
        name: 'preserves explicit pydoclint style before either convention',
        project: `[tool.ruff.lint.pydocstyle]
convention = "google"
[tool.pydoclint]
style = "sphinx"
`,
        setting: 'numpy',
        expected: 'sphinx',
    },
    {
        name: 'survives an unrelated pydoclint option',
        project: `[tool.ruff.lint.pydocstyle]
convention = "numpy"
[tool.pydoclint]
skip-checking-raises = true
`,
        setting: 'google',
        expected: 'numpy',
    },
    { name: 'keeps the default style with no pyproject.toml', project: '', setting: undefined, expected: 'numpy' },
] as const;

export const FAILED_STYLE_BATCH = {
    code: 2,
    stderr: 'The native command could not read its configuration.',
    errored: true,
    duration: 3,
} as const;

export const VULTURE_OUTPUT = [
    "app/main.py:1: unused import 'os' (90% confidence)",
    "app/nodes.py:1: unused function 'helper' (60% confidence)",
    "app/nodes.py:3: unreachable code after 'return' (100% confidence)",
    "app/nodes.py:4: unused variable 'value' (60% confidence)",
] as const;
