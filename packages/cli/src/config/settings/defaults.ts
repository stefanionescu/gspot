/** Each SDK root picks its xcodebuild destination during init. */
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

export const SETTING_DEFAULTS = {
    file_lines: 300,
    function_lines: 60,
    function_parameters: 7,
    function_statements: 30,
    block_nesting: 3,
    callback_nesting: 3,
    cognitive_complexity: 8,
    cyclomatic_complexity: 8,
    function_branches: 8,
    function_returns: 4,
    function_assignments: 8,
    closure_lines: 60,
    type_lines: 300,
    index_exports: 20,
    trivial_function_statements: 2,
    shared_prefix_files: 2,
    max_file_kilobytes: 1024,
    max_sentence_words: 30,
    max_list_item_words: 45,
    max_paragraph_sentences: 6,
    min_lines: 8,
    min_tokens: 40,
    min_release_age_days: 7,
    percentage_maximum: 100,
    indent_width: 4,
    print_width: 120,
    max_characters: 35,
    max_words: 4,
    minProperties: 2,
    tool_timeout_seconds: 600,
} as const;
