import type { LimitCheck } from '#cli/types/planning.ts';

export const LIMIT_READERS: readonly LimitCheck[] = [
    {
        check: 'javascript/eslint',
        languages: ['javascript', 'typescript'],
        limits: [
            'file_lines',
            'function_lines',
            'function_parameters',
            'function_statements',
            'block_nesting',
            'callback_nesting',
            'cognitive_complexity',
            'cyclomatic_complexity',
            'index_exports',
            'trivial_function_statements',
        ],
    },
    {
        check: 'swift/swiftlint',
        languages: ['swift'],
        limits: [
            'file_lines',
            'function_parameters',
            'function_lines',
            'type_lines',
            'closure_lines',
            'cyclomatic_complexity',
        ],
    },
    {
        check: 'python/ruff',
        languages: ['python'],
        limits: [
            'cyclomatic_complexity',
            'function_statements',
            'function_parameters',
            'function_branches',
            'function_returns',
        ],
    },
    { check: 'python/function-size', languages: ['python'], limits: ['function_lines'] },
    {
        check: 'bash/function-size',
        languages: ['bash'],
        limits: ['function_lines', 'function_branches', 'block_nesting', 'function_assignments'],
    },
    { check: 'structure/long-files', languages: ['python', 'sql', 'bash'], limits: ['file_lines'] },
    {
        check: 'structure/trivial-functions',
        languages: ['python', 'swift', 'bash'],
        limits: ['trivial_function_statements'],
    },
    { check: 'structure/shared-prefixes', languages: [], limits: ['shared_prefix_files'] },
];
