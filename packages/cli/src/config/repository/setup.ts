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

export const LINT_WORDS = new Set(['lint', 'quality', 'gspot']);

export const LINT_PAIRS = new Set(['gspot check', 'biome check', 'ruff check']);

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

export const COMMAND_SEPARATORS = /[\s;&|]+/u;

export const RUN_WORD = 'run';

export const LINT_TASK = 'lint';

export const KEPT_DOT_FILE = '.gitkeep';

export const JOB_NAME_SEPARATORS = /[-_: ]/u;

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
