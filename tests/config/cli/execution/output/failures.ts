import type { CheckSpec } from '#cli/types/configurations.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/output/shared.ts';

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} satisfies CheckSpec;

export const FILELESS_CHECKS = [
    {
        ...BASE_CHECK,
        name: 'sandbox/coverage',
        output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
    },
    {
        ...BASE_CHECK,
        name: 'sandbox/links',
        output: { format: 'regex', file_type: 'link', pattern: '(?<file>.+)' },
    },
    { ...BASE_CHECK, name: 'sandbox/lines', output: { format: 'lines' } },
] satisfies CheckSpec[];

export const FALSE_PATH = '2026-09-19T02: FATAL\n';

export const REAL_PATH = 'source.txt: located defect\n';
