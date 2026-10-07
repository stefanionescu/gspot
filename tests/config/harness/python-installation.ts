/** The managed Python project beside this suite run's packed-package metadata. */
export const SUITE_PYTHON_FOLDER = 'python-tools';

// The authored files every Python fixture starts from.
export const AUTHORED_FILES = {
    // These fixtures invoke the source launcher, so mise must not install the unpublished CLI.
    'mise.toml': '[settings]\ndisable_tools = ["npm:@gspothq/cli"]\n',
    'pyproject.toml': '[project]\nname = "authored"\nversion = "1.0.0"\ndependencies = ["authored-dependency"]\n',
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
};

// The uv variables the fixture points at the sandbox.
export const REDIRECTED = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'];

export const EXCLUDED_PYTHON_CHECKS = [
    'files/v8r',
    'security/semgrep',
    'security/semgrep-registry',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/import-linter',
    'python/pydoclint',
    'python/deptry',
    'python/pyproject',
];
