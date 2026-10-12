import { STATE_DIRECTORY } from '#cli/config/system/locations.ts';

export const OWNED_KINDS = ['tool_file', 'block', 'keys', 'settings', 'pin', 'hook', 'lock'] as const;
export const ADOPTED_KINDS = new Set<(typeof OWNED_KINDS)[number]>(['tool_file', 'hook', 'pin', 'lock']);
export const OWNERSHIP_JSON_INDENT = 2;
export const MANAGED_KEYS_FORMATS = ['toml', 'json'] as const;

export const OWNERSHIP_LOG_VERSION = 1;
export const OWNERSHIP_LOG_FILE = `${STATE_DIRECTORY}/ownership.json`;
export const WRITER_LOCK_FILE = `${STATE_DIRECTORY}/writer.lock`;
export const SHA256_HEX = /^[a-f0-9]{64}$/u;
export const TOML_EXTENSION = '.toml';
export const JSON_EDIT_EXTENSIONS = ['.json', '.jsonc'] as const;
export const EMPTY_JSON_TEXT = '{}\n';
