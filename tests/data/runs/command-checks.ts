import { buildSandboxSettings } from '#tests/setup/settings.ts';

// A check that records its inputs and passes corrected ones, and a fixer that corrects them.
export const QUALITY_COMMAND = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("checked.txt", JSON.stringify(paths) + "\n"); process.exit(paths.some(path => fs.readFileSync(path, "utf8") !== "corrected\n") ? 1 : 0);`,
    '--',
    '{files}',
] as const;

export const QUALITY_FIX = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("fixed.txt", JSON.stringify(paths) + "\n"); for (const path of paths) fs.writeFileSync(path, "corrected\n");`,
    '--',
    '{files}',
] as const;

/** Marks the program ready only after the full process ID gets written. */
export const SLOW_TOOL_PROGRAM =
    'require("node:fs").writeFileSync("started.tmp", String(process.pid)); require("node:fs").renameSync("started.tmp", "started.pid"); await Bun.sleep(60_000);';

export const ESLINT_CRASH = { code: 1, stderr: 'Oops! Something went wrong\n' } as const;

export const ESLINT_TOOL = {
    name: 'eslint',
    installers: {},
    kind: 'program' as const,
    crash_pattern: '^Oops! Something went wrong',
} as const;

export const BASE_CHECK = {
    name: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'recommended',
    stage: 'commit',
    runs: 'files',
    summary: '',
    why: '',
    help: '',
} as const;

export const FAILED_RUN = { code: 1 } as const;

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} as const;

export const FILELESS_CHECKS = [
    {
        ...BASE_CHECK,
        name: 'sandbox/coverage',
        output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
    },
    { ...BASE_CHECK, name: 'sandbox/lines', output: { format: 'lines' } },
] as const;

// Prints each line of the listed files that holds PENDING as file:line:text, the way grep -n -H does.
export const PENDING_NOTES_SCRIPT = String.raw`let found = false;
for (const file of process.argv.slice(1)) {
    for (const [index, line] of (await Bun.file(file).text()).split('\n').entries())
        if (line.includes('PENDING')) { console.log(file + ':' + String(index + 1) + ':' + line); found = true; }
}
process.exit(found ? 1 : 0);`;

export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
] as const;

export const FALSE_PATH = '2026-09-19T02: FATAL\n';

export const REAL_PATH = 'source.txt: located defect\n';

export const HEADER_FAILURE =
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
