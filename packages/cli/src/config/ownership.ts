import { STATE_PATH } from '#cli/config/system/locations.ts';

export const WRITER_LOCK_FILE = `${STATE_PATH}/writer.lock`;
export const TOML_EXTENSION = '.toml';
export const JSON_EDIT_EXTENSIONS = ['.json', '.jsonc'] as const;
export const EMPTY_JSON_TEXT = '{}\n';
