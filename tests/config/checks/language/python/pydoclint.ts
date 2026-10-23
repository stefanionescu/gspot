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

export const TYPE_FLAG_NAMES = [
    '--arg-type-hints-in-docstring',
    '--check-return-types',
    '--check-yield-types',
] as const;

const DEFAULT_TYPE_FLAGS = [
    '--arg-type-hints-in-docstring',
    'false',
    '--check-return-types',
    'false',
    '--check-yield-types',
    'false',
] as const;

export const PYDOCLINT_PROJECT_CASES = [
    ...DOCSTRING_STYLES.map((row) => ({ ...row, typeFlags: DEFAULT_TYPE_FLAGS })),
    ...['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'].map(
        (project) => ({
            name: 'keeps the default style without a supported convention',
            project,
            setting: undefined,
            expected: 'numpy',
            typeFlags: DEFAULT_TYPE_FLAGS,
        }),
    ),
    {
        name: 'preserves explicit signature type options',
        project:
            '[tool.pydoclint]\narg-type-hints-in-docstring = true\ncheck_return_types = false\ncheck-yield-types = true\n',
        setting: undefined,
        expected: 'numpy',
        typeFlags: [],
    },
];

export const FAILED_STYLE_BATCH = {
    code: 2,
    stderr: 'The native command could not read its configuration.',
    errored: true,
    duration: 3,
} as const;
