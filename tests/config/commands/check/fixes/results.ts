import type { Tool } from '#cli/types/configurations.ts';
import { buildProgramCommand, buildProgramArguments } from '#tests/setup/system/programs.ts';

export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        fix: buildProgramCommand('fakes/tool', '--write', 'source.txt=original', '--exit', '3'),
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'finding exit with corrected bytes',
        fix: buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected', '--exit', '3'),
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
        note: undefined,
    },
    {
        name: 'undeclared exit with partial bytes',
        fix: buildProgramCommand('fakes/tool', '--write', 'source.txt=partial', '--exit', '4'),
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'sandbox/fixer exited 4',
    },
    {
        name: 'default exit with original bytes',
        fix: buildProgramCommand('fakes/tool'),
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'default failure with original bytes',
        fix: buildProgramCommand('fakes/tool', '--exit', '3'),
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;

export const FAILING_VERSION_TOOL: Tool = {
    name: 'version-teller',
    version: '3.8.1',
    installers: {},
    kind: 'program',
    version_command: buildProgramArguments('fakes/tool', '--line', '3.8.1', '--exit', '7'),
};
