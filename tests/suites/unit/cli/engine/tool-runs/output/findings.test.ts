import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { buildCheckResult, parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { CHECK_GENERATION } from '#cli/generation/check-generation.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { BASE_CHECK, LOCATED_CHECK, REGEX_OUTPUT_CASES } from '#tests/config/engine/tool-runs.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

function buildLinkReport(line: string): string[] {
    return buildProgramCommand('fakes/tool', '--line', 'Errors in guide.md', '--line', line, '--exit', '2', '{files}');
}

test.each([...REGEX_OUTPUT_CASES])('$title', async ({ result, expected }) => {
    await using sandbox = await testdir({ 'source.txt': 'source' });
    const planned = { check: LOCATED_CHECK, tool: { name: 'tool', installers: {}, kind: 'program' as const } };
    expect(
        parseCommandFindings(planned, buildProcessResult(result), { cwd: sandbox.path, root: sandbox.path }, {}),
    ).toStrictEqual(expected);
});

test('an ESLint finding whose source text holds a module error word stays a finding, and a real module error becomes a note', async () => {
    const path = 'source.ts';
    await using sandbox = await createGitSandbox({
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
    const result = buildProcessResult({ stdout, stderr: '', code: 1, duration: 1 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }, {}).findings).toMatchObject(
        [{ file: path, rule: 'no-unused-vars', line: 1, column: 7 }],
    );
    expect(
        parseCommandFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
            {},
        ).note,
    ).toBe('eslint failed with exit 2:\nOops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin');
});

test('declared exit codes tell partial findings from a fatal {file} run', async () => {
    const source = 'input.txt';
    const located = `${source}:1: Located defect before exit`;
    const tables = stringify({
        command_check: [
            {
                id: 'project/exit-contract',
                command: buildProgramCommand('fakes/tool', '--line', located, '--exit', '1', '{file}'),
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
        command: buildProgramCommand('fakes/tool', '--line', located, '--exit', '7', '{file}'),
    };
    const fatal = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(fatal.status).toBe('error');
    expect(fatal.findings).toStrictEqual([]);
    expect(fatal.note).toContain(located);
});

test('a run that exits nonzero only on file links that leave the root passes, and another failure stays an error', async () => {
    const link = pathToFileURL(resolve('/v0.1.0/README.md')).href;
    const tables = stringify({
        command_check: [
            {
                id: 'project/links',
                command: buildLinkReport(`[ERROR] ${link} | File not found`),
                paths: ['guide.md'],
                stage: 'commit',
                output: {
                    format: 'grouped',
                    file_pattern: '^Errors in (?<file>.+)$',
                    pattern: String.raw`^\[(?<rule>[A-Z]+)\] (?<message>\S+ \| .*)$`,
                },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
        'guide.md': '# Guide\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['project/links'] })[0]!;
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
    const passed = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(passed).toMatchObject({ status: 'passed', findings: [] });
    planned.check = { ...planned.check, command: buildLinkReport('The config file cannot load') };
    const crashed = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(crashed.status).toBe('error');
});

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

test('a command check whose pattern names no file passes on exit 0, and reports each matching line on a finding exit code', async () => {
    const results = [];
    for (const code of ['0', '1']) {
        const check = {
            id: 'project/bundle',
            command: buildProgramCommand('fakes/tool', '--line', 'bundle.js 41.5kb', '--exit', code),
            paths: ['input.txt'],
            stage: 'commit',
            runs: 'once',
            exit_codes: [1],
            output: { format: 'regex', pattern: '^(?<message>.+)$' },
        };
        const tables = stringify({ command_check: [check] });
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
            'input.txt': 'input\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'all', only: ['project/bundle'] })[0]!;
        planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
        const result = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
        results.push({ status: result.status, messages: result.findings.map(({ message }) => message) });
    }
    expect(results).toStrictEqual([
        { status: 'passed', messages: [] },
        { status: 'failed', messages: ['bundle.js 41.5kb'] },
    ]);
});

test('a shipped check whose pattern names no file keeps the lines that its tool prints on exit 0', () => {
    const planned = listChecksById(readConfigurations().values()).get('docker/compose')!;
    const warning = { check: planned.check.id, file: '', message: 'The variable is not set.', fixable: false };
    const result = buildCheckResult(planned, {
        base: { check: planned.check.id, scope: '', status: 'passed', fileCount: 1, duration: 0, findings: [] },
        state: { root: '/repo', cwd: '/repo', failed: false, findings: [warning] },
        commandArguments: ['docker'],
        start: performance.now(),
    });
    expect(result).toMatchObject({ status: 'failed', findings: [warning] });
});

test('a passing file format drops findings with neither a path nor a line', () => {
    const check = { ...BASE_CHECK, output: { format: 'json' as const, fields: { file: 'file', message: 'message' } } };
    const located = { check: check.id, file: 'source.ts', message: 'A defect.', fixable: false };
    const result = buildCheckResult(
        { check },
        {
            base: { check: check.id, scope: '', status: 'passed', fileCount: 1, duration: 0, findings: [] },
            state: {
                root: '/repo',
                cwd: '/repo',
                failed: false,
                findings: [located, { ...located, file: '', message: 'Banner' }],
            },
            commandArguments: ['tool'],
            start: performance.now(),
        },
    );
    expect(result.findings).toStrictEqual([located]);
    expect(result.status).toBe('failed');
});
