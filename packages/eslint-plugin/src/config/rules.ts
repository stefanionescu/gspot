import { TYPE_ASSERTION_NODES } from './plugin.ts';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

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

export const CLIENT_ENVIRONMENT_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        client: {
            description: 'Treat selected files as client code without a use-client directive.',
            type: 'boolean',
        },
        publicPrefixes: {
            description: 'Prefixes allowed for public environment variables.',
            type: 'array',
            items: { type: 'string' },
        },
        allowedNames: {
            description: 'Environment variable names allowed in client code.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const ENVIRONMENT_HOSTS = ['process', 'Bun', 'Deno'] as const;

export const ALLOWED_ENVIRONMENT_NAMES = ['NODE_ENV'] as const;

export const ENVIRONMENT_PROPERTY = 'env';

export const VITE_ENVIRONMENT_NAMES = ['MODE', 'BASE_URL', 'PROD', 'DEV', 'SSR'] as const;

export const PUBLIC_PREFIXES = ['NEXT_PUBLIC_'] as const;

export const CLIENT_DIRECTIVE = 'use client';

export const TOOL_DIRECTIVE_PREFIXES = [
    'global ',
    'globals ',
    'exported ',
    'jshint ',
    'jslint ',
    'istanbul ',
    'c8 ',
    'v8 ',
    '@vitest',
    '@jest',
    'biome-ignore',
    'oxlint-',
    'prettier-ignore',
    'nosemgrep',
    'dprint-ignore',
    'deno-lint-ignore',
] as const;

export const ESLINT_LINE_DIRECTIVE = /^eslint-(?:disable|enable)(?:-(?:next-)?line)?(?:\s|$)/u;

export const ESLINT_BLOCK_DIRECTIVE = /^eslint(?:-(?:disable|enable|env))?(?:\s|$)/u;

export const TYPESCRIPT_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;

export const LEADING_STAR = /^\s*\*?/u;

export const LEADING_COMMENT_LINE_BREAKS = 2;
export const BLANK = /^\s*$/u;

export const LINE_BREAK_GAP = /^[\t ]*\r?\n[\t ]*$/u;
export const LEADING_LINE_BREAK = /^[\t ]*\r?\n/u;

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

export const TRIVIAL_FILE_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        allowIndex: {
            description: 'Skip files named index.',
            type: 'boolean',
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const TRIVIAL_FUNCTION_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        trivialFunctionStatements: {
            description: 'The rule reports each function with this many statements or fewer.',
            type: 'integer',
            minimum: 1,
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
