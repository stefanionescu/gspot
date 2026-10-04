export const QUIET = ['--no-task', '--no-ci', '--no-rules', '--no-install'];

export const PREVIEW = ['init', '--yes', '--no-hooks', ...QUIET, '--dry-run', '--json'];
