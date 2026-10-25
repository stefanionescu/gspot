import type { Check } from '#cli/types/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

export const DASHED_FILE_PLACEHOLDERS = ['{file}', '{files}'];

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

export const SQL_CHECK_COMMAND = buildProgramCommand(
    'checks/search',
    '--text',
    'CREATE FUNCTION',
    '--report',
    'message',
    '--message',
    'Replace the sample function.',
    '--',
    '{files}',
);

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

export const PENDING_NOTES_CHECK = buildProgramCommand(
    'checks/search',
    '--text',
    'PENDING',
    '--report',
    'line',
    '--',
    '{files}',
);

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

export const TIMESTAMP_OUTPUT = '2026-09-19T02: FATAL\n';

export const LOCATED_OUTPUT = 'source.txt: located defect\n';

export const BANNER_FAILURE_COMMAND = buildProgramCommand(
    'fakes/tool',
    '--stderr',
    'Banner: scanner 1\nNative input failed.\n',
    '--exit',
    '1',
    '{file}',
);

export const SCOPE_PATH_CHECK = {
    files: {
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[rules]\nenabled = false\n',
            scopes: [{ path: 'app' }],
        }),
        'app/src/a.swift': 'let value = 1\n',
        'lib/x.ts': 'export const value = 1;\n',
    },
    command: buildProgramCommand('fakes/tool', '--line', '../lib/x.ts:1: outside', '--line', 'src/a.swift:2: inside'),
    output: {
        ...LOCATED_CHECK.output,
        pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`,
    },
} as const;

export const SHFMT_INDENT_CASES = [
    { style: 'space', width: 6, expected: '6' },
    { style: 'tab', width: 6, expected: '0' },
] as const;

export const GENERATE_ARGUMENTS = [process.execPath, 'generate.ts', '', 'two words'];

export const ARGUMENT_RUNNER = buildProgramCommand(
    'checks/arguments',
    '--equals',
    JSON.stringify(GENERATE_ARGUMENTS),
    '--',
);

export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
] as const;
