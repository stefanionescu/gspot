import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const OPTIONS_SCHEMA = {
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
