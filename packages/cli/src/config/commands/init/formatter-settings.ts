export const RUFF_SETTINGS_FILES = ['.ruff.toml', 'ruff.toml', 'pyproject.toml'] as const;

export const EDITORCONFIG_FILE = '.editorconfig';

export const EDITORCONFIG_COMMENT = /^\s*[#;]/u;

export const EDITORCONFIG_SECTION = /^\s*\[(.+)\]\s*$/u;

export const PRETTIER_FILE_FORMATS: Readonly<Record<string, 'yaml' | 'json' | 'toml'>> = {
    '.prettierrc': 'yaml',
    '.prettierrc.yml': 'yaml',
    '.prettierrc.yaml': 'yaml',
    '.prettierrc.json': 'json',
    '.prettierrc.json5': 'yaml',
    '.prettierrc.toml': 'toml',
};

export const PRETTIER_SCRIPT_FILE = /\.[cm]?[jt]s$/u;

export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false } as const;
