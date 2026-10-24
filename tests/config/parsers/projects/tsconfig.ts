export const TSCONFIG_PARSE_ERRORS = [
    {
        name: 'a missing extends package',
        json: '{"extends":"absent-compiler-settings/tsconfig.json"}',
        message:
            "Cannot read the compiler settings in tsconfig.json: File 'absent-compiler-settings/tsconfig.json' not found.",
    },
    {
        name: 'invalid JSON',
        json: '{',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;
