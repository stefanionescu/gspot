import { GIT_FOLDER } from '#cli/config/repository/files/tracked.ts';

export const DOCKERIGNORE_PATTERNS = [GIT_FOLDER, '.env'] as const;

export const EDGE_SLASHES = /^\/|\/$/gu;

export const IGNORE_PATTERN_FORMS = [
    ['', ''],
    ['**/', ''],
    ['', '*'],
    ['**/', '*'],
] as const;

export const DOCKERIGNORE = '.dockerignore';

export const EXCLUDE_ALL_LINES: ReadonlySet<string> = new Set(['*', '**', '**/*']);
