import { MISE_TOOL_PROJECT_FILE } from '#cli/config/gspot-paths.ts';

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
        MISE_TOOL_PROJECT_FILE,
    ],
    location: 'https://mise.jdx.dev/schema/mise.json',
} as const;

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];
