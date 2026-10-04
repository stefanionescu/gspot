// The authored files every Python fixture starts from.
export const AUTHORED_FILES = {
    'pyproject.toml': '[project]\nname = "authored"\nversion = "1.0.0"\ndependencies = ["authored-dependency"]\n',
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
};

// The uv variables the fixture points at the sandbox.
export const REDIRECTED = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'];

export const EXCLUDED_PYTHON_CHECKS = [
    'files/v8r',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/import-linter',
    'python/pydoclint',
    'python/deptry',
    'python/vulture',
    'python/pyproject',
];
