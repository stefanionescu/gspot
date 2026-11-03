import { join } from 'node:path';
import { testdir } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { stripVTControlCharacters } from 'node:util';
import { printProgress } from '#cli/engine/report.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    NO_COLOR_SETTINGS,
    VERBOSITY_ARGUMENTS,
    FAILED_CHECK_REPORT,
    FINDINGS_TOOL_ARGUMENTS,
} from '#tests/config/commands/check.ts';

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

test('findings share help only when their explain command also matches', () => {
    const [shellcheck] = FAILED_CHECK_REPORT.checks;
    const [finding] = shellcheck.findings;
    const shared: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [
            {
                ...shellcheck,
                findings: [finding, { ...finding, line: 9 }, { ...finding, line: 12, rule: 'SC2000' }],
            },
        ],
    };
    const text = stripVTControlCharacters(formatRunReport(shared, { verbose: false }));
    expect(text.match(/help: Quote it\. gspot explain bash\/shellcheck SC2086/gu)).toHaveLength(1);
    expect(text.match(/help: Quote it\. gspot explain bash\/shellcheck SC2000/gu)).toHaveLength(1);
    expect(text).toMatch(
        /a\.sh:9:3[^\n]*\n {2}help: Quote it\. gspot explain bash\/shellcheck SC2086\n {2}a\.sh:12:3/u,
    );
});

test('findings explain a lint rule and a built-in check with working commands', () => {
    const [check] = FAILED_CHECK_REPORT.checks;
    const [finding] = check.findings;
    const report: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [
            check,
            {
                ...check,
                check: 'repository/encoding',
                findings: [{ ...finding, check: 'repository/encoding', rule: 'path-encoding' }],
            },
        ],
    };
    const text = formatRunReport(report, { verbose: false });
    expect(text).toContain('help: Quote it. gspot explain bash/shellcheck SC2086');
    expect(text).toContain('help: Quote it. gspot explain repository/encoding\n');
    expect(text).not.toContain('gspot explain repository/encoding path-encoding');
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

test('the report prints planned skips once with their reason only in verbose output', () => {
    const { rerun: _rerun, ...check } = FAILED_CHECK_REPORT.checks[0];
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [{ ...check, status: 'skipped', cause: 'condition', note: 'disabled', findings: [] }],
    };
    expect(formatRunReport(skipped, { verbose: false })).not.toContain('bash/shellcheck');
    expect(formatRunReport(skipped, { verbose: true })).toContain('skipped  bash/shellcheck  disabled');
});

test('terminal progress rewrites one status line, and a log gets one line per finished check', () => {
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
        for (let index = 0; index < 5; index++)
            printProgress({
                check: 'python/ruff',
                scope: index === 0 ? 'api' : '',
                duration: 1200,
                finished: index + 1,
                total: 5,
                comparison: undefined,
            });
    }
    expect(terminal).toHaveLength(5);
    for (const line of terminal) expect(line).toStartWith('\r\u{1B}[2K');
    expect(log).toHaveLength(5);
    expect(log[0]).toBe('done  api  python/ruff  1.2s\n');
    expect(log[1]).toBe('done  python/ruff  1.2s\n');
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
            check: 'python/ruff',
            scope: '',
            duration: 1200,
            finished: 1,
            total: 1,
            comparison: undefined,
        });
        expect(lines).toStrictEqual(['done  python/ruff  1.2s\n']);
    },
);

test('NO_COLOR prints findings without color on terminal streams', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': NO_COLOR_SETTINGS });

    using _terminals = fakeTerminals([
        [process.stdout, true],
        [process.stderr, true],
    ]);
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/unmatched-paths'], {
        NO_COLOR: '1',
        CI: '',
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('absent/** under [[ignore]] matches no tracked file or folder.');
    expect(result.stdout).toContain('gspot/unmatched-paths');
    expect(result.stdout).not.toContain('\u{1B}[');
    expect(result.stderr).not.toContain('\u{1B}[');
    expect(result.stderr).not.toContain('\r');
});

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
