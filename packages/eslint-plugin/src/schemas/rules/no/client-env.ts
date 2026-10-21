import { buildOptionsSchema } from '../options.ts';

export const clientEnvOptionsSchema = buildOptionsSchema({
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
});
