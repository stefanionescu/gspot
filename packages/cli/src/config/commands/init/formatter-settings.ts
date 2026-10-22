/** The settings files where Ruff keeps its quote style, in the order Ruff reads them. */
export const RUFF_SETTINGS_FILES = ['.ruff.toml', 'ruff.toml', 'pyproject.toml'] as const;

export const EDITORCONFIG_FILE = '.editorconfig';

export const EDITORCONFIG_COMMENT = /^\s*[#;]/u;

export const EDITORCONFIG_SECTION = /^\s*\[(.+)\]\s*$/u;

export const PRETTIER_JSON_FILES = ['.prettierrc', '.prettierrc.json'] as const;

export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false } as const;

export const FORMAT_CONFIGURATION = 'format';
