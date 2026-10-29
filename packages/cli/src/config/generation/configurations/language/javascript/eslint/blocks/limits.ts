export const BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files';

export const ESLINT_LIMIT_RULES = {
    'max-lines': { limit: 'file_lines', options: { skipBlankLines: true, skipComments: true } },
    'max-lines-per-function': {
        limit: 'function_lines',
        options: { skipBlankLines: true, skipComments: true, IIFEs: true },
    },
    'max-params': { limit: 'function_parameters' },
    'max-depth': { limit: 'block_nesting' },
    'max-statements': { limit: 'function_statements' },
    'max-nested-callbacks': { limit: 'callback_nesting' },
    complexity: { limit: 'cyclomatic_complexity' },
    'sonarjs/cognitive-complexity': { limit: 'cognitive_complexity' },
} as const;
