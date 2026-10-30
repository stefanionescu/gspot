import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const TAPLO_FORMATTING = {
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

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];

export const YAMLLINT_RULE_OPTIONS = { truthy: { 'check-keys': false } } as const;

export const YAMLLINT_YAML_OPTIONS = { version: '1.1' } as const;

export const YAMLLINT_RULES = ['anchors', 'key-duplicates', 'octal-values', 'truthy'] as const;

export const V8R_TABLE = 'tools.v8r';

export const YAMLLINT_CHECK = 'data-files/yamllint';
