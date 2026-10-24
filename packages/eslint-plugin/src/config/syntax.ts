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

export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

export const DRIVE_LETTER = /^[a-z]:/u;
