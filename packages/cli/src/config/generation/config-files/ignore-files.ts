import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';

export const LOCAL_ENVIRONMENT_PATTERNS = ['.env*'] as const;

export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);

export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;

export const GSPOT_FOLDER_PATTERNS = [`${GSPOT_FOLDER}/**`] as const;

export const PRETTIERIGNORE_PURPOSE = 'Editors and gspot checks use the same ordered ignore patterns.';

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out, such as installed dependencies and local secrets',
    lockfiles: 'Lockfiles',
    environment: 'Local environment files',
} as const;
