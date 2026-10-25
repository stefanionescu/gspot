import type { Check } from '#cli/types/configurations.ts';
import { FAILED_RUN } from '#tests/config/runs/samples.ts';

export const BASE_CHECK = {
    id: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'recommended',
    stage: 'commit',
    runs: 'files',
    summary: '',
    why: '',
    help: '',
    output: { format: 'lines' },
} satisfies Check;

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} as const;

export const CHILD_SCOPE_SETTINGS = {
    rules: true,
    scopes: [
        { path: 'api', configurations: [] },
        { path: 'web', configurations: [] },
    ],
    tables: '\n[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\noutput.format = "none"\npaths = ["**/*.sh"]\nstage = "push"\n',
} as const;

export const PENDING_NOTE_RESULTS = [
    {
        check: 'notes/no-pending',
        status: 'failed',
        findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
    },
] as const;

export const MISSING_LOCATED_FILE = {
    code: 1,
    stdout: 'notes/reported.txt:1:A defect.',
    stderr: '',
    missing: false,
    duration: 1,
} as const;

export const ESLINT_CRASH = { code: 1, stderr: 'Oops! Something went wrong\n' } as const;

export const ESLINT_MANIFEST_TOOL = {
    name: 'eslint',
    installers: {},
    kind: 'program' as const,
    crash_pattern: '^Oops! Something went wrong',
} as const;

export const FILELESS_CHECKS = [
    {
        ...BASE_CHECK,
        id: 'sandbox/coverage',
        output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
    },
    { ...BASE_CHECK, id: 'sandbox/lines', output: { format: 'lines' } },
] as const;

export const REGEX_OUTPUT_CASES = [
    {
        title: 'regex output that names no real file on a failed run is a check error',
        result: { ...FAILED_RUN, stdout: '2026-09-19T02: FATAL\n' },
        expected: { note: 'tool failed with exit 1:\n2026-09-19T02: FATAL' },
    },
    {
        title: 'a failed run that prints nothing is a check error',
        result: FAILED_RUN,
        expected: { note: 'tool failed with exit 1 and printed nothing.' },
    },
    {
        title: 'regex output with one real file on a failed run keeps every finding',
        result: { ...FAILED_RUN, stdout: '2026-09-19T02: FATAL\nsource.txt: located defect\n' },
        expected: {
            findings: [
                { check: LOCATED_CHECK.id, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
                { check: LOCATED_CHECK.id, file: 'source.txt', message: 'located defect', help: '', fixable: false },
            ],
        },
    },
    { title: 'a passing run that prints nothing has no findings', result: {}, expected: { findings: [] } },
];

export const SHFMT_INDENT_CASES = [
    { style: 'space', width: 6, expected: '6' },
    { style: 'tab', width: 6, expected: '0' },
] as const;

export const GENERATE_ARGUMENTS = [process.execPath, 'generate.ts', '', 'two words'];

export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
] as const;
