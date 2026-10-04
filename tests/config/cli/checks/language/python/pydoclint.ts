/** The setting applies only after native pydoclint style and the scoped Ruff convention. */
export const DOCSTRING_STYLES = [
    {
        name: 'uses the Google setting without project configuration',
        project: '',
        setting: 'google',
        expected: 'google',
    },
    { name: 'uses the NumPy setting without project configuration', project: '', setting: 'numpy', expected: 'numpy' },
    {
        name: 'uses the project Google convention before a NumPy setting',
        project: '[tool.ruff.lint.pydocstyle]\nconvention = "google"\n',
        setting: 'numpy',
        expected: 'google',
    },
    {
        name: 'uses the project NumPy convention before a Google setting',
        project: '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n',
        setting: 'google',
        expected: 'numpy',
    },
    {
        name: 'preserves explicit pydoclint style before either convention',
        project: '[tool.ruff.lint.pydocstyle]\nconvention = "google"\n[tool.pydoclint]\nstyle = "sphinx"\n',
        setting: 'numpy',
        expected: undefined,
    },
    {
        name: 'survives an unrelated pydoclint option',
        project: '[tool.ruff.lint.pydocstyle]\nconvention = "numpy"\n[tool.pydoclint]\nskip-checking-raises = true\n',
        setting: 'google',
        expected: 'numpy',
    },
] as const;
