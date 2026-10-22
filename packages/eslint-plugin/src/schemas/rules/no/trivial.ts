import { buildOptionsSchema } from '../options.ts';

export const trivialFilesOptionsSchema = buildOptionsSchema({
    allowIndex: {
        description: 'Skip files named index.',
        type: 'boolean',
    },
});

export const trivialFunctionsOptionsSchema = buildOptionsSchema({
    trivialFunctionStatements: {
        description: 'The rule reports each function with this many statements or fewer.',
        type: 'integer',
        minimum: 1,
    },
});
