/** Source formats claimed by no Configuration Files reader. */
export const UNSUPPORTED_CONFIGURATION_FILES = [
    'settings.ini',
    'settings.cfg',
    'settings.properties',
    'app.webmanifest',
    '.nvmrc',
    '.node-version',
    '.python-version',
];

export const SCOPE_OWNER_PATHS = [
    'migrations/V1_root.sql',
    'app/migrations/V2_first.sql',
    'other/migrations/V3_other.sql',
];

export const PATH_OWNER_CASES = [
    ['', ['migrations/V1_root.sql']],
    ['app', ['app/migrations/V2_first.sql']],
    ['other', ['other/migrations/V3_other.sql']],
] as const;
