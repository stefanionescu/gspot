/** Exit contracts and resulting bytes are independent parts of each correction outcome. */
export const FIXER_OUTCOMES = [
    {
        name: 'finding exit with original bytes',
        script: 'await Bun.write(\'source.txt\', "original"); process.exitCode = 3',
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'finding exit with corrected bytes',
        script: 'await Bun.write(\'source.txt\', "corrected"); process.exitCode = 3',
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
    },
    {
        name: 'undeclared exit with partial bytes',
        script: 'await Bun.write(\'source.txt\', "partial"); process.exitCode = 4',
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'exited 4',
    },
    {
        name: 'default exit with original bytes',
        script: 'process.exitCode = 0',
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'default failure with original bytes',
        script: 'process.exitCode = 3',
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'exited 3',
    },
];
