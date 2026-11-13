// file paths
export const DRIVE_LETTER = /^[a-z]:/u;
export const TRAILING_SLASH = /\/$/u;

// global names
export const UNDEFINED_NAME = 'undefined';

// module specifiers
export const MODULE_SEPARATOR = '.';
export const NODE_PREFIX = /^node:/u;

// numbers
export const DECIMAL_RADIX = 10;
export const NUMERIC_SIGNS = new Set(['+', '-']);
export const NUMERIC_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'bigint']);
export const OCTAL_RADIX = 8;

// package manifests
export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
export const PACKAGE_MANIFEST = 'package.json';
export const REPOSITORY_MARKER = '.git';

// plugin name
export const PLUGIN_PREFIX = 'gspot';

// syntax nodes
export const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
export const IMPORT_EQUALS_SELECTOR = 'TSExternalModuleReference';
export const IMPORT_SELECTOR =
    'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression, TSImportType';
export const LOOP_STATEMENTS: ReadonlySet<string> = new Set(['WhileStatement', 'DoWhileStatement']);
export const LOOP_BODY_PARENTS: ReadonlySet<string> = new Set([
    ...LOOP_STATEMENTS,
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
]);
export const MODULE_DECLARATION_NODES = [
    'ImportDeclaration',
    'ExportAllDeclaration',
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
] as const;
export const REQUIRE_SELECTOR = 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.length=1]';
export const TERMINATING_STATEMENTS: ReadonlySet<string | undefined> = new Set([
    'ReturnStatement',
    'ThrowStatement',
    'BreakStatement',
    'ContinueStatement',
]);
export const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;
export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

// version ranges
export const UNBOUNDED_VERSIONS = new Set(['', '*', 'x', 'X', 'latest']);
export const VERSION_ALTERNATIVES = '||';
export const VERSION_NUMBER = /^(?:\d+|[xX*])$/u;
export const VERSION_OPERATORS = new Map([
    ['', 'exact'],
    ['=', 'exact'],
    ['^', 'caret'],
    ['~', 'tilde'],
    ['<', 'below'],
    ['<=', 'upto'],
    ['>', 'unbounded'],
    ['>=', 'unbounded'],
]);
export const VERSION_PATTERN = /^(?<operator>[<>]=?|[~=^])?v?(?<number>[\d.xX*]+)(?:[-+][\w.]*)?$/u;
export const VERSION_SIZE = 3;
export const VERSION_SPACES = /\s+/u;
export const VERSION_WILDCARD = /^[xX*]$/u;
