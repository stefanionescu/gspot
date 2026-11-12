export const PLUGIN_PREFIX = 'gspot';

export const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;

export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

export const IMPORT_SELECTOR =
    'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression, TSImportType';

export const IMPORT_EQUALS_SELECTOR = 'TSExternalModuleReference';

export const REQUIRE_SELECTOR = 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.length=1]';

export const MODULE_DECLARATION_NODES = [
    'ImportDeclaration',
    'ExportAllDeclaration',
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
] as const;

export const NODE_PREFIX = /^node:/u;

export const MODULE_SEPARATOR = '.';

export const UNDEFINED_NAME = 'undefined';

export const NUMERIC_SIGNS = new Set(['+', '-']);

export const OCTAL_RADIX = 8;

export const NUMERIC_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'bigint']);

export const DRIVE_LETTER = /^[a-z]:/u;

export const TRAILING_SLASH = /\/$/u;

export const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
