import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const WRITER_LOCK_FILE = `${GSPOT_PATHS.state}/writer.lock`;

export const TOML_EXTENSION = '.toml';

export const EMPTY_JSON_TEXT = '{}\n';

export const TRAILING_BLANK_LINE = /(\r?\n)\r?\n$/u;

export const TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/u;
