import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';

export const LOCAL_ENVIRONMENT_PATTERNS = ['.env*'] as const;

/** Ignored folders of a configuration that hold build output. */
export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);

export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    git: 'Ignored by Git',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    dependencies: 'Dependencies',
    lockfiles: 'Lockfiles',
    environment: 'Local environment files',
} as const;

export const GSPOT_FOLDER_PATTERNS = [`${DOT_GSPOT}/**`] as const;
