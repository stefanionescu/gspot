import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PACKAGE_MANAGERS } from '#cli/config/repository/javascript.ts';

export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_PATHS.nodeModules,
    python: GSPOT_PATHS.pythonEnvironment,
    vale: GSPOT_PATHS.valePackages,
} as const;

export const OWNER_WRITABLE_FILE = 0o644;

export const AGENTS_FILE = 'AGENTS.md';

export const LFS_HOOKS = ['pre-push', 'post-checkout', 'post-commit', 'post-merge'] as const;

export const LFS_GUARD_PREFIX = 'command -v git-lfs >/dev/null 2>&1 || ';

export const HOOK_SHEBANG = '#!/bin/sh';

export const ESLINT_MANIFEST_TOOL = 'eslint';

export const INI_EXTENSIONS: ReadonlySet<string> = new Set(['.ini', '.cfg']);

export const JSON_EXTENSION = '.json';

const ALL_FILES_GLOB = '**/*';

export const EVERY_FILE_GLOBS = ['**', ALL_FILES_GLOB] as const;

export const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', 'CONVENTIONS.md'] as const;

export const RULE_FOLDERS = ['rules', '.rules', '.cursor/rules', 'docs/rules', '.claude/rules'] as const;

export const FOREIGN_CI_FILES = new Set([
    'Jenkinsfile',
    'bitbucket-pipelines.yml',
    '.circleci/config.yml',
    'azure-pipelines.yml',
    '.buildkite/pipeline.yml',
]);

export const TASK_AFTER_RUN = 2;

export const RUNNER_NAMES: readonly string[] = [...PACKAGE_MANAGERS, 'mise'];

export const GITLAB_CI_FILE = '.gitlab-ci.yml';

export const GITHUB_WORKFLOWS_FOLDER = '.github/workflows/';

export const GITLAB_CI_FOLDER = '.gitlab/ci/';

export const COMMAND_SEPARATORS = /[\s;&|()]+/u;

export const BIN_FOLDER_PREFIX = /^.*node_modules\/\.bin\//u;

export const LINT_PACKAGE = /eslint|stylelint|prettier/u;

export const QUOTE_MARK = /["'`,]/gu;

export const COMMENT_LINE = /^\s*#/u;

export const HOOK_ID_SEPARATOR = /-/gu;

export const COMMAND_KEYS: ReadonlySet<string> = new Set(['run', 'script', 'before_script', 'after_script']);

export const PRE_COMMIT_KEYS: ReadonlySet<string> = new Set(['id', 'entry']);

export const PRE_COMMIT_TOOL = 'pre-commit';

export const LINT_STAGED_KEY = 'lint-staged';

export const HOOK_FOLDER_PATH = /^(?:\.githooks|\.husky|\.git-hooks)\//u;

export const COMMAND_FILES = [
    { path: /(?:^|\/)package\.json$/u, source: 'script' },
    { path: /(?:^|\/)(?:\.lintstagedrc(?:\..+)?|lint-staged\.config\..+)$/u, source: 'lint-staged' },
    { path: /^\.pre-commit-config\.yaml$/u, source: 'pre-commit' },
    { path: HOOK_FOLDER_PATH, source: 'hook' },
    { path: /^(?:\.config\/|\.)?lefthook(?:-local)?\.(?:yml|yaml|toml|json)$/u, source: 'hook' },
    { path: /^(?:\.gitlab-ci\.yml|\.gitlab\/ci\/.+\.ya?ml|\.github\/workflows\/.+\.ya?ml)$/u, source: 'ci' },
] as const;

export const LINT_COMMAND_NAMES = {
    script: 'This script',
    ci: 'This CI step',
    hook: 'This hook',
    'lint-staged': 'This lint-staged entry',
    'pre-commit': 'This pre-commit entry',
    dependency: 'This devDependency',
    settings: 'This section',
} as const;

export const LINT_COMMAND_FIXES = {
    script: 'Replace this command with gspot check.',
    ci: 'Replace this line with gspot check.',
    hook: 'Delete this line: the hooks of gspot run the checks.',
    'lint-staged': 'Delete this entry: the hooks of gspot run the checks.',
    'pre-commit': 'Delete this entry: the hooks of gspot run the checks.',
    dependency: 'Delete this line: gspot installs its own copy in .gspot/.',
    settings: 'Delete these settings: gspot runs a tool that covers this one.',
} as const;

export const SECOND_TOOLS = [
    { name: 'black', owner: 'ruff', files: [], sections: [['pyproject.toml', 'tool.black']] },
    {
        name: 'flake8',
        owner: 'ruff',
        files: ['.flake8'],
        sections: [
            ['setup.cfg', 'flake8'],
            ['tox.ini', 'flake8'],
        ],
    },
    {
        name: 'isort',
        owner: 'ruff',
        files: ['.isort.cfg'],
        sections: [
            ['pyproject.toml', 'tool.isort'],
            ['setup.cfg', 'isort'],
            ['tox.ini', 'isort'],
        ],
    },
    {
        name: 'mypy',
        owner: 'basedpyright',
        files: ['mypy.ini', '.mypy.ini'],
        sections: [
            ['pyproject.toml', 'tool.mypy'],
            ['setup.cfg', 'mypy'],
        ],
    },
    { name: 'pyright', owner: 'basedpyright', files: [], sections: [] },
    { name: 'markdownlint', owner: 'markdownlint-cli2', files: [], sections: [] },
] as const;

export const RUN_WORD = 'run';

export const KEPT_DOT_FILE = '.gitkeep';

export const HUSKY_PATH = '.husky';

export const SIMPLE_GIT_HOOKS_KEY = 'simple-git-hooks';

export const LEFTHOOK_NAMES = ['lefthook', 'lefthook-local'] as const;

export const LEFTHOOK_EXTENSIONS = ['yml', 'yaml', 'toml', 'json', 'jsonc'] as const;

export const LEFTHOOK_PREFIXES = ['', '.', '.config/'] as const;

export const PRE_COMMIT_FILE = '.pre-commit-config.yaml';

export const FOREIGN_HOOK_FOLDERS = ['.githooks', HUSKY_PATH, '.git-hooks'] as const;

export const HOOKS_PATH_SETTING = 'core.hooksPath';

export const LINT_FOLDERS = ['quality', 'lint', 'linting', '.qlty', 'code-quality'] as const;

export const YAML_EXTENSIONS: readonly string[] = ['.yml', '.yaml'];

export const SAMPLE_HOOK_SUFFIX = '.sample';

export const LFS_PUSH_CALLS: ReadonlySet<string> = new Set([
    'git lfs pre-push "$@"',
    'git lfs push --stdin "$@"',
    'git lfs push --stdin $*',
]);

export const TOML_EXTENSION = '.toml';

export const EMPTY_JSON_TEXT = '{}\n';

export const TRAILING_BLANK_LINE = /(\r?\n)\r?\n$/u;

export const TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/u;

export const TEMPORARY_FILE_NAME = /^\.gspot-(?:(?<pid>[1-9]\d{0,8})-)?[\da-f-]{36}\.tmp$/u;

export const VALE_TEMPORARY_NAME = /^vale-(?:(?<pid>[1-9]\d{0,8})-)?[a-zA-Z0-9]{6}$/u;

export const PRETTIER_ROOT_FILES = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.ts',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
    '.prettierrc.toml',
] as const;

export const IGNORE_FILES = [
    { file: '.prettierignore', tool: 'prettier', check: 'format/prettier' },
    { file: '.eslintignore', tool: 'eslint', check: 'javascript/eslint' },
] as const;

export const RUFF_CHECK_ID = 'python/ruff';

export const RUFF_CHECK_IDS = [RUFF_CHECK_ID, 'python/ruff-format'] as const;

export const RUFF_FORMAT_KEYS = ['line-length', 'indent-width'] as const;

export const RUFF_STYLE_KEYS = ['indent-style', 'quote-style'] as const;

export const COMMITLINT_CHECK_ID = 'commits/commitlint';

export const MARKDOWNLINT_CHECK_ID = 'markdown/markdownlint';

export const COMMENT_PATTERN = /^#/u;

export const LEADING_SLASH = /^\//u;

export const COMMITLINT_CONFIG_PATH = /^(?:\.commitlintrc|commitlint\.config)/u;

export const EMPTY_CARRY = { tools: {}, ignore: [], rows: [] } as const;

export const IGNORE_REASON_START = 'Carried over from';

export const REASON_PLACEHOLDER = '"<why>"';

export const LIMIT_RULE = /max/u;

export const FIRST_NUMBER = /\d+/u;

export const PRINT_TIMEOUT_SECONDS = 60;

export const PRETTIER_OVERRIDES_KEY = 'overrides';

export const PRETTIER_EXCLUDE_KEY = 'excludeFiles';

export const RUFF_ALL_SELECTOR = /\bALL\b/u;

export const RUFF_ANY_PREFIX = '[A-Z]+';

export const UNREADABLE_CONFIG_MESSAGE = 'the whole file, which gspot could not read';

export const UNREAD_CONFIG_MESSAGE = 'its settings, because init reads this tool only at the root and at a scope';

export const CARRIED_TOOLS: ReadonlySet<string> = new Set([
    'prettier',
    'editorconfig-checker',
    'ruff',
    'markdownlint-cli2',
    'commitlint',
]);

export const MARKDOWNLINT_TARGET = `${GSPOT_PATHS.configurations}/language/markdown/markdownlint.jsonc`;

export const COMMITLINT_TARGET = `${GSPOT_PATHS.configurations}/general/commits/commitlint.json`;

export const MARKDOWNLINT_RUNNER_FILE = /cli2/u;

export const MARKDOWNLINT_CONFIG_FILES = [
    '.markdownlint.json',
    '.markdownlint.jsonc',
    '.markdownlint.yaml',
    '.markdownlint.yml',
    '.markdownlint-cli2.jsonc',
    '.markdownlint-cli2.yaml',
] as const;

export const CARRY_HEADING = 'what init carries from the configs it replaces';

export const CARRY_GROUPS = {
    carried: 'carried over',
    differing: 'other options, to set after init',
    commandChecks: 'keep with a command check of your own',
    dropped: 'dropped',
} as const;

export const CARRY_ROW_START = {
    covered: 0,
    carried: [],
    differing: [],
    reasons: [],
    commandChecks: [],
    dropped: [],
} as const;

export const RULE_PRINT_FLAG = '--print-config';

export const NOT_COMPARED_MESSAGE = 'its rules, because a tool could not print them';

export const SCAN_FIRST_MESSAGE = 'its rules; gspot scan compares them before init';

export const PRINTED_RULE_TOOLS = [
    {
        tool: 'eslint',
        check: 'javascript/eslint',
        sample: /(?:^|\/)[^./][^/]*(?<!\.config)\.[cm]?[jt]sx?$/u,
        hasSeverity: true,
        gspotArguments: [],
    },
    {
        tool: 'stylelint',
        check: 'css/stylelint',
        sample: /\.css$/u,
        hasSeverity: false,
        gspotArguments: ['--config', '.gspot/configurations/language/css/stylelint.json', '--config-basedir', '.gspot'],
    },
] as const;
