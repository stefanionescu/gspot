import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const UPSTREAM_PACKAGE = '@typescript-eslint/eslint-plugin';
export const UPSTREAM_RULE = 'no-magic-numbers';

export const OPTIONS_SCHEMA = {
    description: 'The options of @typescript-eslint/no-magic-numbers, passed through unchanged.',
    type: 'object',
    additionalProperties: true,
} satisfies JSONSchema4;
