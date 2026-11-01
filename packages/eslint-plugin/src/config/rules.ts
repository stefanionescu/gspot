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

export const IMPORT_BOUNDARY_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        folders: {
            description: 'Boundary folders or folder globs. The nearest matching ancestor owns each file.',
            type: 'array',
            items: { type: 'string' },
        },
        aliases: {
            description:
                'Import alias patterns mapped to repository paths, as in tsconfig `paths` and package.json `imports`: `@/*` to `src/*` or `./src/*`, or an exact key to an exact path.',
            type: 'object',
            additionalProperties: { type: 'string' },
        },
        externals: {
            description:
                'Import specifiers, or globs of them, that the runtime provides, such as ../../scripts/app.js in a host application.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const DRIVE_LETTER = /^[a-z]:/u;

export const TRAILING_SLASH = /\/$/u;

export const DEFAULT_BOUNDARY_FOLDERS = ['*/*'] as const;

export const RELATIVE_SPECIFIER = /^\.\.?(?:\/|$)/u;

export const INDEX_BASENAMES = new Set([
    'index',
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
    'index.mts',
    'index.cts',
]);

export const RESOURCE_QUERY = /\?[\s\S]*/u;

export const LOCAL_PREFIXES = ['./', '../', '@/', '~/', '#'] as const;

export const MODULE_MOCK_METHODS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['vi', new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock'])],
    [
        'jest',
        new Set([
            'mock',
            'doMock',
            'unmock',
            'dontMock',
            'setMock',
            'requireActual',
            'requireMock',
            'createMockFromModule',
        ]),
    ],
]);

export const UPSTREAM_RULE = 'no-magic-numbers';

export const MAGIC_NUMBER_OPTIONS_SCHEMA = {
    description: 'The options of @typescript-eslint/no-magic-numbers, passed through unchanged.',
    type: 'object',
    additionalProperties: true,
} satisfies JSONSchema4;

export const RESTRICTED_SYNTAX_OPTIONS_SCHEMA = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            selector: { description: 'The ESLint selector of the nodes to report.', type: 'string' },
            message: { description: 'The message of each finding.', type: 'string' },
            files: {
                description: 'Globs of the files that the selector applies to. Without it, every file.',
                type: 'array',
                items: { type: 'string' },
            },
            ignores: {
                description: 'Globs of the files that the selector skips.',
                type: 'array',
                items: { type: 'string' },
            },
        },
        required: ['selector', 'message'],
        additionalProperties: false,
    },
} satisfies JSONSchema4;

export const TRIVIAL_FILE_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        reexports: {
            description:
                'Where `export … from` may go: `none` reports each one, and `index-only` allows them in files named index.',
            type: 'string',
            enum: ['none', 'index-only'],
        },
        indexExports: {
            description:
                'With `index-only`, the most names an index file may export when it exports more names than it declares.',
            type: 'integer',
            minimum: 0,
        },
        forwardingFiles: {
            description:
                'Globs of files that may only forward, such as route files that a framework discovers by name. They still report each re-export. Paths are relative to `settings.gspot.root`, or to the working folder of ESLint.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const INDEX_EXPORTS = 20;

export const BARREL_DECLARATIONS = new Set<string>([
    'FunctionDeclaration',
    'ClassDeclaration',
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
]);

export const DECLARING_DEFAULT_EXPORTS = new Set<string>(['FunctionDeclaration', 'CallExpression']);

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

export const SERVER_DIRECTIVE = 'use server';

export const SERVER_ONLY_MODULE = 'server-only';

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

export const COLLECTION_SIZE_MEMBERS = new Set(['length', 'size']);
export const COLLECTION_TYPE_NAMES = new Set(['Array', 'Map', 'Set', 'WeakMap', 'WeakSet']);

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

export const STANDALONE_PARENTS: ReadonlySet<string> = new Set(['ChainExpression', 'LogicalExpression']);
export const RETURNED_PARENTS: ReadonlySet<string> = new Set([
    'ArrayExpression',
    'ObjectExpression',
    'ConditionalExpression',
    'SpreadElement',
]);

export const CONSTRUCTOR_BODY_DEPTH = 2;

export const NUMERIC_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'bigint']);

export const SMALL_SWITCH_CASES = 2;

export const EFFECT_ONLY_BRANCH = 'true,false';

export const EFFECT_RETURN_BRANCH = 'true,true';

export const BARE_RETURN_BRANCH = 'false,true';

export const NULLISH_TYPE_KEYWORDS: ReadonlySet<string> = new Set(['TSNullKeyword', 'TSUndefinedKeyword']);

export const ALIAS_MEMBER_LIMIT = 2;

export const ALIAS_USE_LIMIT = 2;

export const ANCHOR_KINDS: ReadonlySet<string> = new Set(['start', 'end']);

export const LOOKAROUND_KINDS: ReadonlySet<string> = new Set(['lookahead', 'lookbehind']);

export const CHOICE_BASE = 2;

export const DEFAULT_REGEX_COMPLEXITY = 20;

export const REGEX_COMPLEXITY_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        threshold: {
            description: 'The highest complexity a regular expression may have.',
            type: 'integer',
            minimum: 0,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const ANCHOR_PAIR = 2;

export const ENDING_PAIR = 2;

export const DISTINCT_SUBJECTS = 2;
