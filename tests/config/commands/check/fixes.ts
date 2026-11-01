export const FIX_SUMMARY_CASES = [
    {
        name: 'no changes',
        paths: [],
        appliedText: 'No fixer changed anything.',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        appliedText: 'Fixed 2 files: other.txt, source.txt. The changes are not staged.',
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
        name: 'default failure with original bytes',
        toolArguments: ['--exit', '3'],
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;
