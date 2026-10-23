import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const LINKED_FILE_CASES = [
    {
        path: 'gspot.toml',
        outside: 'configurations = []\n',
        files: {},
        message: 'gspot.toml is not a regular file with one link. Use a regular file without extra hard links.',
    },
    {
        path: GSPOT_PATHS.versionPin,
        outside: '0.0.1\n',
        files: { 'project/gspot.toml': 'configurations = []\n' },
        message: `${DOT_GSPOT}/version is not a regular file with one link. Use a regular file without extra hard links.`,
    },
] as const;
