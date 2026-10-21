import { buildOptionsSchema } from './options.ts';

export const importBoundariesOptionsSchema = buildOptionsSchema({
    folders: {
        description: 'Boundary folders or folder globs. The nearest matching ancestor owns each file.',
        type: 'array',
        items: { type: 'string' },
    },
    aliases: {
        description: 'Import alias prefixes mapped to repository folders for fixes.',
        type: 'object',
        additionalProperties: { type: 'string' },
    },
    externals: {
        description:
            'Import specifiers, or globs of them, that the runtime provides, such as ../../scripts/app.js in a host application.',
        type: 'array',
        items: { type: 'string' },
    },
});
