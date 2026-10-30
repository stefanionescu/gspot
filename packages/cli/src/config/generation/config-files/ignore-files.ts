import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);

export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;

export const GSPOT_FOLDER_PATTERNS = [`${GSPOT_FOLDER}/**`] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out',
    lockfiles: 'Lockfiles',
} as const;
