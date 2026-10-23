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

export const GOOGLE_PYPROJECT = `${PYPROJECT}\n${PYDOCLINT_GOOGLE}`;
