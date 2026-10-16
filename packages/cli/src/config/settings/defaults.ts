/** SDK roots select the corresponding xcodebuild platform at initialization. */
export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);

export const COMMIT_SCOPES = ['root', 'hooks', 'deps'] as const;

export const BUILD_SCRIPT = ['run', 'build'] as const;

export const DEFAULT_FIELDS = {
    file_lines: {
        configurations: ['sql', 'structure'],
        description:
            'File limits are 140 for Bash, 400 for SQL, and 300 otherwise. Blank lines and comment-only lines do not count.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'swift', 'sql', 'bash'],
        language_defaults: { sql: 400, bash: 140 },
    },
    function_lines: {
        configurations: ['structure'],
        description: 'The most lines one function may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'swift', 'bash'],
        language_defaults: { bash: 40 },
    },
    function_parameters: {
        configurations: ['structure'],
        description: 'The most parameters one function may take.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'swift', 'sql'],
    },
    statements: {
        configurations: ['structure'],
        description: 'The most statements one function may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript'],
    },
    nesting: {
        configurations: ['structure'],
        description: 'How deep blocks may nest inside one function.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'bash'],
        language_defaults: { bash: 3 },
    },
    callback_nesting: {
        configurations: ['structure'],
        description: 'How deep callbacks may nest.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript'],
    },
    cognitive_complexity: {
        configurations: ['structure'],
        description: 'How hard a function is to follow, by the sonarjs cognitive score.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript'],
    },
    cyclomatic_complexity: {
        configurations: ['structure'],
        description: 'How many paths run through one function.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'swift'],
    },
    branches: {
        configurations: ['structure'],
        description: 'The most branches one function may have.',
        reason_needed: 'raising',
        languages: ['python', 'bash'],
        language_defaults: { python: 8, bash: 8 },
    },
    returns: {
        configurations: ['structure'],
        description: 'The most return statements one function may have.',
        reason_needed: 'raising',
        languages: ['python'],
        language_defaults: { python: 4 },
    },
    assignments: {
        configurations: ['structure'],
        description: 'The most variable assignments one shell function may make.',
        reason_needed: 'raising',
        language_defaults: { bash: 8 },
        languages: ['bash'],
    },
    closure_lines: {
        configurations: ['structure'],
        description: 'The most lines one Swift closure may have.',
        reason_needed: 'raising',
        language_defaults: { swift: 60 },
        languages: ['swift'],
    },
    type_lines: {
        configurations: ['structure'],
        description: 'The most lines one Swift type body may have.',
        reason_needed: 'raising',
        language_defaults: { swift: 300 },
        languages: ['swift'],
    },
    index_exports: {
        configurations: ['structure'],
        description: 'The most re-exports one index file may hold.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python'],
    },
    min_function_statements: {
        configurations: ['structure'],
        description:
            'Functions with this many statements or fewer are reported. Any whole number of 1 or more works, and a higher number reports more functions. Set it for one language under limits.`<language>`.',
        reason_needed: 'lowering',
        languages: ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'],
    },
    prefix_collisions: {
        configurations: ['structure'],
        description: 'The number of siblings sharing a name prefix that makes a finding.',
        reason_needed: 'raising',
    },
    file_kilobytes: {
        configurations: ['repository'],
        description:
            'The largest file Git may track, in kilobytes. Larger files need Git LFS or a linguist-generated or linguist-vendored mark in .gitattributes.',
        reason_needed: 'raising',
    },
    sentence_words: {
        configurations: ['prose'],
        description: 'The most words one sentence of documentation may have.',
        reason_needed: 'raising',
    },
    list_item_words: {
        configurations: ['prose'],
        description: 'The most words one list item may have.',
        reason_needed: 'raising',
    },
    paragraph_sentences: {
        configurations: ['prose'],
        description: 'The most sentences one paragraph may have.',
        reason_needed: 'raising',
    },
    min_duplicate_lines: {
        configurations: ['duplication'],
        description: 'The fewest lines a copied block has before it counts.',
        reason_needed: 'raising',
    },
    min_duplicate_tokens: {
        configurations: ['duplication'],
        description: 'The fewest tokens a copied block has before it counts.',
        reason_needed: 'raising',
    },
    duplicate_percent: {
        configurations: ['duplication'],
        description: 'The largest share of duplicated lines the check accepts, as a number out of 100.',
        reason_needed: 'raising',
    },
    banned_words: {
        configurations: ['naming'],
        description: 'Words this repository bans in identifiers, beyond the shipped groups.',
    },
    override: {
        configurations: ['naming'],
        description: 'Naming rules for repository-relative paths, in order; each record has its reason.',
    },
    project: {
        configurations: ['swift'],
        description:
            'The Xcode project or workspace, relative to the repository root. Init writes a detected project; when absent, use the Swift package.',
    },
    scheme: {
        configurations: ['swift'],
        description: 'The shared scheme the build, the analyzer, and Periphery use.',
    },
    destination: {
        configurations: ['swift'],
        description: 'The xcodebuild destination.',
    },
    allowed_entitlements: {
        configurations: ['xcode'],
        description: 'The entitlements the app may hold; empty turns the check off.',
    },
} as const;

export const RECORD_DESCRIPTIONS = {
    command_check_name:
        'The check ID that `--only` and `[[ignore]] check` use. It may not equal a configuration check.',
    ignore_check: 'The check whose findings you accept. Must be a known check or command check.',
    ignore_rule: 'One lint rule of that check.',
    ignore_paths: 'Where the ignore applies.',
    ignore_reason: 'Why the findings are accepted.',
    format_paths: 'The files these formatting values apply to.',
    module_name: 'The module name.',
    module_paths: 'The files of the module.',
    module_may_import: 'The modules it may import, besides itself.',
    target_name: 'A Swift target named in the coverage report.',
    target_lines: 'The least share of lines that target must cover. It replaces `coverage.lines` for the target.',
    target_reason: 'Why this target may cover less.',
    package_name: 'The package name, such as `lightningcss` or `@fontsource-variable/geist`.',
    package_version: 'The exact installed version. A record that matches no installed package is reported.',
    package_reason: 'Why its license is fine. Name the license here.',
    size_paths: 'Built files, such as `docs/dist/_astro/*.js`. The size check runs only when a record exists.',
    size_kilobytes: 'The most they may weigh together, compressed.',
    eslint_paths: 'The files.',
    eslint_rules: 'Rule options for these files.',
    eslint_runtime: 'The runtime of these files, such as `serviceworker` (the name the `globals` package uses).',
    v8r_paths: 'Files SchemaStore does not know.',
    v8r_url: 'The JSON Schema for them.',
} as const;

export const DEFAULT_VALUES = {
    file_lines: 300,
    function_lines: 60,
    function_parameters: 7,
    statements: 30,
    nesting: 3,
    callback_nesting: 3,
    cognitive_complexity: 8,
    cyclomatic_complexity: 8,
    branches: 8,
    returns: 4,
    assignments: 8,
    closure_lines: 60,
    type_lines: 300,
    index_exports: 20,
    min_function_statements: 2,
    prefix_collisions: 2,
    file_kilobytes: 1024,
    sentence_words: 30,
    list_item_words: 45,
    paragraph_sentences: 6,
    min_duplicate_lines: 8,
    min_duplicate_tokens: 40,
    duplicate_percent: 4,
    min_release_age_days: 7,
    percentage_maximum: 100,
    indent_width: 4,
    print_width: 120,
    max_characters: 35,
    max_words: 4,
    minProperties: 2,
    min_saving_percent_maximum: 100,
    min_saving_percent: 10,
    tool_timeout_seconds: 600,
} as const;
