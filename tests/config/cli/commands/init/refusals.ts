export const QUIET = ['--no-task', '--no-ci', '--no-rules', '--no-install'];

export const PREVIEW = ['init', '--yes', '--no-hooks', ...QUIET, '--dry-run', '--json'];

/** Git-dependent plan rows belong only to a repository with a Git index. */
export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false },
    { name: 'a Git repository', hasGit: true },
];
