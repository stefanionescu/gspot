import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const CACHED_PATHS = {
    linux: {
        mise: ['~/.cache/mise/downloads-cas'],
        npm: ['~/.npm/_cacache'],
        pnpm: ['~/.local/share/pnpm/store'],
        yarn: ['~/.cache/yarn', '~/.yarn/berry/cache'],
        bun: ['~/.bun/install/cache'],
        uv: ['~/.cache/uv'],
    },
    macos: {
        mise: ['~/Library/Caches/mise/downloads-cas'],
        npm: ['~/.npm/_cacache'],
        pnpm: ['~/Library/pnpm/store'],
        yarn: ['~/Library/Caches/Yarn', '~/.yarn/berry/cache'],
        bun: ['~/.bun/install/cache'],
        uv: ['~/.cache/uv'],
    },
    windows: {
        mise: ['${{ runner.temp }}/mise/downloads-cas'],
        npm: ['~/AppData/Local/npm-cache/_cacache'],
        pnpm: ['~/AppData/Local/pnpm/store'],
        yarn: ['~/AppData/Local/Yarn/Cache', '~/AppData/Local/Yarn/Berry/cache'],
        bun: ['~/.bun/install/cache'],
        uv: ['~/AppData/Local/uv/cache'],
    },
} as const;

export const GITHUB_WORKFLOW = '.github/workflows/gspot.yml';

export const GITLAB_WORKFLOW = '.gitlab/ci/gspot.yml';

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
        restoreCache: {
            name: 'actions/cache/restore',
            sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            version: 'v6.1.0',
        },
        saveCache: {
            name: 'actions/cache/save',
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

export const CI_TIMEOUT_MINUTES = 60;

export const MISE_TOKEN_ENVIRONMENT = { MISE_GITHUB_TOKEN: '${{ github.token }}' } as const;

export const CI_BASE_VARIABLE = 'GSPOT_CI_BASE';

export const CI_CACHE_FILES = [
    GSPOT_PATHS.npmProject,
    `${GSPOT_FOLDER}/*lock*`,
    GSPOT_PATHS.pythonProject,
    GSPOT_PATHS.miseProject,
] as const;

export const CI_JOB_NAME = 'lint';

export const CI_CACHE_STEP = 'cache';

export const CI_CACHE_PREFIX = 'gspot-${{ runner.os }}-${{ runner.arch }}-';

export const CI_CACHE_MISS_CONDITION = `steps.${CI_CACHE_STEP}.outputs.cache-hit != 'true'`;

export const CI_CACHE_SAVED_KEY = `\${{ steps.${CI_CACHE_STEP}.outputs.cache-primary-key }}`;

export const CHECKOUT_OPTIONS = { 'fetch-depth': 0, 'persist-credentials': false } as const;

export const GITHUB_BASE_EXPRESSION =
    "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}";

export const GITHUB_PUSH_CONDITION =
    "github.event_name != 'push' || github.ref_name == github.event.repository.default_branch";

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

export const CI_NODE = 'node@24.20.0';

export const CI_STEP_NAMES = {
    checkout: 'Check out source',
    restoreCache: 'Restore caches',
    mise: 'Set up mise',
    setup: 'Set up the project',
    projectInstall: 'Install project dependencies',
    install: 'Install gspot tools',
    saveCache: 'Save caches',
    check: 'Lint',
    gspot: 'Install gspot',
} as const;

export const FROZEN_INSTALLS = {
    'package-lock.json': ['npm', 'ci'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile'],
    'bun.lock': ['bun', 'install', '--frozen-lockfile'],
    'bun.lockb': ['bun', 'install', '--frozen-lockfile'],
    'uv.lock': ['uv', 'sync', '--locked'],
} as const satisfies Record<string, readonly string[]>;

export const YARN_BERRY_INSTALL = ['yarn', 'install', '--immutable'] as const;

export const NEXT_TYPEGEN_LINE = 'npx --no -- next typegen';

export const CI_DIFF_LINES = ['git add --intent-to-add -- .gspot', 'git diff --exit-code -- .gspot'] as const;

export const CI_INSTALL_COMMAND = 'gspot install';

export const CI_CHECK_COMMAND = `gspot check --changed "\${${CI_BASE_VARIABLE}}"`;

export const GITHUB_EXPRESSION_START = '${{';

export const GITHUB_EXPRESSION_MESSAGE =
    'GitHub expands "${{" in a workflow command before the shell runs it. Remove "${{" from ci.setup_command and from the scope paths.';

export const AUTO_LF_ATTRIBUTES = ['text=auto', 'eol=lf'] as const;

export const ATTRIBUTE_QUOTED_CHARACTERS = /[\s"]/u;

export const ATTRIBUTE_GLOB_CHARACTERS = /[\\*?[]/gu;

export const LF_ATTRIBUTES = 'text eol=lf';

export const GIT_ATTRIBUTES_BLOCK = `${GSPOT_FOLDER}/** linguist-generated
${GSPOT_FOLDER}/** ${LF_ATTRIBUTES}
.gitignore ${LF_ATTRIBUTES}
.gitattributes ${LF_ATTRIBUTES}`;

export const TOOL_FOLDER_IGNORES = ['node_modules/', '.venv/', 'vale/'] as const;

export const NPM_TOOL_PROJECT = { name: 'tools', private: true } as const;

export const JSON_EXTENSIONS = new Set(['.json']);

export const SLASH_COMMENT_EXTENSIONS = new Set(['.mjs', '.jsonc']);

export const SLASH_COMMENT_FILES = new Set(['pyrightconfig.json']);

export const GENERATED_HEADER_MARK = 'Generated by gspot';
export const GENERATED_HEADER_TEXT = `${GENERATED_HEADER_MARK}. Do not edit this file; change gspot.toml, then run gspot apply.`;

export const CHECK_HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const LFS_HOOKS = ['pre-push', 'post-checkout', 'post-commit', 'post-merge'] as const;

export const PUSH_INPUT_SAVE = 'input=$(cat)';

export const PUSH_INPUT_REPLAY = String.raw`printf '%s\n' "$input" | `;

export const LFS_GUARD_PREFIX = 'command -v git-lfs >/dev/null 2>&1 || ';

export const HOOK_CHECKS = {
    'pre-commit': { arguments: 'check --hook pre-commit', stages: ['commit'] },
    'pre-push': { arguments: 'check --hook pre-push -- "$@"', stages: ['commit', 'push'] },
    'commit-msg': { arguments: 'check --hook commit-msg -- "$1"', stages: ['message'] },
} as const satisfies Record<(typeof CHECK_HOOKS)[number], { arguments: string; stages: readonly string[] }>;

export const HOOK_SHEBANG = '#!/bin/sh';

export const COMMIT_MESSAGE_PATH_LINES = [
    'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
    'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
    'set -- "$message"',
] as const;

export const LFS_MISSING_GUARD = `${LFS_GUARD_PREFIX}{ echo 'This repository uses Git LFS. Install git-lfs, then run git lfs install --skip-repo.' >&2; exit 2; }`;

export const DIFF_CONTEXT_LINES = 3;

export const ON_DISK_LABEL = 'on disk';

export const BLOCK_ON_DISK_LABEL = 'managed block on disk';

export const RULES_HEADING = '# Rules';

export const FIRST_READ: readonly string[] = [
    'general/engineering/rules/WORKING.md',
    'general/prose/rules/WRITING.md',
    'general/engineering/rules/TALKING.md',
];

export const ALL_LEVEL_MARKER = '<!-- level: all -->';

export const BLANK_LINE = '\n\n';

export const RULE_OPENING_PREFIX = 'Read this rule ';

export const MARKDOWN_HEADING = /^(#{1,5}) /u;

export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;

export const COMMANDS_HEADING = '## Commands';

export const GENERATED_FILES_HEADING = '## Generated files';

export const GENERATED_FILES_LINE =
    '`.gitattributes` marks each file that gspot writes `linguist-generated`, in the block between the gspot markers.';

export const EDIT_KEYS_LINE = 'You can edit the other keys of that file.';

export const FIRST_READ_LINE = 'Read these rules first:';

export const RULE_INDEX_LINES = [
    'Read a rule below when its sentence fits your task.',
    'A rule marked `in <folder>/` applies only to files in that folder.',
    'A more specific rule wins over a general one.',
] as const;

export const FIX_APPLY_MESSAGE = 'Fix that, then run gspot apply.';

export const MANAGED_KEYS_NOTE =
    'Keys that gspot no longer manages stay in your files. Review shared config files after removing a configuration.';

export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const STALE_LOCKFILE_NOTE =
    'The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.';

export const HOOKS_CHANGED_NOTE = 'Git hooks changed. Run gspot install.';

export const GENERATED_FILE_NOUN = 'generated file';

export const CHANGE_LABEL_WIDTH = 9;

export const TOOL_PROJECT_FILES: readonly string[] = [
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
    GSPOT_PATHS.miseProject,
];

export const SEMGREP_RULE_PACK_FILE = 'semgrep.yml';

export const CONFIG_FILE_REFERENCE = /(?:['"]\.\/|\bnew\s+URL\(\s*['"])(?<path>[^'"]+)['"]/gu;

export const TS_EXTENSION = '.ts';

export const GIXY_CHECK = 'nginx/gixy';

export const ANSIBLE_LINT_ALWAYS_OFF = ['experimental'] as const;

export const ANSIBLE_LINT_CHECK = 'ansible/ansible-lint';

export const CONFIG_FILE_SCOPES_FOLDER = 'scopes';

export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);

export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;

export const GSPOT_FOLDER_PATTERNS = [`${GSPOT_FOLDER}/**`] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out',
    lockfiles: 'Lockfiles',
} as const;

export const TARGET_PLACEHOLDER = /\{target_(?:json|module)\}/gu;

export const TARGET_MODULE_PLACEHOLDER = '{target_module}';

export const OVERRIDES_PLACEHOLDER = '{overrides_json}';
