import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { formatRunReport } from '#cli/commands/check/report.ts';
import { FINDINGS_SHOWN } from '#cli/config/commands/check.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const VERBOSITY_ARGUMENTS = ['check', '--only', 'example/findings,example/passing', '--base', 'HEAD'] as const;

const FINDING_COUNT = FINDINGS_SHOWN + 1;

const FINDINGS_TOOL_ARGUMENTS = [
    ...Array.from({ length: FINDING_COUNT }, (_, index) => ['--line', `finding ${String(index + 1)}.`]).flat(),
    '--exit',
    '1',
];

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
        { check: 'example/findings', status: 'failed', count: FINDING_COUNT },
        { check: 'example/passing', status: 'passed', count: 0 },
    ]);
    expect(json.report.checks.flatMap(({ findings }) => findings.map(({ explain }) => explain))).toStrictEqual(
        Array.from({ length: FINDING_COUNT }, () => 'gspot explain example/findings'),
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
    expect(result.stdout.match(/^ {2}finding \d+\.$/gmu)).toHaveLength(FINDINGS_SHOWN);
    expect(result.stdout).toContain('  and 1 more (--verbose prints every finding)');
    await assertJsonFindings(sandbox.path, VERBOSITY_ARGUMENTS);
});

test('check --verbose prints every finding and the command', async () => {
    const findingsCommand = buildProgramCommand('fakes/tool', ...FINDINGS_TOOL_ARGUMENTS);
    const passingCommand = buildProgramCommand('fakes/tool');
    await using sandbox = await createVerbositySandbox(findingsCommand, passingCommand);
    const result = await runGspot(sandbox.path, [...VERBOSITY_ARGUMENTS, '--verbose']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout.match(/^ {2}finding \d+\.$/gmu)).toHaveLength(FINDING_COUNT);
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

test.each([
    {
        fixCommand: 'gspot check --fix --only bash/shellcheck',
        help: 'Run the fix: command that the report prints. Quote it.',
    },
    { fixCommand: undefined, help: 'Quote it.' },
])('a fixable finding prints the fix sentence only with a fix line: $help', ({ fixCommand, help }) => {
    const [check] = FAILED_CHECK_REPORT.checks;
    const findings = check.findings.map((finding) => ({
        ...finding,
        fixable: true,
        help: 'Run the `fix:` command that the report prints. Quote it.',
    }));
    const report = { ...FAILED_CHECK_REPORT, checks: [{ ...check, findings, ...(fixCommand && { fixCommand }) }] };
    const text = stripVTControlCharacters(formatRunReport(report, { verbose: false }));
    expect(text).toContain(`  help: ${help} Details: `);
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
});
