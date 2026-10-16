import { STATE_DIRECTORY } from '#cli/config/system/locations.ts';

export const WRITER_LOCK_FILE = `${STATE_DIRECTORY}/writer.lock`;
export const TOML_EXTENSION = '.toml';
export const JSON_EDIT_EXTENSIONS = ['.json', '.jsonc'] as const;
export const EMPTY_JSON_TEXT = '{}\n';
