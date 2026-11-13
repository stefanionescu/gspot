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
