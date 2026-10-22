export const COUNT_LIMITS = [
    { limit: 'function_lines', rule: 'function-lines', noun: 'code lines' },
    { limit: 'function_branches', rule: 'function-branches', noun: 'branches' },
    { limit: 'block_nesting', rule: 'block-nesting', noun: 'levels of nesting' },
    { limit: 'function_assignments', rule: 'function-assignments', noun: 'assignments' },
] as const;
