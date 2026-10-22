import type { Tool } from '#cli/types/configurations.ts';

/** Each fixer result: its exit code, the file bytes it leaves, and the note of a failure. */
export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        script: 'await Bun.write(\'source.txt\', "original"); process.exitCode = 3',
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'finding exit with corrected bytes',
        script: 'await Bun.write(\'source.txt\', "corrected"); process.exitCode = 3',
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
        note: undefined,
    },
    {
        name: 'undeclared exit with partial bytes',
        script: 'await Bun.write(\'source.txt\', "partial"); process.exitCode = 4',
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'sandbox/fixer exited 4',
    },
    {
        name: 'default exit with original bytes',
        script: 'process.exitCode = 0',
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'default failure with original bytes',
        script: 'process.exitCode = 3',
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;

/** A program pin whose version check fails. */
export const FAILING_VERSION_TOOL: Tool = {
    name: 'version-teller',
    version: '3.8.1',
    installers: {},
    kind: 'program',
    version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
};
