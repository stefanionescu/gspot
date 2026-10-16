const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;

export const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

export const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

/** The default maximum statement count for a trivial function. */
export const TRIVIAL_STATEMENTS = 2;

/** Declarations with runtime behavior count as executable statements. */
export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

/** Block containers and empty statements have no executable statement of their own. */
export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

/** Object and array literals own the structure they construct. */
export const STRUCTURED_EXPRESSIONS = new Set<string>(['ObjectExpression', 'ArrayExpression']);

/** Nodes that introduce no implementation or owned schema. */
export const FORWARDING_NODES = new Set([
    ...FUNCTIONS,
    'ImportDeclaration',
    'ExportAllDeclaration',
    'EmptyStatement',
    'Identifier',
    'MemberExpression',
    'TSDeclareFunction',
]);
// Positions whose parent always takes a function value.
export const VALUE_PARENTS = new Set<string>(['ReturnStatement', 'JSXExpressionContainer', 'ArrowFunctionExpression']);

/** Two reads establish reuse within the current module. */
export const MIN_SHARED_READS = 2;

export const EXPORT_REFERENCES = new Set(['ExportSpecifier', 'ExportDefaultDeclaration', 'TSExportAssignment']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

export const FUNCTION_SELECTOR = ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)';

export const IMPORT_SELECTOR = 'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression';
export const SHEBANG = '#!';

/** Operators that calculate a predicate instead of performing one scalar arithmetic operation. */
export const COMPARISON_OPERATORS = new Set<string>([
    '===',
    '!==',
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'in',
    'instanceof',
]);

export const MODULE_CALL_SELECTOR =
    'Program > ExpressionStatement > CallExpression, Program > ExpressionStatement > AwaitExpression > CallExpression';
