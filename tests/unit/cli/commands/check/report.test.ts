import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { stripVTControlCharacters } from 'node:util';
import { setOutputOptions } from '#cli/system/terminal.ts';
import { type RunReport } from '#cli/types/checks/run/check.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { PROGRESS_CLEAR, FINDINGS_SHOWN } from '#cli/config/terminal.ts';
import { printProgress, formatRunReport } from '#cli/commands/check/report.ts';

import {
    VERBOSITY_CASES,
    NO_COLOR_SETTINGS,
    CHECK_REPORT_HOOKS,
    FAILED_CHECK_REPORT,
    VERBOSITY_ARGUMENTS,
    CHECK_REPORT_STATUSES,
    CHECK_REPORT_COMPARISONS,
} from '#tests/data/commands/check.ts';

test.each([...VERBOSITY_CASES])(
    'check --verbose prints every finding and command while --json keeps every finding',
    async ({ flags, verbosity }) => {
        await using sandbox = await testdir();
        const checks = [
            { name: 'example/findings', command: [process.execPath, 'findings.ts'], output: { format: 'lines' } },
            { name: 'example/passing', command: [process.execPath, '-e', 'process.exitCode=0;'] },
        ].map((check) => ({ ...check, paths: ['source.txt'], stage: 'commit' }));
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({ configurations: [], command_check: checks }),
            'source.txt': 'before',
            'findings.ts': 'process.stdout.write(await Bun.file("findings.txt").text()); process.exitCode=1;',
            'findings.txt':
                Array.from({ length: FINDINGS_SHOWN + 1 }, (_, index) => `finding ${String(index + 1)}.`).join('\n') +
                '\n',
        });
        commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'source.txt'), 'after');
        const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, ...flags]);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.stderr).toBe('');
        expect(result.stdout.includes('example/passing')).toBe(verbosity === 'verbose');
        expect(result.stdout.includes('Checked the files changed since HEAD.')).toBe(true);
        expect(result.stdout.includes(`finding ${String(FINDINGS_SHOWN + 1)}.`)).toBe(verbosity === 'verbose');
        expect(result.stdout.includes('and 1 more')).toBe(verbosity !== 'verbose');
        expect(result.stdout.includes('$ ')).toBe(verbosity === 'verbose');
        const json = await checkReport(sandbox.path, [...VERBOSITY_ARGUMENTS, '--json', ...flags]);
        expect(json.code, json.stdout + json.stderr).toBe(1);
        const report = json.report;
        expect(report.checks.find((check) => check.check === 'example/findings')?.findings).toHaveLength(
            FINDINGS_SHOWN + 1,
        );
        expect(report.checks.find((check) => check.check === 'example/passing')?.status).toBe('passed');
        expect(json.stderr).toBe('');
        await Bun.write(join(sandbox.path, 'findings.ts'), 'process.exitCode=0;');
        const repaired = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, ...flags]);
        expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
        expect(repaired.stderr.split('\n').filter((line) => line.startsWith('root  example/'))).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('after');
    },
);

test('skipped checks do not count as passed, and an empty canceled run is incomplete', () => {
    const skipped: RunReport = {
        ...FAILED_CHECK_REPORT,
        failed: [],
        exitCode: 0,
        checks: [
            {
                check: 'example/skipped',
                scope: '',
                status: 'skipped',
                fileCount: 0,
                duration: 0,
                findings: [],
                note: 'disabled',
            },
        ],
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
test('one line per check, the findings with a help line, the reproduce lines and the summary', () => {
    const text = formatRunReport(FAILED_CHECK_REPORT, { verbose: false });
    expect(text).toContain('bash/shellcheck  failed  1 finding');
    expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
    expect(text).toContain('  help: Quote it.');
    expect(text).toContain('  run again: gspot check --only bash/shellcheck');
    expect(text).toContain('api  format/prettier  missing  prettier is not installed. Run: mise install');
    expect(text).toContain('ignores    1 (printed with --verbose)');
    expect(text).toEndWith(
        'Failed: 1 check with 1 finding. Could not run: 1 check (a tool is missing; run gspot install). Passed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 1.\n',
    );
});

test('--verbose prints ignores with their reasons', () => {
    expect(formatRunReport(FAILED_CHECK_REPORT, { verbose: false })).not.toContain('bash/shfmt');
    expect(formatRunReport(FAILED_CHECK_REPORT, { verbose: true })).toContain(
        'ignore     bash/shellcheck SC2312  why  (1 matched)',
    );
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
        checks: [{ ...FAILED_CHECK_REPORT.checks[0], status: 'skipped', note: 'disabled', findings: [] }],
        skips: [{ check: 'bash/shellcheck', cause: 'condition' }],
    };
    expect(formatRunReport(skipped, { verbose: false })).not.toContain('bash/shellcheck');
    expect(formatRunReport(skipped, { verbose: true }).split('bash/shellcheck  skipped')).toHaveLength(2);
    expect(formatRunReport(skipped, { verbose: true })).toContain('skipped  disabled');
    expect(formatRunReport(skipped, { verbose: false })).toContain('Skipped: 1 check.');
});

test.each([...CHECK_REPORT_HOOKS])(
    'a failed $hook report prints each reproduce line once and the hook bypass',
    ({ hook, command }) => {
        const text = formatRunReport(FAILED_CHECK_REPORT, { verbose: false, hook: hook });
        expect(text).toEndWith(`Bypass this hook once: git ${command} --no-verify\n`);
        expect(text.split('run again: gspot check --only bash/shellcheck')).toHaveLength(2);
        expect(formatRunReport({ ...FAILED_CHECK_REPORT, checks: [] }, { verbose: false, hook: hook })).toEndWith(
            `Bypass this hook once: git ${command} --no-verify\n`,
        );
        expect(formatRunReport({ ...FAILED_CHECK_REPORT, exitCode: 0 }, { verbose: false, hook: hook })).not.toContain(
            'Bypass this hook',
        );
    },
);

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
        for (const [index] of CHECK_REPORT_STATUSES.entries())
            printProgress({ completed: index + 1, total: CHECK_REPORT_STATUSES.length, comparison: undefined });
        printProgress(undefined);
    }
    expect(terminal).toStrictEqual([
        ...CHECK_REPORT_STATUSES.map(
            (_, index) => `\r\u001B[2KChecking the working tree: ${String(index + 1)} of 5 checks done`,
        ),
        '\r\u001B[2K',
    ]);
    expect(log).toStrictEqual([]);
});

test('NO_COLOR prints findings without color on terminal streams', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': NO_COLOR_SETTINGS });
    using resources = new DisposableStack();
    for (const stream of [process.stdout, process.stderr]) {
        const original = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (original === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', original);
        });
        Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
    }
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/unmatched-patterns'], {
        NO_COLOR: '1',
        CI: '',
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('absent/** under [[ignore]] matches no tracked file or folder.');
    expect(result.stdout).toContain('gspot/unmatched-patterns');
    expect(result.stdout).not.toContain('\u001B[');
    const stderr = result.stderr.replaceAll(PROGRESS_CLEAR, '');
    expect(stderr).toBe(stripVTControlCharacters(stderr));
});
