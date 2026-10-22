/** Node runs these scripts without a bundler, so their imports keep the full file name. */
export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;

export const PATH_SEPARATOR_PATTERN = String.raw`[\\/]`;

export const REGEX_SYMBOLS = /[.*+?^${}()|[\]\\]/gu;

export const ANY_DEPTH_PREFIX = /^\*\*\//u;

/** Bundled code drops the suffix of these code modules only; stylesheets, JSON, images, and fonts keep theirs. */
export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;

export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';

export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';

/** The extensions that eslint-plugin-n tries, in this order, when an import names a file without one. */
export const IMPORT_EXTENSIONS = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.mjs',
    '.mts',
    '.cjs',
    '.cts',
    '.json',
    '.node',
] as const;

/** Compiled imports use the JavaScript suffix of the output for TypeScript files. */
export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

/** The default folder boundaries at level all. */
export const IMPORT_BOUNDARY_FOLDERS = ['*/*'] as const;
