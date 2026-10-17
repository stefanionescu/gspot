/** The docstring setting applies only when the project sets no pydoclint style and no Ruff convention. */
const DOCSTRING_STYLES = [
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
] as const;

/** Google and NumPy docstrings with no project style; the check must apply the style of each file. */
const DOCSTRING_MODULES = {
    'google.py': `def double(value: int) -> int:
    """Double a number.

    Args:
        amount: The number.

    Returns:
        Twice the number.
    """
    return value * 2
`,
    'numpy.py': `EXAMPLE = """
Args:
"""

def double(value: int) -> int:
    """Double a number.

    Parameters
    ----------
    amount
        The number.

    Returns
    -------
    The doubled number.
    """
    return value * 2
`,
} as const;

const GOOGLE_DOCSTRING_MODULE = `def double(value: int) -> int:
    """Double it.

    Args:
        wrong: A number.
    """
    return value * 2
`;

const NUMPY_DOCSTRING_MODULE = `def double(value: int) -> int:
    """Double it.

    Parameters
    ----------
    value
        A number.
    """
    return value * 2
`;

const DEFAULT_PYDOCLINT_COMMAND = [
    'pydoclint',
    '--allow-init-docstring',
    'true',
    '--quiet',
    '{files}',
    '--arg-type-hints-in-docstring',
    'false',
    '--check-return-types',
    'false',
    '--check-yield-types',
    'false',
] as const;

const PYDOCLINT_PROJECT_CASES = [
    ...DOCSTRING_STYLES.map((row) => ({ ...row, command: DEFAULT_PYDOCLINT_COMMAND })),
    ...['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'].map(
        (project) => ({
            name: 'keeps the default style without a supported convention',
            project,
            setting: undefined,
            expected: 'numpy',
            command: DEFAULT_PYDOCLINT_COMMAND,
        }),
    ),
    {
        name: 'preserves explicit signature type options',
        project:
            '[tool.pydoclint]\narg-type-hints-in-docstring = true\ncheck_return_types = false\ncheck-yield-types = true\n',
        setting: undefined,
        expected: 'numpy',
        command: ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'],
    },
];

export { DOCSTRING_MODULES, NUMPY_DOCSTRING_MODULE, GOOGLE_DOCSTRING_MODULE, PYDOCLINT_PROJECT_CASES };
