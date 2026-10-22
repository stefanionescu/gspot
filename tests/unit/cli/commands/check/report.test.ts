import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stripVTControlCharacters } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { type RunReport } from '#cli/types/runs/run.ts';
import { setOutputOptions } from '#cli/system/terminal.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { printProgress, formatRunReport } from '#cli/commands/check/report.ts';
import { FINDINGS_SHOWN, PROGRESS_CLEAR } from '#cli/config/commands/check.ts';

import {
    VERBOSITY_FILES,
    NO_COLOR_SETTINGS,
    FAILED_REPORT_TEXT,
    VERBOSITY_ARGUMENTS,
    FAILED_CHECK_REPORT,
    SKIPPED_REPORT_CHECKS,
    COMPARISON_NOTICE_CASES,
    CHECK_REPORT_COMPARISONS,
} from '#tests/data/commands/check/report.ts';

async function assertReportRepair(root: string, commandArguments: readonly string[]): Promise<void> {
    const json = parseCheckReport(await runGspot(root, [...commandArguments, '--json']));
    expect(json.code, json.stdout + json.stderr).toBe(1);
    const report = json.report;
    expect(report.checks.find((check) => check.check === 'example/findings')?.findings).toHaveLength(
        FINDINGS_SHOWN + 1,
    );
    expect(report.checks.find((check) => check.check === 'example/passing')?.status).toBe('passed');
    expect(json.stderr).toBe('');
    await writeFile(join(root, 'findings.ts'), 'process.exitCode=0;');
    const repaired = await runGspot(root, [...commandArguments]);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect(await readFile(join(root, 'source.txt'), 'utf8')).toBe('after');
}

test('check prints the first findings and the count of the rest, and --json keeps every finding', async () => {
    await using sandbox = await testdir(VERBOSITY_FILES);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'after');
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout.includes('example/passing')).toBe(false);
    expect(result.stdout.includes('Checked the files changed since HEAD.')).toBe(true);
    expect(result.stdout.includes(`finding ${String(FINDINGS_SHOWN + 1)}.`)).toBe(false);
    expect(result.stdout.includes('and 1 more')).toBe(true);
    expect(result.stdout.includes('$ ')).toBe(false);
    await assertReportRepair(sandbox.path, VERBOSITY_ARGUMENTS);
});

test('check --verbose prints every finding and the command, and --json keeps every finding', async () => {
    await using sandbox = await testdir(VERBOSITY_FILES);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'after');
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, '--verbose']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout.includes('example/passing')).toBe(true);
    expect(result.stdout.includes('Checked the files changed since HEAD.')).toBe(true);
    expect(result.stdout.includes(`finding ${String(FINDINGS_SHOWN + 1)}.`)).toBe(true);
    expect(result.stdout.includes('and 1 more')).toBe(false);
    expect(result.stdout.includes('$ ')).toBe(true);
    await assertReportRepair(sandbox.path, [...VERBOSITY_ARGUMENTS, '--verbose']);
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

test('only --verbose prints each ignore with its reason', () => {
    const text = stripVTControlCharacters(formatRunReport(FAILED_CHECK_REPORT, { verbose: true }));
    expect(text.split('\n').filter((line) => line.startsWith('ignore     '))).toStrictEqual([
        'ignore     bash/shellcheck SC2312  why',
    ]);
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
    const lines = stripVTControlCharacters(formatRunReport(shared, { verbose: false })).split('\n');
    expect(lines.filter((line) => line === '  help: Quote it.')).toHaveLength(1);
    expect(lines.indexOf('  help: Quote it.')).toBe(
        lines.indexOf('  a.sh:9:3  SC2086  Double quote to prevent globbing.') + 1,
    );
    expect(lines).toContain('  help: Quote the path.');
});

test('colors change the report only by escape codes', () => {
    setOutputOptions({ json: false, color: false });
    const plain = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
    try {
        setOutputOptions({ json: false, color: true });
        const colored = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
    } finally {
        setOutputOptions({ json: false, color: false });
    }
    expect(formatRunReport(FAILED_CHECK_REPORT, { verbose: false })).toBe(plain);
});

test.each([...CHECK_REPORT_COMPARISONS])('the report names $content comparisons', ({ content, header }) => {
    const compared: RunReport = { ...FAILED_CHECK_REPORT, comparison: { content, reference: 'main' } };
    expect(formatRunReport(compared, { verbose: false })).toBe(
        header + formatRunReport(FAILED_CHECK_REPORT, { verbose: false }),
    );
});

test('the report prints planned skips once with their reason only in verbose output', () => {
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        checks: [
            { ...FAILED_CHECK_REPORT.checks[0], status: 'skipped', cause: 'condition', note: 'disabled', findings: [] },
        ],
    };
    expect(skipped.checks[0]?.cause).toBe('condition');
    expect(skipped).not.toHaveProperty('skips');
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
        for (let index = 0; index < 5; index++)
            printProgress({ completed: index + 1, total: 5, comparison: undefined });
        if (process.stderr.isTTY) process.stderr.write(PROGRESS_CLEAR);
    }
    expect(terminal).toStrictEqual([
        ...Array.from(
            { length: 5 },
            (_, index) => `\r\u001B[2KChecking the working tree: ${String(index + 1)} of 5 checks done`,
        ),
        '\r\u001B[2K',
    ]);
    expect(log).toStrictEqual([]);
});

test('NO_COLOR prints findings without color on terminal streams', async () => {
    await using sandbox = await testdir({ 'gspot.toml': NO_COLOR_SETTINGS });

    using resources = new DisposableStack();
    for (const stream of [process.stdout, process.stderr]) {
        const original = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (original === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', original);
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
    expect(result.stdout).not.toContain('\u001B[');
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
