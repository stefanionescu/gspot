import { join } from 'node:path';
import type { CloneReport } from '#cli/types/checks/general/duplication.ts';

export const JSCPD_SCOPE_FINDINGS = [
    {
        check: 'duplication/jscpd',
        help: 'Move the shared block into one function both callers use.',
        file: 'scripts/café.sh',
        line: 3,
        rule: 'clone',
        message: '30 lines repeat scripts/original.sh:7.',
        fixable: false,
    },
] as const;

/**
A jscpd report with a clone in the scope and one in vendor/, which the scope leaves out.

@param prefix the folder that jscpd puts before each path: empty for relative paths.
@returns the two clones as jscpd reports them.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The test builds the report once for each path mode, with its own prefix.
export function buildJscpdReport(prefix: string): CloneReport {
    return {
        duplicates: [
            {
                lines: 30,
                firstFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                secondFile: { name: join(prefix, 'scripts', 'café.sh'), start: 3, end: 32 },
            },
            {
                lines: 30,
                firstFile: { name: join(prefix, 'scripts', 'original.sh'), start: 7, end: 36 },
                secondFile: { name: join(prefix, 'vendor', 'copy.sh'), start: 1, end: 30 },
            },
        ],
    };
}
