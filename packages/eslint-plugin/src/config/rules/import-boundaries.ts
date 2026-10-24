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
                'Import alias patterns mapped to repository paths, as in tsconfig `paths` and package.json `imports`: `@/*` to `src/*`, or an exact key to an exact path.',
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

export const QUERY = /\?[\s\S]*/u;
