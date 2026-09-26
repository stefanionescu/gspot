// The literal values policy/profiles reads: names, patterns, limits, and tables.

export const GITHUB_PREFIX = 'github:';
export const RAW_HOST = 'https://raw.githubusercontent.com';
export const PROFILE_FILE = 'gspot.profile.toml';
export const REQUEST_TIMEOUT_MS = 10_000;
export const PATH_KEYS = new Set([
    'paths',
    'patterns',
    'path',
    'file',
    'files',
    'excludeFiles',
    'basePath',
    'ignores',
    'ignore_patterns',
    'glob',
    'harness_directory',
]);
/** The tables a profile never holds, because each one belongs to one repository. */
export const REPOSITORY_TABLES = ['scope', 'generated', 'vendored', 'check', 'exclude'] as const;
export const PROFILE_EXTENSION = /\.profile\.toml$|\.toml$/u;
