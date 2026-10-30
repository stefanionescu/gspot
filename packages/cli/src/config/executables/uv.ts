export const INTERPRETER_FLAGS: Readonly<Record<string, string>> = { basedpyright: '--pythonpath' };

export const PYTHON_EXECUTABLE = 'python';

export const UV_TOOL = 'uv';

export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;

export const UV_FLAGS = {
    project: '--project',
    with: '--with',
    directory: '--directory',
    configFile: '--config-file',
} as const;

export const UV_PROJECT_ENVIRONMENT = 'UV_PROJECT_ENVIRONMENT';

export const PYTHON_ENVIRONMENT_CHECKS: ReadonlySet<string> = new Set(['python/basedpyright', 'pytest/coverage']);

export const PROJECT_ENVIRONMENT_MESSAGE = 'The project environment .venv is missing. Run uv sync, then check again.';
