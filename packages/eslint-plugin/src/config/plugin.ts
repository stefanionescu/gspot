// global names
export const UNDEFINED_NAME = 'undefined';

// module specifiers
export const DRIVE_LETTER = /^[a-z]:/u;
export const MODULE_SEPARATOR = '.';
export const NODE_PREFIX = /^node:/u;
export const TRAILING_SLASH = /\/$/u;

// numbers
export const NUMERIC_SIGNS = new Set(['+', '-']);
export const NUMERIC_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'bigint']);
export const OCTAL_RADIX = 8;

// plugin name
export const PLUGIN_PREFIX = 'gspot';

// syntax nodes
export const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
export const IMPORT_EQUALS_SELECTOR = 'TSExternalModuleReference';
export const IMPORT_SELECTOR =
    'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression, TSImportType';
export const MODULE_DECLARATION_NODES = [
    'ImportDeclaration',
    'ExportAllDeclaration',
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
] as const;
export const REQUIRE_SELECTOR = 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.length=1]';
export const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;
export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;
