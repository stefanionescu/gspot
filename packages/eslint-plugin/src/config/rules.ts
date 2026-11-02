import { TYPE_ASSERTION_NODES } from './plugin.ts';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const DRIVE_LETTER = /^[a-z]:/u;

export const TRAILING_SLASH = /\/$/u;

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

export const EFFECT_ONLY_BRANCH = 'true,false';

export const EFFECT_RETURN_BRANCH = 'true,true';

export const BARE_RETURN_BRANCH = 'false,true';

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
