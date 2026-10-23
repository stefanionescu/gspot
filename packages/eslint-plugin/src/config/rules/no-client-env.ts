import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const ENVIRONMENT_HOSTS = ['process', 'Bun', 'Deno'] as const;

export const ALLOWED_ENVIRONMENT_NAMES = ['NODE_ENV'] as const;

export const ENVIRONMENT_PROPERTY = 'env';

export const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        client: {
            description: 'Treat selected files as client code without a use-client directive.',
            type: 'boolean',
        },
        publicPrefixes: {
            description: 'Prefixes allowed for public environment variables.',
            type: 'array',
            items: { type: 'string' },
        },
        allowedNames: {
            description: 'Environment variable names allowed in client code.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;
