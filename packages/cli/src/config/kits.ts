// The literal values kits reads: names, patterns, limits, and tables.

export const STATE_DIRECTORY = '.gspot/state';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const MANIFEST_CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;
export const MAX_EXIT_CODE = 255;
export const SENTENCE_MIN = 12;
export const SHEBANG_TAG = 'shebang:';
export const GLOB_CHARS = /[*?{]/u;

/** The fields two kits may set differently when both declare one setting. */
export const SETTING_DEFAULT_FIELDS = new Set(['default', 'default_all', 'detect']);

export const FORMAT_PREFIX = 'format.';

// The pin fields a manifest may leave out, copied when declared.
export const OPTIONAL_TOOL_KEYS = [
    'platforms',
    'version',
    'floor',
    'provider',
    'version_command',
    'version_exit_code',
    'version_pattern',
    'crash_pattern',
    'rule_url',
    'suppression',
    'env',
    'replace',
    'query_packs',
    'prettier',
] as const;

/** The platforms a tool pin may name as having a build: an operating system alone, or one with an architecture. */
export const TOOL_PLATFORMS = [
    'macos',
    'macos-x64',
    'macos-arm64',
    'linux',
    'linux-x64',
    'linux-arm64',
    'windows',
    'windows-x64',
    'windows-arm64',
] as const;

export const CONFIGURATION_DIRECTORY = '.gspot/config';

export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';

export const PRIVATE_PATHS = [`${NODE_MODULES_DIRECTORY}/`, `${PYTHON_ENVIRONMENT_DIRECTORY}/`, `${STATE_DIRECTORY}/`];
