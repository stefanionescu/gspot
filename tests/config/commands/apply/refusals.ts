import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';

export const LINKED_FILE_CASES = [
    {
        path: 'gspot.toml',
        outside: 'configurations = []\n',
        files: {},
        message: 'gspot.toml is not a regular file. Use a regular file.',
    },
    {
        path: GSPOT_PATHS.versionPin,
        outside: '0.0.1\n',
        files: { 'project/gspot.toml': 'configurations = []\n' },
        message: `${GSPOT_FOLDER}/version is not a regular file. Use a regular file.`,
    },
] as const;
