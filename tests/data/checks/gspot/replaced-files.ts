/** The replaced-files findings at each level. */
export const REPLACED_FILE_CASES = [
    ['recommended', []],
    [
        'all',
        [
            {
                file: '.commitlintrc.json',
                rule: 'replaced-file',
                message:
                    'gspot writes the settings for commitlint, so .commitlintrc.json no longer applies. Delete it, and move any rule you need into gspot.toml.',
            },
        ],
    ],
] as const;
