import { TYPE_ASSERTION_NODES } from './plugin.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const IMMEDIATE_RETURN_DECLARATION =
    'VariableDeclaration[kind=/^(const|let|var)$/][declarations.length=1] > VariableDeclarator[id.type="Identifier"]:not([id.typeAnnotation])[init]';

export const EMPTY_LITERAL_DECLARATION =
    'VariableDeclaration > VariableDeclarator[id.type="Identifier"][init.type="ObjectExpression"][init.properties.length=0]';

export const REDUNDANT_TYPE_KEYWORDS: ReadonlySet<string> = new Set([
    AST_NODE_TYPES.TSAnyKeyword,
    AST_NODE_TYPES.TSBigIntKeyword,
    AST_NODE_TYPES.TSBooleanKeyword,
    AST_NODE_TYPES.TSNeverKeyword,
    AST_NODE_TYPES.TSNullKeyword,
    AST_NODE_TYPES.TSNumberKeyword,
    AST_NODE_TYPES.TSStringKeyword,
    AST_NODE_TYPES.TSSymbolKeyword,
    AST_NODE_TYPES.TSUndefinedKeyword,
    AST_NODE_TYPES.TSUnknownKeyword,
    AST_NODE_TYPES.TSVoidKeyword,
]);

export const DRIVE_LETTER = /^[a-z]:/u;

export const TRAILING_SLASH = /\/$/u;

export const UPSTREAM_RULE = 'no-magic-numbers';

export const MAGIC_NUMBER_OPTIONS_SCHEMA = {
    description: 'The options of @typescript-eslint/no-magic-numbers, passed through unchanged.',
    type: 'object',
    additionalProperties: true,
} satisfies JSONSchema4;

export const TRIVIAL_FUNCTION_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        trivialFunctionStatements: {
            description: 'The rule reports each function with this many statements or fewer.',
            type: 'integer',
            minimum: 1,
        },
        exportNames: {
            description:
                'Exports that a framework calls by name, such as GET in a route file. In a file that matches files, a function exported under one of names is not reported. `default` names the default export. Paths are relative to `settings.gspot.root`, or to the working folder of ESLint.',
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    files: { type: 'array', items: { type: 'string' }, minItems: 1 },
                    names: { type: 'array', items: { type: 'string' }, minItems: 1 },
                },
                required: ['files', 'names'],
                additionalProperties: false,
            },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const TRIVIAL_FUNCTION_STATEMENTS = 2;

export const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

export const INLINE_VALUE_PARENTS = new Set<string>([
    'ArrayExpression',
    'ReturnStatement',
    'JSXExpressionContainer',
    'ArrowFunctionExpression',
    'AssignmentPattern',
]);

export const FUNCTION_SELECTOR = ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)';

export const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

export const ONE_STATEMENT = '1 statement';

export const READONLY_STATIC_FILES = /\.tsx?$/iu;

export const DEFAULT_SWITCH_CASES = 30;

export const SWITCH_CASES_OPTIONS_SCHEMA = { type: 'integer', minimum: 0 } as const;

export const ERROR_CONSTRUCTOR_SUFFIX = /(?:Error|Exception)$/u;

export const TRANSPOSED_UNARY_OPERATORS = new Set(['+', '-', '!']);

export const EMPTY_RETURN_TYPES = new Set(['TSVoidKeyword', 'TSNeverKeyword', 'TSUndefinedKeyword']);

export const UNUSED_CALL_PARENTS = new Set([
    'ExpressionStatement',
    'ArrowFunctionExpression',
    'UnaryExpression',
    'AwaitExpression',
    'ReturnStatement',
    'ThrowStatement',
]);

export const SIGNED_NUMBER_OPERATORS = new Set(['+', '-']);

export const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!==']);

export const REPEATED_OPERATORS = new Set(['&&', '||', '/', '-', '<<', '>>', '<', '<=', '>', '>=']);

export const COMPARISON_OPERATORS = new Set([...EQUALITY_OPERATORS, '<', '<=', '>', '>=']);

export const UNIT_SHIFT_VALUES = new Set<unknown>([1, 1n]);

export const LOOSE_EQUALITY_OPERATORS = new Set(['==', '!=']);

export const RESERVED_DECLARATION_NAMES = new Set([
    'implements',
    'interface',
    'package',
    'private',
    'protected',
    'public',
    'enum',
    'class',
    'const',
    'export',
    'extends',
    'import',
    'super',
    'let',
    'static',
    'yield',
    'await',
]);

export const COMPLEX_TRY_STATEMENTS = /^(?:Block|For(?:In|Of)?|While|DoWhile|Switch)Statement$/u;

export const CONDITION_PARENTS: ReadonlySet<string> = new Set([
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ConditionalExpression',
]);

export const BRANCH_KEYS: ReadonlyMap<string, readonly string[]> = new Map([
    ['IfStatement', ['consequent', 'alternate']],
    ['WhileStatement', ['body']],
    ['DoWhileStatement', ['body']],
    ['ForStatement', ['body']],
    ['ForInStatement', ['body']],
    ['ForOfStatement', ['body']],
]);

export const MINIMUM_RETURNS = 2;

export const DEFAULT_FUNCTION_NESTING = 5;

export const FUNCTION_NESTING_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        threshold: { description: 'The deepest nesting of functions allowed.', type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const CONSTRUCTOR_BODY_DEPTH = 2;

export const NUMERIC_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'bigint']);

export const SMALL_SWITCH_CASES = 2;

export const EFFECT_ONLY_BRANCH = 'true,false';

export const EFFECT_RETURN_BRANCH = 'true,true';

export const BARE_RETURN_BRANCH = 'false,true';

export const NULLISH_TYPE_KEYWORDS: ReadonlySet<string> = new Set(['TSNullKeyword', 'TSUndefinedKeyword']);

export const ALIAS_MEMBER_LIMIT = 2;

export const ALIAS_USE_LIMIT = 2;

export const DEFAULT_IDENTICAL_LINES = 3;

export const IDENTICAL_FUNCTIONS_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        minLines: {
            description: 'The fewest lines a function body spans before a copy of it is reported.',
            type: 'integer',
            minimum: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;
