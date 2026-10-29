import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        folders: {
            description: 'Repository folders that own runtime schemas, relative to the ESLint working directory.',
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const ZOD_MODULES = ['zod', 'zod/v3', 'zod/v4', 'zod/mini', 'zod/v4-mini', 'zod/v4/mini'] as const;

export const ZOD_NAMESPACE_IMPORTS = new Set(['z', 'default']);

export const ZOD_UTILITIES = new Set([
    'config',
    'core',
    'decode',
    'decodeAsync',
    'encode',
    'encodeAsync',
    'flattenError',
    'formatError',
    'getDiscriminatedOption',
    'getErrorMap',
    'globalRegistry',
    'locales',
    'parse',
    'parseAsync',
    'prettifyError',
    'regexes',
    'registry',
    'safeDecode',
    'safeDecodeAsync',
    'safeEncode',
    'safeEncodeAsync',
    'safeParse',
    'safeParseAsync',
    'setErrorMap',
    'toJSONSchema',
    'treeifyError',
    'util',
    'validate',
    'validateAsync',
]);

export const DEFAULT_SCHEMA_FOLDERS = ['src/schemas'] as const;
