import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

/** The rule assets within each shipped configuration. */
export const CONFIGURATION_RULES_FOLDER = 'rules';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const MANIFEST_CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;

/** The fields two configurations may set differently when both declare one setting. */
export const SETTING_DEFAULT_FIELDS = new Set(['default', 'default_all']);

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

export const SENTENCE_MIN = 12;

export const CONFIG_PREFIX = `${CONFIGURATION_DIRECTORY}/`;

export const NAMING_TERMS_FILE = 'configurations/general/naming/policy.json';
