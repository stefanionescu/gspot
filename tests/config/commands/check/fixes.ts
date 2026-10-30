export const FIX_SUMMARY_CASES = [
    {
        name: 'no changes',
        paths: [],
        appliedText:
            'No fixer changed anything.\nnote     Not checked: markdown (1 .md file). Run gspot add <name>, or gspot remove <name> --reason "<why>".\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        appliedText:
            'Fixed 2 files: other.txt, source.txt. The changes are not staged.\nnote     Not checked: markdown (1 .md file). Run gspot add <name>, or gspot remove <name> --reason "<why>".\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
] as const;

export const FIX_LINTER_CASES = [
    {
        configuration: 'javascript',
        tool: 'eslint',
        executable: 'eslint.js',
        path: 'sample.js',
        config: 'native.mjs',
        nativeConfiguration: 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];',
        invalidConfiguration: 'throw new Error("Invalid native configuration");',
        formatter: ['--format', 'json'],
        sample: 'missing()\n',
        partial: 'missing();\n',
        corrected: 'export {};\n',
    },
    {
        configuration: 'css',
        tool: 'stylelint',
        executable: 'stylelint.mjs',
        path: 'sample.css',
        config: 'native.json',
        nativeConfiguration: JSON.stringify({ rules: { 'color-hex-length': 'short', 'property-no-unknown': true } }),
        invalidConfiguration: '{',
        formatter: ['--formatter', 'unix'],
        sample: 'a { color: #ffffff; unknown: 1; }\n',
        partial: 'a { color: #fff; unknown: 1; }\n',
        corrected: 'a { color: #fff; }\n',
    },
] as const;

export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        toolArguments: ['--write', 'source.txt=original', '--exit', '3'],
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'finding exit with corrected bytes',
        toolArguments: ['--write', 'source.txt=corrected', '--exit', '3'],
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
        note: undefined,
    },
    {
        name: 'undeclared exit with partial bytes',
        toolArguments: ['--write', 'source.txt=partial', '--exit', '4'],
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'sandbox/fixer exited 4',
    },
    {
        name: 'default exit with original bytes',
        toolArguments: [],
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'default failure with original bytes',
        toolArguments: ['--exit', '3'],
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;
