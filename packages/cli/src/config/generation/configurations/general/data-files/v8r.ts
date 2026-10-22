import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

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

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];
