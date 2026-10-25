export const INTERPRETER_FLAGS: Readonly<Record<string, string>> = { basedpyright: '--pythonpath' };

export const PYTHON_EXECUTABLE = 'python';

export const UV_TOOL = 'uv';

export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;

export const UV_PROJECT_FLAGS = {
    project: '--project',
    directory: '--directory',
    configFile: '--config-file',
} as const;

export const UV_PROJECT_ENVIRONMENT = 'UV_PROJECT_ENVIRONMENT';
