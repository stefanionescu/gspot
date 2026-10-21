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

/** The default maximum statement count for a trivial function. */
export const TRIVIAL_FUNCTION_STATEMENTS = 2;

/** Declarations with runtime behavior count as executable statements. */
export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

/** Block containers and empty statements have no executable statement of their own. */
export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

/** The values that an alias names: another value or one of its members. */
export const ALIASED_VALUES = new Set<string>(['Identifier', 'MemberExpression']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

/** The parents that hold a function as a value: an array element, a returned value, JSX, an arrow body, or a default. */
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
