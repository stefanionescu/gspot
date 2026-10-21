import { PACKAGE_MANAGERS } from '#cli/config/repository/package-manager.ts';

export const LINT_FOLDERS = ['quality', 'lint', 'linting', '.qlty', 'code-quality'] as const;

export const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', 'CONVENTIONS.md'] as const;

export const RULE_FOLDERS = ['rules', '.rules', '.cursor/rules', 'docs/rules', '.claude/rules'] as const;

// The words in a CI job name that say it lints.
export const LINT_WORDS = new Set(['lint', 'quality', 'gspot']);

// Two-word lint commands.
export const LINT_PAIRS = new Set(['gspot check', 'biome check', 'ruff check']);

export const FOREIGN_CI_FILES = new Set([
    'Jenkinsfile',
    'bitbucket-pipelines.yml',
    '.circleci/config.yml',
    'azure-pipelines.yml',
    '.buildkite/pipeline.yml',
]);

// In "<runner> run <task>", the task sits two words after the runner.
export const TASK_AFTER_RUN = 2;

export const RUNNER_NAMES: readonly string[] = [...PACKAGE_MANAGERS, 'mise'];

export const INI_EXTENSIONS: ReadonlySet<string> = new Set(['.ini', '.cfg']);

export const GITLAB_CI_FILE = '.gitlab-ci.yml';

export const GITHUB_WORKFLOWS_FOLDER = '.github/workflows/';

export const GITLAB_CI_FOLDER = '.gitlab/ci/';

export const YAML_EXTENSIONS: readonly string[] = ['.yml', '.yaml'];

export const COMMAND_SEPARATORS = /[\s;&|]+/u;

export const RUN_WORD = 'run';

export const LINT_TASK = 'lint';

export const KEPT_DOT_FILE = '.gitkeep';

export const JOB_NAME_SEPARATORS = /[-_: ]/u;
