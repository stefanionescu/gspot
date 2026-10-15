import {
    DOT_GSPOT,
    SETTINGS_FILE,
    VERSION_PIN_FILE,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

// The paths the job caches between runs: the package caches and the installed tools.
const CACHED_PATHS = [
    '~/.npm/_cacache',
    '~/.bun/install/cache',
    '~/.cache/uv',
    '~/.cache/mise',
    '~/.local/share/mise/installs',
    '~/.local/share/pnpm/store',
    '~/.yarn/berry/cache',
] as const;

const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';

/** The GitLab include named in initialization and doctor. */
const GITLAB_INCLUDE_LABEL = `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`;

/** Shared pins for generation, installation, downloads, and maintenance checks. */
const CI_PINS = {
    mise: { name: 'jdx/mise', version: '2026.10.7' },
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
const CI_TIMEOUT_MINUTES = 60;

const CI_FILE_LABELS = { github: GITHUB_WORKFLOW, gitlab: GITLAB_INCLUDE_LABEL } as const;

/** Git uses these empty-tree sentinels for newly created branches. */
const ZERO_SHAS = [
    '0000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
] as const;

const SWIFT_CONFIGURATION = 'swift';
const CI_BASE_VARIABLE = 'GSPOT_CI_BASE';
const CI_CACHE_FILES = [
    SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    `${DOT_GSPOT}/*lock*`,
    PYTHON_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    VERSION_PIN_FILE,
] as const;
const CHECKOUT_OPTIONS = { 'fetch-depth': 0, 'persist-credentials': false } as const;
const GITHUB_BASE_EXPRESSION =
    "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}";
const GITHUB_MANUAL_CONDITION =
    "github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)";
const GITHUB_EVENTS = { push: { branches: ['**'] }, pull_request: {}, merge_group: {} } as const;
const GITHUB_CONCURRENCY = {
    group: "${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
    'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
} as const;
const GITLAB_BASE_LINE = `${CI_BASE_VARIABLE}="\${CI_MERGE_REQUEST_DIFF_BASE_SHA:-\${CI_COMMIT_BEFORE_SHA:-}}"`;
const GITLAB_RULES = [
    { if: '$CI_PIPELINE_SOURCE == "merge_request_event"', interruptible: true },
    { if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', interruptible: false },
] as const;

const GITLAB_MANUAL_CONDITION =
    '[ "${CI_PIPELINE_SOURCE:-}" = "push" ] && [ "${CI_COMMIT_BRANCH:-}" = "${CI_DEFAULT_BRANCH:-}" ]';

export {
    CI_PINS,
    ZERO_SHAS,
    CACHED_PATHS,
    GITLAB_RULES,
    GITHUB_EVENTS,
    CI_FILE_LABELS,
    CI_CACHE_FILES,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    CI_BASE_VARIABLE,
    CHECKOUT_OPTIONS,
    GITLAB_BASE_LINE,
    CI_TIMEOUT_MINUTES,
    GITHUB_CONCURRENCY,
    SWIFT_CONFIGURATION,
    GITHUB_BASE_EXPRESSION,
    GITHUB_MANUAL_CONDITION,
    GITLAB_MANUAL_CONDITION,
};
