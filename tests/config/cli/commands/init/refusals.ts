export const QUIET = ['--no-task', '--no-ci', '--no-agent-rules', '--no-install'];

export const ARGUMENT_REFUSALS = [
    { name: 'a choice outside its list', argv: ['init', '--yes', '--ci', 'foo'], cause: 'foo' },
    {
        name: 'an unknown configuration',
        argv: ['init', '--yes', '--configurations', 'bassh', ...QUIET],
        cause: 'bassh',
    },
];

/** Git-dependent plan rows belong only to a repository with a Git index. */
export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false },
    { name: 'a Git repository', hasGit: true },
];

/** Each refused scope reports its own path failure. */
export const UNSAFE_SCOPE_CASES = [
    { scope: '../outside', diagnostic: 'Unsafe lifecycle path: "../outside"' },
    { scope: 'linked', diagnostic: 'Unsafe lifecycle destination: linked' },
    { scope: 'missing', diagnostic: 'Scope directory does not exist: missing' },
];
