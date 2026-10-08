// The paths the job caches between runs: the package caches and the installed tools.
export const CACHED_PATHS = [
    '~/.npm/_cacache',
    '~/.bun/install/cache',
    '~/.cache/uv',
    '~/.cache/mise',
    '~/.local/share/mise/installs',
    '~/.local/share/pnpm/store',
    '~/.yarn/berry/cache',
];

export const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

export const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';
