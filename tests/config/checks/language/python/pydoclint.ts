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
