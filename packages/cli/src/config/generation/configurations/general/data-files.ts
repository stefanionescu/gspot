import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';

export const TAPLO_FORMATTING = {
    align_entries: false,
    reorder_keys: false,
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

export const MISE_SCHEMA = {
    name: 'mise',
    description: 'The mise settings file',
    fileMatch: [
        'mise.toml',
        '.mise.toml',
        '.mise/conf.d/*.toml',
        '.config/mise/config.toml',
        '.config/mise/conf.d/*.toml',
        GSPOT_PATHS.miseProject,
    ],
    location: 'https://mise.jdx.dev/schema/mise.json',
} as const;

export const SETTINGS_SCHEMA = {
    name: 'gspot',
    description: 'The gspot settings file',
    fileMatch: [SETTINGS_FILE],
    location: GSPOT_PATHS.settingsSchema,
} as const;

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];

export const YAMLLINT_RULE_OPTIONS = { truthy: { 'check-keys': false } } as const;

export const YAMLLINT_YAML_OPTIONS = { version: '1.1' } as const;

export const YAMLLINT_RULES = ['anchors', 'key-duplicates', 'truthy'] as const;
