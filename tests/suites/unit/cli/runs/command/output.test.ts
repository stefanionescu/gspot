import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { FAILED_RUN } from '#tests/config/runs/samples.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { TAIL_LINES } from '#cli/config/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { isReportedCrash, formatOutputTail, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    BASE_CHECK,
    ESLINT_CRASH,
    LOCATED_CHECK,
    LOCATED_OUTPUT,
    FILELESS_CHECKS,
    SCOPE_PATH_CHECK,
    TIMESTAMP_OUTPUT,
    MISSING_LOCATED_FILE,
    ESLINT_MANIFEST_TOOL,
    BANNER_FAILURE_COMMAND,
} from '#tests/config/runs/command.ts';

test('a shortened failure output keeps the last line of stdout and of stderr', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = formatOutputTail(
        {
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
        },
        'empty',
    );
    const tail = Array.from(
        { length: TAIL_LINES - 1 },
        (_, index) => `progress ${String(30 - TAIL_LINES + 1 + index)}`,
    );
    expect(detail).toBe([...tail, 'stderr failure', ...tail, 'stdout failure'].join('\n'));
});

test(`a tool's crash pattern marks a crash for a check without its own pattern`, () => {
    expect(isReportedCrash(BASE_CHECK, ESLINT_MANIFEST_TOOL, buildProcessResult(ESLINT_CRASH))).toBe(true);
    expect(
        isReportedCrash(
            BASE_CHECK,
            ESLINT_MANIFEST_TOOL,
            buildProcessResult({ ...ESLINT_CRASH, stderr: '1 problem\n' }),
        ),
    ).toBe(false);
    expect(isReportedCrash(BASE_CHECK, undefined, buildProcessResult(ESLINT_CRASH))).toBe(false);
});

test('regex output that names no real file, or nothing, on a failed run is a check error, and output with one real file keeps every finding', async () => {
    await using sandbox = await testdir({
        'source.txt': 'source',
    });

    const planned = { check: LOCATED_CHECK, tool: { name: 'tool', installers: {}, kind: 'program' as const } };
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(
        parseCommandFindings(planned, buildProcessResult({ ...FAILED_RUN, stdout: TIMESTAMP_OUTPUT }), paths).note,
    ).toBe('tool failed with exit 1:\n2026-09-19T02: FATAL');
    expect(parseCommandFindings(planned, buildProcessResult(FAILED_RUN), paths).note).toBe(
        'tool failed with exit 1 and printed nothing.',
    );
    expect(
        parseCommandFindings(
            planned,
            buildProcessResult({ ...FAILED_RUN, stdout: TIMESTAMP_OUTPUT + LOCATED_OUTPUT }),
            paths,
        ).findings,
    ).toStrictEqual([
        { check: LOCATED_CHECK.id, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
        { check: LOCATED_CHECK.id, file: 'source.txt', message: 'located defect', help: '', fixable: false },
    ]);
    expect(parseCommandFindings(planned, buildProcessResult(), paths).findings).toStrictEqual([]);
});

test.each([...FILELESS_CHECKS])('$id accepts a fileless result without classifying it as a crash', async (check) => {
    await using sandbox = await testdir();
    expect(
        parseCommandFindings({ check }, buildProcessResult(FAILED_RUN), { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});
test('an ESLint finding whose source text holds a module error word stays a finding, and a real module error becomes a note', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['javascript/eslint'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify([
        {
            filePath: join(sandbox.path, path),
            source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
            messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
        },
    ]);
    const result = buildProcessResult({ stdout, stderr: '', code: 1, missing: false, duration: 1 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toMatchObject([
        { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 2, stderr: 'ConfigError: invalid configuration' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBe(`eslint failed with exit 2:\nConfigError: invalid configuration\n${stdout}`);
    expect(
        parseCommandFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBe('eslint failed with exit 2:\nOops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin');
});

test.each(['{file}', '{files}'])(
    'declared exit codes tell partial findings from a fatal %s run',
    async (placeholder) => {
        await using sandbox = await testdir();
        const source = 'input.txt';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/exit-contract',
                            command: [process.execPath, 'checker.cjs', placeholder],
                            paths: [source],
                            stage: 'commit',
                            exit_codes: [1],
                            output: {
                                format: 'regex',
                                pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$`,
                            },
                        },
                    ],
                }),
            }),
            [source]: '1',
            'checker.cjs':
                'const fs = require("node:fs"); const file = process.argv[2]; const status = Number(fs.readFileSync(file, "utf8")); if (status !== 0) console.log(`${file}:1: Located defect before exit`); process.exitCode = status;',
        });
        const session = await openSession(sandbox.path);
        const plans = planChecks(session, { stage: 'all', only: ['project/exit-contract'] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
        const finding = await runCheckCommand(session, planned);
        expect(finding.status).toBe('failed');
        expect(finding.findings).toStrictEqual([
            matchFields({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        await writeFile(join(sandbox.path, source), '7');
        const fatal = await runCheckCommand(session, planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toBe(`${process.execPath} failed with exit 7:\ninput.txt:1: Located defect before exit`);
    },
);

test('per-file failures drop only the header lines the tool declares', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/native',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: BANNER_FAILURE_COMMAND,
                    },
                ],
            }),
        }),
        'source.txt': 'source\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['project/native'] })[0]!;
    const unfiltered = await runCheckCommand(session, planned);
    expect(unfiltered.status).toBe('failed');
    expect(unfiltered.findings).toMatchObject([{ file: 'source.txt', message: 'Banner: scanner 1' }]);
    const filtered = await runCheckCommand(session, {
        ...planned,
        tool: { ...planned.tool!, finding_header_pattern: '^Banner:' },
    });
    expect(filtered.status).toBe('failed');
    expect(filtered.findings).toMatchObject([{ file: 'source.txt', message: 'Native input failed.' }]);
});

test('a regex finding in a file that does not exist is a note until the file exists', async () => {
    await using sandbox = await testdir();
    const source = 'unchanged input\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: String.raw`[[command_check]]
id = "notes/regex"
command = ${JSON.stringify(buildProgramCommand('fakes/tool'))}
paths = ["notes/**"]
stage = "commit"
[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/selected.txt': source,
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['notes/regex'] })[0]!;
    const result = buildProcessResult(MISSING_LOCATED_FILE);
    const paths = { root: sandbox.path, cwd: sandbox.path };
    const expected = [{ check: 'notes/regex', file: 'notes/reported.txt', line: 1, message: 'A defect.' }];
    expect(parseCommandFindings(planned, result, paths)).toStrictEqual({
        note: `${process.execPath} failed with exit 1:\nnotes/reported.txt:1:A defect.`,
    });
    await writeFile(join(sandbox.path, 'notes/reported.txt'), source);
    expect(parseCommandFindings(planned, result, paths).findings).toMatchObject(expected);
});

test('a tool that runs out of memory gets a cause instead of the garbage collector dump', () => {
    const dump =
        '<--- Last few GCs --->\n[4242:0x1] 9000 ms: Mark-Compact 4047.9 (4130.5) -> 4033.4 (4131.2) MB\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n';
    expect(formatOutputTail({ stdout: '', stderr: dump })).toBe(
        'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.',
    );
});

test('a finding in a folder outside the scope keeps its repository path when the check runs in the scope folder', async () => {
    await using sandbox = await testdir(SCOPE_PATH_CHECK.files);
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] }).find(
        (check) => check.scope.folder.path === 'app',
    )!;
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
    planned.check.command = [...SCOPE_PATH_CHECK.command];
    planned.check.output = SCOPE_PATH_CHECK.output;

    const checked = await runCheckCommand(session, planned);

    expect(checked.findings.map(({ file }) => file)).toStrictEqual(['lib/x.ts', 'app/src/a.swift']);
});

test('a network crash names the network requirement and keeps only the last stderr line', async () => {
    await using sandbox = await testdir();
    const check = { ...BASE_CHECK, needs: ['network' as const], exit_codes: [0] };
    const result = buildProcessResult({ code: 2, stdout: '{"Results":[]}', stderr: 'scan log\nrequest refused\n' });
    expect(parseCommandFindings({ check }, result, { cwd: sandbox.path, root: sandbox.path }).note).toBe(
        `${check.id} failed with exit 2. It needs network access: check the network or proxy, then run again.\nrequest refused`,
    );
});

test('a crash tail keeps the cause and hides stack frames', () => {
    const result = {
        stdout: '',
        stderr: 'Error: Cannot find package example\n    at load (loader.js:1:2)\n    at start (main.js:2:3)',
    };
    expect(formatOutputTail(result)).toBe('Error: Cannot find package example');
    expect(formatOutputTail(result, '', { verbose: true })).toBe(result.stderr);
});

test('a crash tail hides stack frames at the beginning of either stream', () => {
    const result = {
        stdout: '    at output (stdout.js:1:2)\nError: stdout cause',
        stderr: '    at error (stderr.js:2:3)\nError: stderr cause',
    };
    expect(formatOutputTail(result)).toBe('Error: stderr cause\nError: stdout cause');
    expect(formatOutputTail(result, '', { verbose: true })).toBe(
        'at error (stderr.js:2:3)\nError: stderr cause\nat output (stdout.js:1:2)\nError: stdout cause',
    );
});
