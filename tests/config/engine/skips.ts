export const GENERATOR_LIMITS = [
    {
        check: 'javascript/eslint',
        file: 'eslint.mjs',
        languages: ['javascript'],
        limits: ['max_function_lines', 'max_function_statements', 'max_block_nesting', 'max_callback_nesting'],
    },
    {
        check: 'swift/swiftlint',
        file: 'swiftlint.yml',
        languages: ['swift'],
        limits: [
            'max_file_lines',
            'max_function_parameters',
            'max_function_lines',
            'max_type_lines',
            'max_closure_lines',
            'max_cyclomatic_complexity',
        ],
    },
] as const;

const NEXT_INTL_PACKAGE = '{"dependencies":{"next-intl":"4.8.3"}}';

export const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
] as const;
