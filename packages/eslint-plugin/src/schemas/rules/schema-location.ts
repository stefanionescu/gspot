import { buildOptionsSchema } from './options.ts';

export const locationOptionsSchema = buildOptionsSchema({
    folders: {
        description: 'Repository folders that own runtime schemas, relative to the ESLint working directory.',
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
    },
});
