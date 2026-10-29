import { RUNNER_NAMES } from '#cli/config/repository/setup.ts';

export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const TRAILING_PUNCTUATION = '.,;:';

export const PATH_CHARACTERS = /^[\w./-]+$/u;

export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|]+/u;

export const COMMAND_FENCES = new Set(['sh', 'bash', 'console', 'shell', 'zsh', 'shellsession']);

export const PATH_TOKEN_SKIPS = [/^\.\.?\/?$/u, /^\d+\/\d+$/u, /^\//u] as const;

export const REMOTE_ARGUMENTS = [
    /\bgh\s+api\s+(?:"[^"\n]*"|'[^'\n]*'|[^\s`]+)/gu,
    /\b(?:Accept|Content-Type):\s*[a-z]+\/[a-z0-9!#$&^_.+-]+/giu,
] as const;

export const INLINE_LINK_TARGET = /`[^`\n]*`|\]\(<?[^\s()<>]+/gu;

export const CODE_SPAN_START = '`';

export const MISE_RUN = 'mise run ';

export const BUN_RUN = 'bun run ';

export const MISE_CONF_FILES = '.mise/conf.d/*.toml';

export const README_FILE = 'README.md';

export const LICENSE_PATH = 'LICENSE';

export const TITLE_ATTRIBUTE = 'title=';

export const EMPHASIS_MARKERS = ['**', '*'] as const;

export const RELATIVE_PATH_PREFIXES = ['./', '../'] as const;

export const RUN_COMMAND = new RegExp(
    String.raw`\b(?:${RUNNER_NAMES.join('|')}) run (?:--[\w-]+\s+)*[\w./][\w:/.-]*`,
    'gu',
);

export const MISSING_LICENSE_MESSAGE = 'The root has no LICENSE file.';

export const RULES = {
    missingTask: 'missing-task',
    missingReadme: 'missing-readme',
    missingLicense: 'missing-license',
    missingPath: 'missing-path',
} as const;
