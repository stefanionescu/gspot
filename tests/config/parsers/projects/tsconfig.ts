export const TSCONFIG_PARSE_ERRORS = [
    {
        name: 'a missing extends package',
        json: '{"extends":"absent-compiler-settings/tsconfig.json"}',
        message:
            'tsconfig.json extends absent-compiler-settings/tsconfig.json, which is not installed. Install the project dependencies, then run the command again.',
    },
    {
        name: 'invalid JSON',
        json: '{',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;
