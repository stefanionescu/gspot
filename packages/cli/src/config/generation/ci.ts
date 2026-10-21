import {
    DOT_GSPOT,
    SETTINGS_FILE,
    VERSION_PIN_FILE,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/gspot-paths.ts';

// The paths the job caches between runs: the package caches and the installed tools.
export const CACHED_PATHS = [
    '~/.npm/_cacache',
    '~/.bun/install/cache',
    '~/.cache/uv',
    '~/.cache/mise',
    '~/.local/share/mise/installs',
    '~/.local/share/pnpm/store',
    '~/.yarn/berry/cache',
] as const;

export const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

export const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';

/** Shared pins for generation, installation, downloads, and maintenance checks. */
export const CI_PINS = {
    mise: { version: '2026.10.7' },
    actions: {
        checkout: {
            name: 'actions/checkout',
            sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
            version: 'v7.0.1',
        },
        mise: {
            name: 'jdx/mise-action',
            sha: '2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca',
            version: 'v5.1.1',
        },
        cache: {
            name: 'actions/cache',
            sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            version: 'v6.1.0',
        },
    },
    githubRunners: {
        linux: { label: 'ubuntu-24.04', arch: 'x64' },
        macos: { label: 'macos-26', arch: 'arm64' },
        windows: { label: 'windows-2025', arch: 'x64' },
    },
} as const;

/** Generated CI jobs use one provider-independent time limit. */
export const CI_TIMEOUT_MINUTES = 60;

export const CI_FILE_LABELS = {
    github: GITHUB_WORKFLOW,
    gitlab: `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`,
} as const;

/** Git sends these all-zero object names for new branches. */
export const ZERO_SHAS = [
    '0000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
] as const;

// mise reads this token to download release builds from GitHub above the anonymous rate limit.
export const MISE_TOKEN_ENVIRONMENT = { MISE_GITHUB_TOKEN: '${{ github.token }}' } as const;
export const CI_BASE_VARIABLE = 'GSPOT_CI_BASE';
export const CI_CACHE_FILES = [
    SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    `${DOT_GSPOT}/*lock*`,
    PYTHON_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    VERSION_PIN_FILE,
] as const;
export const CHECKOUT_OPTIONS = { 'fetch-depth': 0, 'persist-credentials': false } as const;
export const GITHUB_BASE_EXPRESSION =
    "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}";
export const GITHUB_MANUAL_CONDITION =
    "github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)";
export const GITHUB_EVENTS = { push: { branches: ['**'] }, pull_request: {}, merge_group: {} } as const;
export const GITHUB_CONCURRENCY = {
    group: "${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
    'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
} as const;
export const GITLAB_BASE_LINE = `${CI_BASE_VARIABLE}="\${CI_MERGE_REQUEST_DIFF_BASE_SHA:-\${CI_COMMIT_BEFORE_SHA:-}}"`;
export const GITLAB_RULES = [
    { if: '$CI_PIPELINE_SOURCE == "merge_request_event"', interruptible: true },
    { if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', interruptible: false },
] as const;

export const GITLAB_MANUAL_CONDITION =
    '[ "${CI_PIPELINE_SOURCE:-}" = "push" ] && [ "${CI_COMMIT_BRANCH:-}" = "${CI_DEFAULT_BRANCH:-}" ]';

export const CI_NODE = 'node@24';
export const CI_STEP_NAMES = {
    checkout: 'Check out source',
    cache: 'Restore tool caches',
    mise: 'Set up mise',
    setup: 'Set up the project',
    projectInstall: 'Install project dependencies',
    install: 'Install gspot tools',
    check: 'Check',
    manual: 'Manual checks',
} as const;

export const FROZEN_INSTALLS: Readonly<Record<string, readonly string[]>> = {
    'package-lock.json': ['npm', 'ci'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile'],
    'bun.lock': ['bun', 'install', '--frozen-lockfile'],
    'bun.lockb': ['bun', 'install', '--frozen-lockfile'],
    'uv.lock': ['uv', 'sync', '--locked'],
};

export const YARN_BERRY_INSTALL = ['yarn', 'install', '--immutable'] as const;

/** Next.js writes its route types, which a fresh clone lacks, without building the app. */
export const NEXT_TYPEGEN_LINE = 'npx --no -- next typegen';
