import { buildOptionsSchema } from '../options.ts';

export const trivialFilesOptionsSchema = buildOptionsSchema({
    trivialFunctionStatements: {
        description: 'Functions with this many statements or fewer are reported.',
        type: 'integer',
        minimum: 1,
    },
    allowIndex: {
        description: 'Allow a file named index that only re-exports.',
        type: 'boolean',
    },
});

export const trivialFunctionsOptionsSchema = buildOptionsSchema({
    trivialFunctionStatements: {
        description: 'Functions with this many statements or fewer are reported.',
        type: 'integer',
        minimum: 1,
    },
});
