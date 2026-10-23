import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        folders: {
            description: 'Boundary folders or folder globs. The nearest matching ancestor owns each file.',
            type: 'array',
            items: { type: 'string' },
        },
        aliases: {
            description:
                'Import alias prefixes mapped to repository folders for fixes. Keys and folders may end in `/*`, as in tsconfig paths.',
            type: 'object',
            additionalProperties: { type: 'string' },
        },
        externals: {
            description:
                'Import specifiers, or globs of them, that the runtime provides, such as ../../scripts/app.js in a host application.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;
