import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';

/** The mise file patterns that v8r accepts. */
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

/** gspot.toml, validated with the schema of the gspot version that wrote it. */
export const SETTINGS_SCHEMA = {
    name: 'gspot',
    description: 'The gspot settings file',
    fileMatch: [SETTINGS_FILE],
    location: GSPOT_PATHS.settingsSchema,
} as const;

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];
