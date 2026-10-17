import { DOT_GSPOT } from '#cli/config/system/locations.ts';

export const GSPOT_FOLDER_PATTERNS = [`${DOT_GSPOT}/**`] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    dependencies: 'Dependencies',
    lockfiles: 'Lockfiles',
    environment: 'Local environment files',
} as const;
export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;
export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set([
    'dist',
    'build',
    'coverage',
    '.build',
    'DerivedData',
]);
export const LOCAL_ENVIRONMENT_PATTERNS = ['.env*'] as const;
