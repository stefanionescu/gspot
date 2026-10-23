export const CONFLICTING_CONFIG_FILE_CASES = [
    ['recommended', []],
    [
        'all',
        [
            {
                file: '.commitlintrc.json',
                rule: 'conflicting-config-file',
                message:
                    'gspot writes the settings for commitlint, so .commitlintrc.json no longer applies. Delete it, and move any rule you need into gspot.toml.',
            },
        ],
    ],
] as const;
