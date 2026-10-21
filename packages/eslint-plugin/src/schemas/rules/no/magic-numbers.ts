import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const magicNumbersOptionsSchema = {
    type: 'object',
    additionalProperties: true,
} satisfies JSONSchema4;
