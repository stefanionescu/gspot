export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, message: 'Cannot analyze Swift because the build exited 7.' },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: 'The swiftlint command failed (exit 7): The tool printed no error output.',
    },
] as const;

export const NESTED_SWIFTLINT_FILES = [
    'app/.swiftlint.yml',
    'app/Sources/.swiftlint.yml',
    'app/Sources/Feature/.swiftlint.yml',
] as const;
