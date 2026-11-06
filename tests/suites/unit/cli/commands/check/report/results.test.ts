import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { formatRunReport } from '#cli/commands/check/report.ts';
import { printProgress } from '#cli/engine/report.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import { FAILED_CHECK_REPORT, FINDINGS_TOOL_ARGUMENTS, VERBOSITY_ARGUMENTS } from '#tests/config/commands/check.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

async function createVerbositySandbox(
    findingsCommand: string[],
    passingCommand: string[],
): Promise<Awaited<ReturnType<typeof testdir>>> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'example/findings',
                        command: findingsCommand,
                        output: { format: 'regex', pattern: '(?<message>.+)' },
                        paths: ['source.txt'],
                        stage: 'commit',
                    },
                    { id: 'example/passing', command: passingCommand, paths: ['source.txt'], stage: 'commit' },
                ],
            }),
        }),
        'source.txt': 'before',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'after');
    return sandbox;
}

async function assertJsonFindings(root: string, commandArguments: readonly string[]): Promise<void> {
    const json = parseCheckReport(await runGspot(root, [...commandArguments, '--json']));
    expect(json.code, json.stdout + json.stderr).toBe(1);
    expect(
        json.report.checks.map(({ check, status, findings }) => ({ check, status, count: findings.length })),
    ).toStrictEqual([
        { check: 'example/findings', status: 'failed', count: 201 },
        { check: 'example/passing', status: 'passed', count: 0 },
    ]);
    expect(json.report.checks.flatMap(({ findings }) => findings.map(({ explain }) => explain))).toStrictEqual(
        Array.from({ length: 201 }, () => 'gspot explain example/findings'),
    );
    expect(json.stderr).toBe('');
}

test('check prints the first findings and the count of the rest, and --json keeps every finding', async () => {
    await using sandbox = await createVerbositySandbox(
        buildProgramCommand('fakes/tool', ...FINDINGS_TOOL_ARGUMENTS),
        buildProgramCommand('fakes/tool'),
    );
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout.match(/^ {2}finding \d+\.$/gmu)).toHaveLength(200);
    expect(result.stdout).toContain('  and 1 more (--verbose prints every finding)');
    await assertJsonFindings(sandbox.path, VERBOSITY_ARGUMENTS);
});

test('check --verbose prints every finding and the command', async () => {
    const findingsCommand = buildProgramCommand('fakes/tool', ...FINDINGS_TOOL_ARGUMENTS);
    const passingCommand = buildProgramCommand('fakes/tool');
    await using sandbox = await createVerbositySandbox(findingsCommand, passingCommand);
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, '--verbose']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout.match(/^ {2}finding \d+\.$/gmu)).toHaveLength(201);
    expect(result.stdout).toContain(`  $ ${findingsCommand.join(' ')}`);
    expect(result.stdout).toContain(`  $ ${passingCommand.join(' ')}`);
});

test.each([
    {
        name: 'one rule',
        extra: [{ line: 9 }],
        help: ['  help: Quote it. Details: gspot explain bash/shellcheck SC2086'],
    },
    {
        name: 'two rules',
        extra: [{ line: 9 }, { line: 12, rule: 'SC2000', explain: 'gspot explain bash/shellcheck SC2000' }],
        help: ['  help: Quote it. Details: gspot explain bash/shellcheck <rule>'],
    },
    {
        name: 'a finding with its own help',
        extra: [{ line: 12, help: 'Split it.' }],
        help: [
            '  help: Quote it. Details: gspot explain bash/shellcheck SC2086',
            '  help: Split it. Details: gspot explain bash/shellcheck SC2086',
        ],
    },
])('a failed check prints each help once, after its findings: $name', ({ extra, help }) => {
    const [shellcheck] = FAILED_CHECK_REPORT.checks;
    const [finding] = shellcheck.findings;
    const findings = [finding, ...extra.map((fields) => ({ ...finding, ...fields }))];
    const text = stripVTControlCharacters(
        formatRunReport({ ...FAILED_CHECK_REPORT, checks: [{ ...shellcheck, findings }] }, { verbose: false }),
    );
    const lines = text.split('\n');
    const last = lines.findLastIndex((line) => line.startsWith('  a.sh:'));
    expect(lines.slice(last + 1, last + 1 + help.length)).toStrictEqual([...help]);
    expect(text.match(/help:/gu)).toHaveLength(help.length);
});

test.each([true, false])('report colors follow stdout when its terminal state is %p', (stdoutIsTerminal) => {
    using _environment = overrideEnvironment({ NO_COLOR: undefined, FORCE_COLOR: undefined });
    using _terminals = fakeTerminals([
        [process.stdout, stdoutIsTerminal],
        [process.stderr, !stdoutIsTerminal],
    ]);
    const text = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
    expect(text.includes('\u{1B}[')).toBe(stdoutIsTerminal);
    using _plain = overrideEnvironment({ NO_COLOR: '1' });
    expect(stripVTControlCharacters(text)).toBe(formatRunReport(FAILED_CHECK_REPORT, { verbose: false }));
});

test('verbose output prints the time before the first check above the total time', () => {
    const verbose = stripVTControlCharacters(formatRunReport(FAILED_CHECK_REPORT, { verbose: true, setup: 820 }));
    expect(verbose).toContain('\nSetup: 0.8s before the first check.\nTime: ');
    expect(formatRunReport(FAILED_CHECK_REPORT, { verbose: false, setup: 820 })).not.toContain('Setup:');
});

test('the report prints planned skips once with their reason only in verbose output', () => {
    const { rerun: _rerun, ...check } = FAILED_CHECK_REPORT.checks[0];
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [{ ...check, status: 'skipped', cause: 'condition', note: 'disabled', findings: [] }],
        skippedCount: { condition: 1 },
    };
    expect(formatRunReport(skipped, { verbose: false })).not.toContain('bash/shellcheck');
    expect(formatRunReport(skipped, { verbose: true })).toContain('skipped (condition)  bash/shellcheck  disabled');
});

test('the summary counts a check once under its worst result, and names the scopes that ran', () => {
    const [failed, passed] = FAILED_CHECK_REPORT.checks;
    const report: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [
            { ...failed, scope: 'api' },
            { ...failed, scope: 'web' },
            { ...passed, check: failed.check, scope: 'docs' },
            { ...passed, scope: 'api' },
            { ...passed, scope: 'web' },
        ],
        skippedCount: { 'no-files': 3 },
    };
    expect(stripVTControlCharacters(formatRunReport(report, { verbose: false }))).toContain(
        'Failed: 1 check with 2 findings. Passed: 1 check. Skipped: 3 checks.\n',
    );
});

test('terminal progress rewrites one status line, and a log prints only what runs past the interval', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    using _environment = overrideEnvironment({ NO_COLOR: undefined, TERM: 'xterm-256color' });
    for (const [isTerminal, lines] of [
        [true, terminal],
        [false, log],
    ] as const) {
        using _terminals = fakeTerminals([
            [process.stdout, true],
            [process.stderr, isTerminal],
        ]);
        using _write = spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            lines.push(String(chunk));
            return true;
        });
        const place = { total: 3, comparison: null };
        printProgress({ ...place, kind: 'finished', check: 'bash/shfmt', scope: '', duration: 1200, finished: 1 });
        printProgress({
            ...place,
            kind: 'running',
            running: [
                { check: 'python/ruff', scope: 'api' },
                { check: 'javascript/eslint', scope: '' },
            ],
            elapsed: 10_000,
            finished: 1,
        });
        printProgress({
            ...place,
            kind: 'finished',
            check: 'python/ruff',
            scope: 'api',
            duration: 12_300,
            finished: 2,
        });
    }
    expect(terminal).toHaveLength(3);
    for (const line of terminal) expect(line).toStartWith('\r\u{1B}[2K');
    expect(log).toStrictEqual([
        'running  api  python/ruff and javascript/eslint  10.0s\n',
        'done  api  python/ruff  12.3s\n',
    ]);
});

test.each([{ TERM: 'dumb' }, { NO_COLOR: '1' }])(
    'a terminal with %p gets the plain progress lines, without control sequences',
    (environment) => {
        const lines: string[] = [];
        using _environment = overrideEnvironment({ NO_COLOR: undefined, TERM: 'xterm-256color', ...environment });
        using _terminals = fakeTerminals([
            [process.stdout, true],
            [process.stderr, true],
        ]);
        using _write = spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            lines.push(String(chunk));
            return true;
        });
        printProgress({
            kind: 'finished',
            check: 'python/ruff',
            scope: '',
            duration: 12_300,
            finished: 1,
            total: 1,
            comparison: null,
        });
        expect(lines).toStrictEqual(['done  python/ruff  12.3s\n']);
    },
);

test('a staged report with unstaged changes names their count once', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Readme\n\nText.\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'README.md'), '# Readme\n\nNew text.\n');
    runGitStep(sandbox.path, ['add', 'README.md']);
    await writeFile(join(sandbox.path, 'README.md'), '# Readme\n\nNewer text.\n');
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'markdown/fences']);
    expect(result.stdout.split('\n').filter((line) => !line.startsWith('Time:'))).toStrictEqual([
        'Checked the staged files.',
        '1 file has unstaged changes that were not checked.',
        'Passed: 1 check. Skipped: 0 checks.',
        '',
    ]);
});

test('a finding message occupies one report line', () => {
    const report = {
        ...FAILED_CHECK_REPORT,
        checks: FAILED_CHECK_REPORT.checks.map((check) => ({
            ...check,
            findings: check.findings.map((finding) => ({
                ...finding,
                message: 'First line.\nSecond line.\r\nThird line.',
            })),
        })),
    };
    const text = formatRunReport(report, { verbose: false });
    expect(text).toContain('First line. Second line. Third line.');
    expect(text).not.toContain('\nSecond line.');
});
