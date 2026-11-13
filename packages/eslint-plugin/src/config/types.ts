import { AST_NODE_TYPES } from '@typescript-eslint/utils';

// empty types
export const EMPTY_TYPE_NAMES: ReadonlySet<string> = new Set(['null', 'undefined', 'void']);

// no-redundant-optional rule
export const LIBRARY_PATH = /[\\/]node_modules[\\/]/u;

// no-useless-intersection rule
export const ABSORBING_TYPES: ReadonlyMap<string, string> = new Map([
    ['TSAnyKeyword', 'any'],
    ['TSNeverKeyword', 'never'],
]);
export const INTERFACE_DECLARATION = /^(?:export\s+)?(?:declare\s+)?interface\s+[\w$]+\s*(?:(?:<[^{]*>)\s*)?\{/u;
export const LITERAL_UNION_MEMBERS: ReadonlySet<string> = new Set([
    'TSStringKeyword',
    'TSNumberKeyword',
    'TSTypeReference',
]);
export const LITERAL_UNION_SIZE = 2;

// prefer-readonly-static rule
export const READONLY_STATIC_FILES = /\.(?:[cm]ts|tsx?)$/iu;

// prefer-type-alias rule
export const ALIAS_MEMBER_LIMIT = 2;
export const ALIAS_USE_LIMIT = 2;
export const NULLISH_TYPE_KEYWORDS: ReadonlySet<string> = new Set(['TSNullKeyword', 'TSUndefinedKeyword']);

// prefer-type-guard rule
export const BOOLEAN_NAME = 'Boolean';

// redundant-type-aliases rule
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
