const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;

export const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

export const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

export const TRIVIAL_FUNCTION_STATEMENTS = 2;

export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

export const ALIASED_VALUES = new Set<string>(['Identifier', 'MemberExpression']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

export const INLINE_VALUE_PARENTS = new Set<string>([
    'ArrayExpression',
    'ReturnStatement',
    'JSXExpressionContainer',
    'ArrowFunctionExpression',
    'AssignmentPattern',
]);

export const FUNCTION_SELECTOR = ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)';

export const IMPORT_SELECTOR = 'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression';

export const IMPORT_SPECIFIER_NODES = new Set<string>([
    'ImportSpecifier',
    'ImportDefaultSpecifier',
    'ImportNamespaceSpecifier',
]);
