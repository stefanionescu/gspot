import { YARN_SETTINGS } from '#cli/config/system/locations.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

/** Documents can name standard outputs before you enable their generating setting. */
export const OPTIONAL_GENERATED_PATHS = [GITHUB_WORKFLOW, GITLAB_WORKFLOW, YARN_SETTINGS] as const;

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
