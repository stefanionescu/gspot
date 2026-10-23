import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        allowIndex: {
            description: 'Skip files named index.',
            type: 'boolean',
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;
