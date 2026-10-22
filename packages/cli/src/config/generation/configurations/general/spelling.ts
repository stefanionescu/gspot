import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export const TYPOS_EXCLUDED_ARRAY = /^extend-exclude = .+$/mu;

/** Dependency and generated formats that typos must not read. */
export const TYPOS_IGNORED_GLOBS = [
    '*.lock',
    ...LOCKFILES.map(({ file }) => file).filter((file) => !file.endsWith('.lock')),
    '*.pbxproj',
    '*.xcstrings',
    '*.svg',
    '*.min.js',
    '*.min.css',
];

/** Generated identifiers that contain no spelling words. */
export const TYPOS_IGNORE_PATTERNS = [
    String.raw`\b[0-9a-f]{7,40}\b`,
    String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`,
] as const;
