import { STATE_PATH } from '#cli/config/gspot-paths.ts';

export const WRITER_LOCK_FILE = `${STATE_PATH}/writer.lock`;
export const TOML_EXTENSION = '.toml';
export const JSON_SETTINGS_EXTENSIONS = ['.json', '.jsonc'] as const;
export const EMPTY_JSON_TEXT = '{}\n';
