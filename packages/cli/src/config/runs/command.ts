export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const TAIL_LINES = 20;

/** The flag of each type checker that takes the Python interpreter to read installed packages from. */
export const INTERPRETER_FLAGS: Readonly<Record<string, string>> = { basedpyright: '--pythonpath' };

/** The interpreter inside a virtual environment. */
export const PYTHON_EXECUTABLE = 'python';
