import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';
import { type RunReport } from '#cli/types/runs/run.ts';
import { setOutputOptions } from '#cli/system/terminal.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PROGRESS_CLEAR } from '#cli/config/commands/check/check.ts';
import { FINDINGS_SHOWN } from '#cli/config/commands/check/report.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { printProgress, formatRunReport } from '#cli/commands/check/report.ts';

import {
    DURATION,
    VERBOSITY_FILES,
    NO_COLOR_SETTINGS,
    FAILED_REPORT_TEXT,
    VERBOSITY_ARGUMENTS,
    FAILED_CHECK_REPORT,
    SKIPPED_REPORT_CHECKS,
    COMPARISON_NOTICE_CASES,
    CHECK_REPORT_COMPARISONS,
} from '#tests/config/commands/check/report.ts';

async function assertJsonFindings(root: string, commandArguments: readonly string[]): Promise<void> {
    const json = parseCheckReport(await runGspot(root, [...commandArguments, '--json']));
    expect(json.code, json.stdout + json.stderr).toBe(1);
    expect(
        json.report.checks.map(({ check, status, findings }) => ({ check, status, count: findings.length })),
    ).toStrictEqual([
        { check: 'example/findings', status: 'failed', count: FINDINGS_SHOWN + 1 },
        { check: 'example/passing', status: 'passed', count: 0 },
    ]);
    expect(json.stderr).toBe('');
}

test('check prints the first findings and the count of the rest, and --json keeps every finding', async () => {
    await using sandbox = await testdir(VERBOSITY_FILES);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'after');
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout.replaceAll(DURATION, '0.0s')).toBe(buildVerbosityReport(false));
    await assertJsonFindings(sandbox.path, VERBOSITY_ARGUMENTS);
});

test('check --verbose prints every finding and the command', async () => {
    await using sandbox = await testdir(VERBOSITY_FILES);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'after');
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, '--verbose']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout.replaceAll(DURATION, '0.0s')).toBe(buildVerbosityReport(true));
});

test('the summary counts skipped checks apart from passed ones, and an empty run still prints its exit code', () => {
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        failed: [],
        exitCode: 0,
        checks: [...SKIPPED_REPORT_CHECKS],
    };
    expect(formatRunReport(skipped, { verbose: false })).toEndWith(
        'Passed: 0 checks. Skipped: 1 check.\nTime: 0.0s. Exit code 0.\n',
    );
    expect(formatRunReport({ ...skipped, checks: [], exitCode: 2 }, { verbose: false })).toEndWith(
        'Time: 0.0s. Exit code 2.\n',
    );
    const corrected: RunReport = { ...skipped, checks: [{ ...skipped.checks[0]!, status: 'passed' }] };
    const text = formatRunReport(corrected, { verbose: false });
    expect(text).toEndWith('Passed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n');
});
test('a failed report prints each check with its findings, help, and reproduce line, the ignore count, and the summary', () => {
    expect(formatRunReport(FAILED_CHECK_REPORT, { verbose: false })).toBe(FAILED_REPORT_TEXT);
});

test('findings that share a help print it once, after the last of them', () => {
    const [shellcheck] = FAILED_CHECK_REPORT.checks;
    const [finding] = shellcheck.findings;
    const shared: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [
            {
                ...shellcheck,
                findings: [finding, { ...finding, line: 9 }, { ...finding, line: 12, help: 'Quote the path.' }],
            },
        ],
    };
    expect(stripVTControlCharacters(formatRunReport(shared, { verbose: false }))).toBe(
        'bash/shellcheck  failed  3 findings\n  a.sh:4:3  SC2086  Double quote to prevent globbing.\n  a.sh:9:3  SC2086  Double quote to prevent globbing.\n  help: Quote it.\n  a.sh:12:3  SC2086  Double quote to prevent globbing.\n  help: Quote the path.\n  run again: gspot check --only bash/shellcheck\n\nignores    1 (printed with --verbose)\nFailed: 1 check with 3 findings. Passed: 0 checks. Skipped: 0 checks.\nTime: 0.0s. Exit code 1.\n',
    );
});

test('colors change the report only by escape codes', () => {
    setOutputOptions({ json: false, color: false });
    const concise = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
    try {
        setOutputOptions({ json: false, color: true });
        const colored = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
        expect(colored).not.toBe(concise);
        expect(stripVTControlCharacters(colored)).toBe(concise);
    } finally {
        setOutputOptions({ json: false, color: false });
    }
});

test.each([...CHECK_REPORT_COMPARISONS])('the report names $content comparisons', ({ content, header }) => {
    const compared: RunReport = { ...FAILED_CHECK_REPORT, comparison: { content, reference: 'main' } };
    expect(formatRunReport(compared, { verbose: false })).toBe(
        header + formatRunReport(FAILED_CHECK_REPORT, { verbose: false }),
    );
});

test('the report prints planned skips once with their reason only in verbose output', () => {
    const { reproduce: _reproduce, ...check } = FAILED_CHECK_REPORT.checks[0];
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [{ ...check, status: 'skipped', cause: 'condition', note: 'disabled', findings: [] }],
    };
    expect(formatRunReport(skipped, { verbose: false })).toBe(
        'ignores    1 (printed with --verbose)\nPassed: 0 checks. Skipped: 1 check.\nTime: 0.0s. Exit code 1.\n',
    );
    expect(formatRunReport(skipped, { verbose: true })).toBe(
        'bash/shellcheck  skipped  disabled\n\nignore     bash/shellcheck SC2312  why\nPassed: 0 checks. Skipped: 1 check.\nTime: 0.0s. Exit code 1.\n',
    );
});

test('terminal progress rewrites one status line and log output stays empty', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    const stderr = process.stderr;
    using _environment = overrideEnvironment({ NO_COLOR: undefined });
    using resources = new DisposableStack();
    for (const [stream, key] of [
        [process.stdout, 'isTTY'],
        [stderr, 'write'],
        [stderr, 'isTTY'],
    ] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(stream, key);
        resources.defer(() => {
            if (descriptor === undefined) Reflect.deleteProperty(stream, key);
            else Object.defineProperty(stream, key, descriptor);
        });
    }
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    for (const [isTTY, lines] of [
        [true, terminal],
        [false, log],
    ] as const) {
        Object.defineProperty(stderr, 'isTTY', { value: isTTY, configurable: true });
        stderr.write = (chunk) => {
            lines.push(String(chunk));
            return true;
        };
        for (let index = 0; index < 5; index++) printProgress({ finished: index + 1, total: 5, comparison: undefined });
    }
    expect(terminal).toStrictEqual(
        Array.from(
            { length: 5 },
            (_, index) => `\r\u{1B}[2KChecking the working tree: ${String(index + 1)} of 5 checks done`,
        ),
    );
    expect(log).toStrictEqual([]);
});

test('NO_COLOR prints findings without color on terminal streams', async () => {
    await using sandbox = await testdir({ 'gspot.toml': NO_COLOR_SETTINGS });
    runGitStep(sandbox.path, ['init', '--quiet']);

    using resources = new DisposableStack();
    for (const stream of [process.stdout, process.stderr]) {
        const previous = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (previous === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', previous);
        });
        Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
    }
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/unmatched-paths'], {
        NO_COLOR: '1',
        CI: '',
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('absent/** under [[ignore]] matches no tracked file or folder.');
    expect(result.stdout).toContain('gspot/unmatched-paths');
    expect(result.stdout).not.toContain('\u{1B}[');
    expect(result.stderr).toEndWith(PROGRESS_CLEAR);
    const stderr = result.stderr.replaceAll(PROGRESS_CLEAR, '');
    expect(stderr).toBe(stripVTControlCharacters(stderr));
});

test.each([...COMPARISON_NOTICE_CASES])('a staged report names its comparison once: $notice', ({ count, notice }) => {
    const report: RunReport = {
        ...FAILED_CHECK_REPORT,
        comparison: { content: 'index', reference: 'staged' },
        checks: [],
        ignores: [],
        failed: [],
        unstagedChanges: count,
        duration: 0,
        exitCode: 0,
    };
    expect(formatRunReport(report, { verbose: false })).toBe(
        `Checked the staged files.\n${notice}\nPassed: 0 checks. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n`,
    );
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

function buildVerbosityReport(isVerbose: boolean): string {
    const total = String(FINDINGS_SHOWN + 1);
    return [
        'Checked the files changed since HEAD.',
        `example/findings  failed  ${total} findings`,
        ...(isVerbose ? [`  $ ${process.execPath} findings.ts`] : []),
        ...Array.from(
            { length: isVerbose ? FINDINGS_SHOWN + 1 : FINDINGS_SHOWN },
            (_, index) => `  finding ${String(index + 1)}.`,
        ),
        '  help: Read the command output; this repository declares the check.',
        ...(isVerbose ? [] : ['  and 1 more (--verbose prints every finding)']),
        '  run again: gspot check --only example/findings --changed HEAD',
        '',
        ...(isVerbose
            ? ['example/passing  passed  1 file  0.0s', `  $ ${buildProgramCommand('fakes/tool').join(' ')}`, '']
            : []),
        `Failed: 1 check with ${total} findings. Passed: 1 check. Skipped: 0 checks.`,
        'Time: 0.0s. Exit code 1.',
        '',
    ].join('\n');
}
