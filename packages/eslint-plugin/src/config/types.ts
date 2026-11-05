import { AST_NODE_TYPES } from '@typescript-eslint/utils';

export const BOOLEAN_NAME = 'Boolean';

export const UNDEFINED_TYPE = 'undefined';

export const LIBRARY_PATH = /[\\/]node_modules[\\/]/u;

export const ABSORBING_TYPES: ReadonlyMap<string, string> = new Map([
    ['TSAnyKeyword', 'any'],
    ['TSNeverKeyword', 'never'],
]);

export const EMPTY_TYPE_NAMES: ReadonlySet<string> = new Set(['null', 'undefined', 'void']);

export const LITERAL_UNION_MEMBERS: ReadonlySet<string> = new Set([
    'TSStringKeyword',
    'TSNumberKeyword',
    'TSTypeReference',
]);

export const INTERFACE_DECLARATION = /^(?:export\s+)?(?:declare\s+)?interface\s+[\w$]+\s*(?:(?:<[^{]*>)\s*)?\{/u;

export const LITERAL_UNION_SIZE = 2;

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

export const READONLY_STATIC_FILES = /\.(?:[cm]ts|tsx?)$/iu;

export const NULLISH_TYPE_KEYWORDS: ReadonlySet<string> = new Set(['TSNullKeyword', 'TSUndefinedKeyword']);

export const ALIAS_MEMBER_LIMIT = 2;

export const ALIAS_USE_LIMIT = 2;
