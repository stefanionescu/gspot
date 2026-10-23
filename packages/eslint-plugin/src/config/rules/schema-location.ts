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
