export const GENERATOR_LIMITS = [
    {
        check: 'javascript/eslint',
        file: 'eslint.mjs',
        languages: ['javascript'],
        limits: [
            'max_file_lines',
            'max_function_lines',
            'max_function_statements',
            'max_block_nesting',
            'max_callback_nesting',
            'max_index_exports',
            'min_function_statements',
        ],
    },
    {
        check: 'javascript/biome',
        file: 'biome.json',
        languages: ['javascript'],
        limits: ['max_cognitive_complexity'],
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

export const BUILT_IN_LIMIT_CASES = [
    {
        check: 'python/function-size',
        language: 'python',
        limit: 'max_function_lines',
        file: 'source.py',
        source: 'def perform():\n    first()\n    second()\n    third()\n',
        rule: 'function-lines',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'max_function_lines',
        file: 'source.sh',
        source: 'perform() {\n    first\n    second\n}\n',
        rule: 'function-lines',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'max_function_branches',
        file: 'source.sh',
        source: 'perform() {\nif true; then first; fi\nif true; then second; fi\nif true; then third; fi\nif true; then fourth; fi\n}\n',
        rule: 'function-branches',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'max_block_nesting',
        file: 'source.sh',
        source: 'perform() {\nif true; then\nif true; then\nif true; then\nif true; then first; fi\nfi\nfi\nfi\n}\n',
        rule: 'block-nesting',
    },
    {
        check: 'bash/function-size',
        language: 'bash',
        limit: 'max_function_assignments',
        file: 'source.sh',
        source: 'perform() {\na=1\nb=2\nc=3\nd=4\n}\n',
        rule: 'function-assignments',
    },
    {
        check: 'structure/long-files',
        language: 'python',
        limit: 'max_file_lines',
        file: 'source.py',
        source: 'a = 1\nb = 2\nc = 3\nd = 4\n',
        rule: 'file-lines',
    },
    {
        check: 'structure/trivial-functions',
        language: 'python',
        limit: 'min_function_statements',
        file: 'source.py',
        source: 'def perform():\n    first()\n    second()\n    third()\n',
        rule: 'trivial-function',
    },
    {
        check: 'structure/trivial-functions',
        language: 'swift',
        limit: 'min_function_statements',
        file: 'source.swift',
        source: 'func perform() {\nfirst()\nsecond()\nthird()\n}\n',
        rule: 'trivial-function',
    },
    {
        check: 'structure/trivial-functions',
        language: 'bash',
        limit: 'min_function_statements',
        file: 'source.sh',
        source: 'perform() {\nfirst\nsecond\nthird\n}\n',
        rule: 'trivial-function',
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

export const VUE_TSC_SKIP = [
    {
        check: 'vue/vue-tsc',
        skip: { cause: 'condition', note: 'Needs the typescript configuration, which this scope does not select.' },
    },
] as const;
