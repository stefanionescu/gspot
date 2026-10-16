const PYTHON_PROJECT_OPTIONS = `requires-python = ">=3.12"
dependencies = []
`;

export const PYDOCLINT_GOOGLE = `[tool.pydoclint]
style = "google"
`;

export const PYPROJECT = `[project]
name = "example"
version = "1.0.0"
${PYTHON_PROJECT_OPTIONS}`;

/** Sibling Python projects with different enabled tools. */
export const NESTED_PYTHON_SETTINGS = `configurations = []\n[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n[[scope]]\npath = "linted"\n\nconfigurations = ["python"]\n[[scope]]\npath = "typed"\n\nconfigurations = ["python"]\n[rules]\nenabled = false\n`;

export const PYTEST_PYPROJECT = `[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;
