import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export const TYPOS_EXCLUDED_ARRAY = /^extend-exclude = .+$/mu;

export const TYPOS_LOCKFILE_GLOBS = [
    '*.lock',
    ...LOCKFILES.map(({ file }) => file).filter((file) => !file.endsWith('.lock')),
];

export const TYPOS_FORMAT_GLOBS = ['*.pbxproj', '*.xcstrings', '*.svg', '*.min.js', '*.min.css'] as const;

export const TYPOS_IGNORE_PATTERNS = [
    String.raw`\b[0-9a-f]{7,40}\b`,
    String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`,
] as const;
