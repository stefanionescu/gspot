export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;
export const RUFF_VERSION_OUTPUT = /^ruff (?<version>\d+\.\d+\.\d[-+\w.]*)$/u;

export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;
export const PYTHON_INSTALL_STEPS = [
    ['uv', 'venv', '--python', '{python-version}', '--allow-existing', '.venv'],
    ['uv', 'sync', '--locked', '--no-install-project', '--python', '{python-version}'],
] as const;
