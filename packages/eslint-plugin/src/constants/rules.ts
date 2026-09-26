// Expression and declaration analysis.
export const WRAPPERS = new Set(['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);
export const DECLARATIONS = new Set([
    'FunctionDeclaration',
    'ClassDeclaration',
    'VariableDeclaration',
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
    'TSEnumDeclaration',
    'TSModuleDeclaration',
]);
export const TYPE_DECLARATIONS = new Set([
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
    'TSModuleDeclaration',
    'TSDeclareFunction',
]);
export const SKIPPED = new Set(['ImportDeclaration', 'TSImportEqualsDeclaration', 'EmptyStatement']);

// Comment and whitespace analysis.
export const DIRECTIVE_PREFIXES = [
    'eslint',
    'global ',
    'globals ',
    'exported ',
    'jshint ',
    'jslint ',
    'istanbul ',
    'c8 ',
    'v8 ',
    '@vitest',
    '@jest',
    'biome-ignore',
    'oxlint-',
];
export const TS_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;
export const BLANK = /^\s*$/u;
export const BLANK_LINE = /\n\s*\n/u;
export const LEADING_STAR = /^\s*\*?/u;
export const WHITESPACE = /[\t\n\r ]/u;
export const SPACES = /\s+/gu;

// File discovery and import resolution.
export const DEFAULT_IGNORED = ['node_modules', 'dist', 'build', 'coverage', '.git'];
export const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
export const CODE_EXTENSION = /\.[cm]?[jt]sx?$/u;
export const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const DEFAULT_PREFIXES = ['./', '../', '@/', '#'];
export const DEFAULT_PATTERNS = [
    String.raw`^[@#][\w./-]*/.+/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}(?:/[^/]+)*/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}/index(?:\.[cm]?[jt]sx?)?$`,
];

// Barrel size and trivial statement limits.
export const DEFAULT_MAX = 20;
export const DEFAULT_THRESHOLD = 2;
