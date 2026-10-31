export const PLUGIN_PREFIX = 'gspot';

export const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;

export const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

export const IMPORT_SELECTOR =
    'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression, TSImportType';

export const IMPORT_EQUALS_SELECTOR = 'TSExternalModuleReference';

export const REQUIRE_SELECTOR = 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.length=1]';
