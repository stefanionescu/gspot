import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

// import paths
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
export const LOCAL_PREFIXES = ['./', '../', '@/', '~/', '#'] as const;
export const RESOURCE_QUERY = /\?[\s\S]*/u;

// import-boundaries rule
export const DEFAULT_BOUNDARY_FOLDERS = ['*/*'] as const;
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
export const RELATIVE_SPECIFIER = /^\.\.?(?:\/|$)/u;

// no-commented-code rule
export const COMMENT_CODE = /[=;{}()<>]|\b(?:return|throw|import|export)\b/u;
export const COMMENT_CODE_PATTERNS = [
    /^(?:if|for|while|switch|catch)\s*\([^)]*\)\s*\{$/u,
    /^(?:async\s+)?function\s+[\w$]+\s*\([^)]*\)\s*\{$/u,
    /^(?:try|else|finally)\s*\{$/u,
];
export const COMMENT_DIRECTIVES = [
    /^(?:[*@]|SPDX-)/u,
    /^eslint(?:-[\w-]+)?(?:\s|$)(?!\s*=)/u,
    /^(?:istanbul|c8|v8|prettier|noinspection)(?:\s|$)(?!\s*=)/u,
    /^(?:TODO|FIXME)\s*:/u,
];
export const COMMENT_DOCUMENTATION = /^(?:e\.g[.:]|for example\b|examples?:)/iu;
export const COMMENT_JSX_ATTRIBUTE = /[={]/u;
export const COMMENT_PARSER_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { globalReturn: true, jsx: true },
    project: false,
    projectService: false,
    comment: false,
    tokens: false,
};
export const COMMENT_PARSE_ERRORS = new Set(['SyntaxError', 'TSError']);

// no-comments-in-imports rule
export const BLANK = /^\s*$/u;
export const ESLINT_BLOCK_DIRECTIVE = /^eslint(?:-(?:disable|enable|env))?(?:\s|$)/u;
export const ESLINT_LINE_DIRECTIVE = /^eslint-(?:disable|enable)(?:-(?:next-)?line)?(?:\s|$)/u;
export const LEADING_COMMENT_LINE_BREAKS = 2;
export const LEADING_STAR = /^\s*\*?/u;
export const LINE_BREAK_GAP = /^[\t ]*\r?\n[\t ]*$/u;
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
export const TYPESCRIPT_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;

// no-detached-doc-comments rule
export const DOCUMENTED_NODES = new Set<string>([
    'ClassDeclaration',
    'ExportDefaultDeclaration',
    'FunctionDeclaration',
    'MethodDefinition',
    'Property',
    'PropertyDefinition',
    'TSAbstractMethodDefinition',
    'TSAbstractPropertyDefinition',
    'TSDeclareFunction',
    'TSEnumDeclaration',
    'TSEnumMember',
    'TSInterfaceDeclaration',
    'TSMethodSignature',
    'TSModuleDeclaration',
    'TSPropertySignature',
    'TSTypeAliasDeclaration',
    'VariableDeclaration',
]);
// A comment with one of these tags documents the file or a type of its own, not the declaration below it.
export const STANDALONE_DOC_TAG =
    /@(?:callback|copyright|file|fileoverview|import|license|module|namespace|overview|typedef)\b/u;

// no-index-imports rule
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

// no-renamed-imports rule
export const PACKAGE_NAME = /^(?:@[^/]+\/)?[^/]+/u;
export const WORKSPACE_PROTOCOL = 'workspace:';

// no-trivial-files rule
export const BARREL_DECLARATIONS = new Set<string>([
    'FunctionDeclaration',
    'ClassDeclaration',
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
]);
export const DECLARING_DEFAULT_EXPORTS = new Set<string>(['FunctionDeclaration', 'CallExpression']);
export const INDEX_EXPORTS = 20;
export const PUBLISHED_PATH_FIELDS = ['exports', 'main', 'bin'] as const;
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

// restricted-syntax rule
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
