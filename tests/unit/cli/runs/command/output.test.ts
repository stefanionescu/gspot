import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { TYPO_REPORT } from '#tests/data/runs/output.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { isReportedCrash, formatOutputTail, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    REAL_PATH,
    BASE_CHECK,
    FAILED_RUN,
    FALSE_PATH,
    ESLINT_CRASH,
    LOCATED_CHECK,
    HEADER_FAILURE,
    FILELESS_CHECKS,
    SCOPE_PATH_CHECK,
    ESLINT_MANIFEST_TOOL,
} from '#tests/data/runs/command-checks.ts';

test('bounded failure output retains the final diagnostic from both streams', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = formatOutputTail(
        {
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
        },
        'empty',
    );
    expect(detail).toContain('stdout failure');
    expect(detail).toContain('stderr failure');
    expect(detail).not.toContain('progress 0\n');
    expect(detail.length).toBeLessThan(`${progress}\nstdout failure\n${progress}\nstderr failure`.length);
});

test("a tool's crash pattern detects crashes for every check that runs it", () => {
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

test('located output rejects false paths and empty failures while keeping mixed real findings', async () => {
    await using sandbox = await testdir({
        'source.txt': 'source',
    });

    // Any manifest turns on the real-file check.
    const planned = {
        check: LOCATED_CHECK,
        configuration: readConfigurations().get('data-files')!,
        tool: { name: 'tool', installers: {}, kind: 'program' as const },
    };
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(
        parseCommandFindings(planned, buildProcessResult({ ...FAILED_RUN, stdout: FALSE_PATH }), paths).note,
    ).toContain('tool crashed with exit 1.');
    expect(parseCommandFindings(planned, buildProcessResult(FAILED_RUN), paths).note).toContain(
        'tool crashed with exit 1.',
    );
    expect(
        parseCommandFindings(planned, buildProcessResult({ ...FAILED_RUN, stdout: FALSE_PATH + REAL_PATH }), paths)
            .findings,
    ).toStrictEqual([
        { check: LOCATED_CHECK.id, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
        { check: LOCATED_CHECK.id, file: 'source.txt', message: 'located defect', help: '', fixable: false },
    ]);
    expect(parseCommandFindings(planned, buildProcessResult(), paths).findings).toStrictEqual([]);
});

test.each([...FILELESS_CHECKS])('$name accepts a fileless result without classifying it as a crash', async (check) => {
    await using sandbox = await testdir();
    // Any manifest turns on the real-file check.
    const planned = {
        check,
        configuration: readConfigurations().get('data-files')!,
    };
    expect(
        parseCommandFindings(planned, buildProcessResult(FAILED_RUN), { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});

test('spelling tells typos findings from fatal exits', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['spelling/typos'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify(TYPO_REPORT);
    const result = buildProcessResult({ stdout, stderr: '', code: 2, missing: false, duration: 1 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toMatchObject([
        { file: 'sample.txt' },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 78, stderr: 'Invalid native configuration.' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});

test('source text naming module errors stays an ESLint finding', async () => {
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
    ).toBeDefined();
    expect(
        parseCommandFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toContain('ERR_MODULE_NOT_FOUND: plugin');
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
        expect(fatal.note).toContain('exit 7');
    },
);

test('per-file failures drop only the header lines the tool declares', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/native"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', HEADER_FAILURE, '{file}'])}\n`,
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

test('located output refuses a missing file and reports it once it exists', async () => {
    await using sandbox = await testdir();
    const source = 'unchanged input\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: String.raw`[[command_check]]
id = "notes/regex"
command = ${JSON.stringify([process.execPath, '-e', ''])}
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
    const configured = { ...planned, configuration: readConfigurations().get('data-files')! };
    const result = buildProcessResult({
        code: 1,
        stdout: 'notes/reported.txt:1:A defect.',
        stderr: '',
        missing: false,
        duration: 1,
    });
    const paths = { root: sandbox.path, cwd: sandbox.path };
    const expected = [{ check: 'notes/regex', file: 'notes/reported.txt', line: 1, message: 'A defect.' }];
    expect(planned.configuration).toBeUndefined();
    expect(parseCommandFindings(planned, result, paths).note).toBeDefined();
    expect(parseCommandFindings(configured, result, paths).note).toBeDefined();
    await writeFile(join(sandbox.path, 'notes/reported.txt'), source);
    expect(parseCommandFindings(planned, result, paths).findings).toMatchObject(expected);
    expect(parseCommandFindings(configured, result, paths).findings).toMatchObject(expected);
    expect(parseCommandFindings(planned, result, paths).findings).toStrictEqual(
        parseCommandFindings(configured, result, paths).findings,
    );
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
    planned.check.command = [process.execPath, '-e', SCOPE_PATH_CHECK.program];
    planned.check.output = SCOPE_PATH_CHECK.output;

    const checked = await runCheckCommand(session, planned);

    expect(checked.findings.map(({ file }) => file)).toStrictEqual(['lib/x.ts', 'app/src/a.swift']);
});
