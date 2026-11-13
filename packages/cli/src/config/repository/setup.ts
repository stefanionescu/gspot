import { AGENTS_FILE } from '#cli/config/parsers/formats.ts';
import { PACKAGE_MANAGERS } from '#cli/config/repository/projects.ts';
import { MISE_PROGRAM } from '#cli/config/system.ts';

// config conflicts
export const INI_EXTENSIONS: ReadonlySet<string> = new Set(['.ini', '.cfg']);
export const JSON_EXTENSION = '.json';
export const TOML_EXTENSION = '.toml';
export const YAML_EXTENSIONS: readonly string[] = ['.yml', '.yaml'];

// setup scan
export const AGENT_FILES = ['CLAUDE.md', AGENTS_FILE, 'GEMINI.md', '.cursorrules', 'CONVENTIONS.md'] as const;
export const CI_PROVIDERS = ['github', 'gitlab'] as const;
export const FOREIGN_CI_FILES = new Set([
    'Jenkinsfile',
    'bitbucket-pipelines.yml',
    '.circleci/config.yml',
    'azure-pipelines.yml',
    '.buildkite/pipeline.yml',
]);
export const HUSKY_PATH = '.husky';
export const FOREIGN_HOOK_FOLDERS = ['.githooks', HUSKY_PATH, '.git-hooks'] as const;
export const GITHUB_WORKFLOWS_FOLDER = '.github/workflows/';
export const GITLAB_CI_FILE = '.gitlab-ci.yml';
export const GITLAB_CI_FOLDER = '.gitlab/ci/';
export const HOOKS_PATH_SETTING = 'core.hooksPath';
export const HOOK_SHEBANG = '#!/bin/sh';
export const KEPT_DOT_FILE = '.gitkeep';
export const LEFTHOOK_EXTENSIONS = ['yml', 'yaml', 'toml', 'json', 'jsonc'] as const;
export const LEFTHOOK_NAMES = ['lefthook', 'lefthook-local'] as const;
export const LEFTHOOK_PREFIXES = ['', '.', '.config/'] as const;
export const LFS_GUARD_PREFIX = 'command -v git-lfs >/dev/null 2>&1 || ';
export const LFS_HOOKS = ['pre-push', 'post-checkout', 'post-commit', 'post-merge'] as const;
export const LFS_PUSH_CALLS: ReadonlySet<string> = new Set([
    'git lfs pre-push "$@"',
    'git lfs push --stdin "$@"',
    'git lfs push --stdin $*',
]);
export const LINT_FOLDERS = ['quality', 'lint', 'linting', '.qlty', 'code-quality'] as const;
export const ORIGIN_URL_SETTING = 'remote.origin.url';
export const PRE_COMMIT_FILE = '.pre-commit-config.yaml';
export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;
export const REMOTE_URL_USER = /^[^@/]+@/u;
export const RULE_FOLDERS = ['rules', '.rules', '.cursor/rules', 'docs/rules', '.claude/rules'] as const;
export const SAMPLE_HOOK_SUFFIX = '.sample';
export const SIMPLE_GIT_HOOKS_KEY = 'simple-git-hooks';

// lint commands
export const BIN_FOLDER_PREFIX = /^.*node_modules\/\.bin\//u;
export const HOOK_FOLDER_PATH = new RegExp(
    `^(?:${FOREIGN_HOOK_FOLDERS.map((folder) => folder.replaceAll('.', '[.]')).join('|')})/`,
    'u',
);
export const MISE_TASK_FOLDERS = [
    'mise-tasks',
    '.mise-tasks',
    'mise/tasks',
    '.mise/tasks',
    '.config/mise/tasks',
] as const;
export const MISE_TASK_FOLDER = new RegExp(
    `^(?:${MISE_TASK_FOLDERS.map((folder) => folder.replaceAll('.', '[.]')).join('|')})/`,
    'u',
);
export const COMMAND_FILES = [
    { path: /(?:^|\/)package\.json$/u, source: 'script' },
    { path: MISE_TASK_FOLDER, source: 'mise-task' },
    { path: /^\.?mise\.toml$/u, source: 'mise-task' },
    { path: /(?:^|\/)(?:\.lintstagedrc(?:\..+)?|lint-staged\.config\..+)$/u, source: 'lint-staged' },
    { path: /^\.pre-commit-config\.yaml$/u, source: 'pre-commit' },
    { path: HOOK_FOLDER_PATH, source: 'hook' },
    { path: /^(?:\.config\/|\.)?lefthook(?:-local)?\.(?:yml|yaml|toml|json)$/u, source: 'hook' },
    { path: /^(?:\.gitlab-ci\.yml|\.gitlab\/ci\/.+\.ya?ml|\.github\/workflows\/.+\.ya?ml)$/u, source: 'ci' },
] as const;
export const COMMAND_KEYS: ReadonlySet<string> = new Set(['run', 'script', 'before_script', 'after_script']);
export const COMMAND_SEPARATORS = /[\s;&|()]+/u;
export const COMMENT_LINE = /^\s*#/u;
export const FORMAT_SCRIPT = /^(?:format|fmt)(?::.*)?$/u;
export const HOOK_ID_SEPARATOR = /-/gu;
export const LINT_COMMAND_FIXES = {
    script: 'Replace the lint and format parts of this script with gspot check.',
    'mise-task': 'Replace the lint and format parts of this task with gspot check.',
    ci: 'gspot check installs and runs this tool. Run gspot check in CI instead of this line.',
    hook: 'Delete this line: the hooks of gspot run the checks.',
    'lint-staged': 'Delete this entry: the hooks of gspot run the checks.',
    'pre-commit': 'Delete this entry: the hooks of gspot run the checks.',
    dependency: 'Delete this line: gspot installs its own copy in .gspot/.',
    settings: 'Delete these settings: gspot runs a tool that covers this one.',
} as const;
export const LINT_COMMAND_NAMES = {
    script: 'This script',
    'mise-task': 'This mise task',
    ci: 'This CI step',
    hook: 'This hook',
    'lint-staged': 'This lint-staged entry',
    'pre-commit': 'This pre-commit entry',
    dependency: 'This devDependency',
    settings: 'This section',
} as const;
export const LINT_PACKAGE = /eslint|stylelint|prettier/u;
export const LINT_STAGED_KEY = 'lint-staged';
export const MISE_TASKS_KEY = 'tasks';
export const OTHER_FORMATTER_MESSAGE =
    'This script also formats these files. To keep it, run gspot ignore format/prettier --reason "<why>".';
export const OVERLAPPING_TOOLS = [
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
export const PRE_COMMIT_TOOL = 'pre-commit';
export const PYGREP_LANGUAGE = 'pygrep';
export const QUOTE_MARK = /["'`,]/gu;
export const RUNNER_NAMES: readonly string[] = [...PACKAGE_MANAGERS, MISE_PROGRAM];
export const RUN_WORD = 'run';
export const TASK_AFTER_RUN = 2;
export const TASK_NAME_SEPARATOR = ':';

// scopes
const ALL_FILES_GLOB = '**/*';
export const EVERY_FILE_GLOBS = ['**', ALL_FILES_GLOB] as const;
export const ROOT_SCOPE_MARK = '.';
