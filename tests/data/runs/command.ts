import type { Check } from '#cli/types/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

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

export const FAILED_RUN = { code: 1 } as const;

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} as const;

/** A command check that runs `bash -n` on each shell script at the commit stage. */
export const BASH_SYNTAX_CHECK = String.raw`[[command_check]]
id = "project/bash-syntax"
command = ["bash", "-n", "{file}"]
paths = ["**/*.sh"]
stage = "commit"
output = { format = "regex", pattern = "^.*: line (?<line>\\d+): (?<message>.*)$" }
`;

/** A Node program that reports each SQL file that holds `CREATE FUNCTION`. */
const SQL_CHECK_SCRIPT = `const fs = require('node:fs'); for (const path of process.argv.slice(1)) { if (fs.readFileSync(path, 'utf8').includes('CREATE FUNCTION')) { console.log(path + ':1: Replace the sample function.'); process.exitCode = 1; } }`;
export const SQL_COMMAND_CHECK_TABLES = `[[command_check]]
id = "project/read-sql"
paths = ["**/*.sql"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', SQL_CHECK_SCRIPT, '{files}'])}
`;

/** Settings with an API and a web scope. */
export const CHILD_SCOPE_SETTINGS = {
    rules: true,
    scopes: [
        { path: 'api', configurations: [] },
        { path: 'web', configurations: [] },
    ],
    tables: '\n[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\noutput.format = "none"\npaths = ["**/*.sh"]\nstage = "push"\n',
} as const;

/** The result of a command check that reports a file and line. */
export const PENDING_NOTE_RESULTS = [
    {
        check: 'notes/no-pending',
        status: 'failed',
        findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
    },
] as const;
/** Prints each line of the listed files that holds PENDING as file:line:text, the way grep -n -H does. */
export const PENDING_NOTES_SCRIPT = String.raw`let found = false;
for (const file of process.argv.slice(1)) {
    for (const [index, line] of (await Bun.file(file).text()).split('\n').entries())
        if (line.includes('PENDING')) { console.log(file + ':' + String(index + 1) + ':' + line); found = true; }
}
process.exit(found ? 1 : 0);`;

/** Command output that names a missing file. */
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
export const BANNER_FAILURE_SCRIPT =
    "console.error('Banner: scanner 1'); console.error('Native input failed.'); process.exitCode = 1;";
export const SCOPE_PATH_CHECK = {
    files: {
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[rules]\nenabled = false\n',
            scopes: [{ path: 'app' }],
        }),
        'app/src/a.swift': 'let value = 1\n',
        'lib/x.ts': 'export const value = 1;\n',
    },
    program: String.raw`console.log("../lib/x.ts:1: outside\nsrc/a.swift:2: inside");`,
    output: {
        ...LOCATED_CHECK.output,
        pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`,
    },
} as const;

/** Each format indent style with the shfmt indent argument. */
export const SHFMT_INDENT_CASES = [
    { style: 'space', width: 6, expected: '6' },
    { style: 'tab', width: 6, expected: '0' },
] as const;

/** An openapi.generate_command list with an empty and a multiword argument. */
export const GENERATE_ARGUMENTS = [process.execPath, 'generate.ts', '', 'two words'];

/** A program that passes only when its last four arguments equal GENERATE_ARGUMENTS. */
export const ARGUMENT_RUNNER = [
    process.execPath,
    '-e',
    `process.exitCode = JSON.stringify(process.argv.slice(-4)) === ${JSON.stringify(JSON.stringify(GENERATE_ARGUMENTS))} ? 0 : 1`,
    '--',
];
export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
] as const;
