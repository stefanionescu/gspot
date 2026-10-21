import { MISE_TOOL_PROJECT_FILE } from '#cli/config/gspot-paths.ts';

/** The mise file patterns accepted by v8r. */
export const MISE_SCHEMA = {
    name: 'mise',
    description: 'The mise configuration file',
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
