import type { Manifest } from '#cli/types/configurations.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

/** The rule assets within each shipped configuration. */
export const CONFIGURATION_RULES_FOLDER = 'rules';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const MANIFEST_CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;

/** The fields two configurations may set differently when both declare one setting. */
export const SETTING_DEFAULT_FIELDS = new Set(['default', 'default_all']);

export const SENTENCE_MIN_CHARS = 12;

export const CONFIG_PREFIX = `${CONFIGURATION_DIRECTORY}/`;

export const NAMING_TERMS_FILE = 'configurations/general/naming/policy.json';

/** Display labels for every validated configuration kind, in initialization order. */
export const CONFIGURATION_LABELS: Record<Manifest['configuration']['kind'], string> = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    tool: 'Tools',
    library: 'Libraries',
    general: 'Repository',
};
