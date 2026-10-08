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

/** The GitLab include named in initialization and doctor. */
export const GITLAB_INCLUDE_LABEL = `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`;

/** Instructions for the generated CI files shown in the initialization plan. */
export const CI_FILE_NOTES: Record<string, string> = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
};
