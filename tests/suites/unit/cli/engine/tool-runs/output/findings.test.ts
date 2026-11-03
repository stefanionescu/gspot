import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { planChecks } from '#cli/engine/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildCheckResult, parseCommandFindings } from '#cli/engine/tool-runs/output.ts';

import {
    FAILED_RUN,
    BASE_CHECK,
    LOCATED_CHECK,
    FILELESS_CHECKS,
    REGEX_OUTPUT_CASES,
    MISSING_LOCATED_FILE,
} from '#tests/config/engine/tool-runs.ts';

test.each([...REGEX_OUTPUT_CASES])('$title', async ({ result, expected }) => {
    await using sandbox = await testdir({ 'source.txt': 'source' });
    const planned = { check: LOCATED_CHECK, tool: { name: 'tool', installers: {}, kind: 'program' as const } };
    expect(
        parseCommandFindings(planned, buildProcessResult(result), { cwd: sandbox.path, root: sandbox.path }, {}),
    ).toStrictEqual(expected);
});

test.each([...FILELESS_CHECKS])('$id accepts a fileless result without classifying it as a crash', async (check) => {
    await using sandbox = await testdir();
    expect(
        parseCommandFindings({ check }, buildProcessResult(FAILED_RUN), { cwd: sandbox.path, root: sandbox.path }, {})
            .findings,
    ).toStrictEqual([]);
});

test('an ESLint finding whose source text holds a module error word stays a finding, and a real module error becomes a note', async () => {
    await using sandbox = await createGitSandbox({});
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
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }, {}).findings).toMatchObject(
        [{ file: path, rule: 'no-unused-vars', line: 1, column: 7 }],
    );
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 2, stderr: 'ConfigError: invalid configuration' },
            { cwd: sandbox.path, root: sandbox.path },
            {},
        ).note,
    ).toBe('eslint failed with exit 2:\nConfigError: invalid configuration');
    expect(
        parseCommandFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
            {},
        ).note,
    ).toBe('eslint failed with exit 2:\nOops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin');
});

test.each(['{file}', '{files}'])(
    'declared exit codes tell partial findings from a fatal %s run',
    async (placeholder) => {
        const source = 'input.txt';
        const located = `${source}:1: Located defect before exit`;
        const tables = stringify({
            command_check: [
                {
                    id: 'project/exit-contract',
                    command: buildProgramCommand('fakes/tool', '--line', located, '--exit', '1', placeholder),
                    paths: [source],
                    stage: 'commit',
                    exit_codes: [1],
                    output: { format: 'regex', pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$` },
                },
            ],
        });
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
            [source]: 'input\n',
        });
        const session = await openSession(sandbox.path);
        const plans = planChecks(session, { stage: 'all', only: ['project/exit-contract'] });
        const planned = plans[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
        const finding = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
        expect(finding.status).toBe('failed');
        expect(finding.findings).toStrictEqual([
            matchFields({ file: source, line: 1, message: 'Located defect before exit' }),
        ]);
        planned.check = {
            ...planned.check,
            command: buildProgramCommand('fakes/tool', '--line', located, '--exit', '7', placeholder),
        };
        const fatal = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
        expect(fatal.status).toBe('error');
        expect(fatal.findings).toStrictEqual([]);
        expect(fatal.note).toBe(`${process.execPath} failed with exit 7:\n${located}`);
    },
);

test('per-file failures drop only the header lines the tool declares', async () => {
    const command = buildProgramCommand(
        'fakes/tool',
        '--stderr',
        'Banner: scanner 1\nNative input failed.\n',
        '--exit',
        '1',
        '{file}',
    );
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [{ id: 'project/native', stage: 'commit', paths: ['source.txt'], command }],
            }),
        }),
        'source.txt': 'source\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['project/native'] })[0]!;
    const unfiltered = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(unfiltered.status).toBe('failed');
    expect(unfiltered.findings).toMatchObject([{ file: 'source.txt', message: 'Banner: scanner 1' }]);
    const filtered = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), {
        ...planned,
        tool: { ...planned.tool!, finding_header_pattern: '^Banner:' },
    });
    expect(filtered.status).toBe('failed');
    expect(filtered.findings).toMatchObject([{ file: 'source.txt', message: 'Native input failed.' }]);
});

test('a regex finding in a file that does not exist is a note until the file exists', async () => {
    await using sandbox = await createGitSandbox({});
    const source = 'unchanged input\n';
    const command = buildProgramCommand('fakes/tool');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: String.raw`[[command_check]]
id = "notes/regex"
command = ${JSON.stringify(command)}
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
    expect(parseCommandFindings(planned, result, paths, {})).toStrictEqual({
        note: `${process.execPath} failed with exit 1:\nnotes/reported.txt:1:A defect.`,
    });
    await writeFile(join(sandbox.path, 'notes/reported.txt'), source);
    expect(parseCommandFindings(planned, result, paths, {}).findings).toMatchObject(expected);
});

test('a finding in a folder outside the scope keeps its repository path when the check runs in the scope folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: 'app' }] }),
        'app/src/a.swift': SWIFT_VALUE_SOURCE,
        'lib/x.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] }).find(
        (check) => check.scope.path === 'app',
    )!;
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
    planned.check = {
        ...planned.check,
        command: buildProgramCommand(
            'fakes/tool',
            '--line',
            '../lib/x.ts:1: outside',
            '--line',
            'src/a.swift:2: inside',
        ),
        output: {
            ...LOCATED_CHECK.output,
            pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`,
        },
    };

    const checked = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);

    expect(checked.findings.map(({ file }) => file)).toStrictEqual(['lib/x.ts', 'app/src/a.swift']);
});

test('a passing file format drops findings with neither a path nor a line', () => {
    const check = { ...BASE_CHECK, output: { format: 'json' as const, fields: { file: 'file', message: 'message' } } };
    const located = { check: check.id, file: 'source.ts', message: 'A defect.', fixable: false };
    const result = buildCheckResult(check, {
        base: { check: check.id, scope: '', status: 'passed', fileCount: 1, duration: 0, findings: [] },
        state: {
            root: '/repo',
            cwd: '/repo',
            failed: false,
            findings: [located, { ...located, file: '', message: 'Banner' }],
        },
        commandArguments: ['tool'],
        start: performance.now(),
    });
    expect(result.findings).toStrictEqual([located]);
    expect(result.status).toBe('failed');
});
