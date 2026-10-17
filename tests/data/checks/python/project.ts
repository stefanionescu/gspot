const PYTHON_PROJECT_OPTIONS = `requires-python = ">=3.12"
dependencies = []
`;

const PYDOCLINT_GOOGLE = `[tool.pydoclint]
style = "google"
`;

const PYPROJECT = `[project]
name = "example"
version = "1.0.0"
${PYTHON_PROJECT_OPTIONS}`;

/** Sibling Python projects with different enabled tools. */
const NESTED_PYTHON_SETTINGS = `configurations = []\n[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n[[scope]]\npath = "linted"\n\nconfigurations = ["python"]\n[[scope]]\npath = "typed"\n\nconfigurations = ["python"]\n[rules]\nenabled = false\n`;

const PYTEST_PYPROJECT = `[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;

export { PYPROJECT, PYDOCLINT_GOOGLE, PYTEST_PYPROJECT, NESTED_PYTHON_SETTINGS };

/** The JSON check command for each docstring case. */
export const PYDOCLINT_CHECK_ARGUMENTS = ['check', '--only', 'python/pydoclint', '--json'] as const;
