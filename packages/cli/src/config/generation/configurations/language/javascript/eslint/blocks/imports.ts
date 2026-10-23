export const NODE_SCRIPT_PATTERNS = ['**/*.mjs', '**/*.cjs'] as const;

export const PATH_SEPARATOR_PATTERN = String.raw`[\\/]`;

export const REGEX_SYMBOLS = /[.*+?^${}()|[\]\\]/gu;

export const ANY_DEPTH_PREFIX = /^\*\*\//u;

export const EXTENSIONLESS_CODE = { '.js': 'never', '.jsx': 'never', '.ts': 'never', '.tsx': 'never' } as const;

export const FILE_EXTENSION_RULE = 'n/file-extension-in-import';

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

export const TYPESCRIPT_EXTENSION_MAP = [
    ['.ts', '.js'],
    ['.mts', '.mjs'],
    ['.cts', '.cjs'],
    ['.tsx', '.js'],
] as const;

export const IMPORT_BOUNDARY_FOLDERS = ['*/*'] as const;
