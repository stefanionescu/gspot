import { RUNNER_NAMES } from '#cli/config/repository/existing/tools.ts';

export const MISE_TASKS_FOLDER = '.mise/tasks';

export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const TRAILING_PUNCTUATION = '.,;:';

export const PATH_CHARS = /^[\w./-]+$/u;

export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|]+/u;

export const COMMAND_FENCES = new Set(['sh', 'bash', 'console']);

export const PATH_TOKEN_SKIPS = [/^\.\.?\/?$/u, /^\d+\/\d+$/u, /^\//u] as const;

export const MISE_RUN = 'mise run ';

export const BUN_RUN = 'bun run ';

export const MISE_CONF_FILES = '.mise/conf.d/*.toml';

export const README_FILE = 'README.md';

export const LICENSE_PATH = 'LICENSE';

export const TITLE_ATTRIBUTE = 'title=';

export const EMPHASIS_MARKERS = ['**', '*'] as const;

export const RELATIVE_PATH_PREFIXES = ['./', '../'] as const;

export const RUN_COMMAND = new RegExp(
    String.raw`\b(?:${RUNNER_NAMES.join('|')}) run (?:--[\w-]+\s+)*[\w][\w:.-]*`,
    'gu',
);
