export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const PYTHON_INDEX_UPLOAD_TIME = '2020-01-01T00:00:00Z';

export const UV_RELEASE_CUTOFF_LINE = /^exclude-newer = .*$/mu;

export const PYTHON_SIMPLE_JSON_TYPE = 'application/vnd.pypi.simple.v1+json';

export const RUFF_VERSION_OUTPUT = /^ruff (?<version>\d+\.\d+\.\d[-+\w.]*)$/u;

export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;

export const PYTHON_INSTALL_STEPS = [
    ['uv', 'venv', '--python', '{python-version}', '--allow-existing', '.venv'],
    ['uv', 'sync', '--locked', '--no-install-project', '--python', '{python-version}'],
] as const;
