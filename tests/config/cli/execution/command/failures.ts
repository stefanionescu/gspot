export const ESLINT_CRASH = {
    code: 1,
    stdout: '',
    stderr: 'Oops! Something went wrong\n',
    missing: false,
    duration: 1,
};

export const ESLINT_TOOL = {
    name: 'eslint',
    installers: {},
    kind: 'binary' as const,
    crash_pattern: '^Oops! Something went wrong',
};
