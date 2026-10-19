import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSettingsText, buildReportingCheck } from '#tests/setup/settings.ts';

test('file and folder arguments narrow the files each check gets', async () => {
    await using sandbox = await testdir();
    const entries = ['one', 'two', 'three'].map((name) =>
        buildReportingCheck({ name: `sandbox/${name}`, paths: ['src/**', 'docs/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ configurations: [], command_check: entries }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    const selected = await checkReport(sandbox.path, [
        'check',
        'src/selected.ts',
        'docs',
        '--only',
        'sandbox/one,sandbox/two',
        '--json',
    ]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    expect(report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toStrictEqual(
            new Set(['docs/guide.md', 'src/selected.ts']),
        );
});

test('--only repeats and leaves the paths after it as paths', async () => {
    await using sandbox = await testdir();
    const entries = ['one', 'two', 'three'].map((name) =>
        buildReportingCheck({ name: `sandbox/${name}`, paths: ['src/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ configurations: [], command_check: entries }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });
    const selected = await checkReport(sandbox.path, [
        'check',
        '--only',
        'sandbox/one',
        'src/selected.ts',
        '--only',
        'sandbox/two',
        '--json',
    ]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    expect(selected.report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of selected.report.checks)
        expect(check.findings.map((finding) => finding.message)).toStrictEqual(['src/selected.ts']);
    const empty = await checkReport(sandbox.path, ['check', '--only', ',', '--json']);
    expect(empty.code).toBe(2);
    expect(empty.stdout + empty.stderr).toContain('Name a check, such as --only python/ruff.');
});

test('path arguments keep the findings of a project-wide check in the named files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'sandbox/project',
                    paths: ['src/**'],
                    stage: 'commit',
                    command: [
                        process.execPath,
                        '-e',
                        String.raw`console.log("src/selected.ts:demo:here\nsrc/other.ts:demo:elsewhere\n:demo:fileless"); process.exitCode = 1;`,
                    ],
                    output: { format: 'regex', pattern: '^(?<file>[^:]*):(?<rule>[^:]+):(?<message>.*)$' },
                },
            ],
        }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });
    const narrowed = await checkReport(sandbox.path, [
        'check',
        'src/selected.ts',
        '--only',
        'sandbox/project',
        '--json',
    ]);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(1);
    expect(narrowed.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual(['here', 'fileless']);
    const whole = await checkReport(sandbox.path, ['check', '--only', 'sandbox/project', '--json']);
    expect(whole.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual([
        'here',
        'elsewhere',
        'fileless',
    ]);
});

test('--staged keeps every stage while --hook pre-commit runs only commit checks', async () => {
    const definitions = ['commit', 'push', 'manual'].map(
        (name) => `
[[command_check]]\nname = "sandbox/${name}"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "${name}"
`,
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { tables: definitions.join('\n') }),
        'source.txt': 'input',
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'source.txt'), 'staged input');
    readGitOutput(sandbox.path, ['add', 'source.txt']);
    const staged = await checkReport(sandbox.path, [
        'check',
        '--only',
        'sandbox/commit,sandbox/push',
        '--staged',
        '--json',
    ]);
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    const stagedReport = staged.report;
    expect(stagedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/commit', 'passed'],
        ['sandbox/push', 'passed'],
    ]);
    const checked = await checkReport(sandbox.path, [
        'check',
        '--only',
        'sandbox/commit,sandbox/push',
        '--hook',
        'pre-commit',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = checked.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/commit', 'passed']]);
});

test('a manual check runs only when --only names it', async () => {
    const definition = `
[[command_check]]\nname = "sandbox/manual"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "manual"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { tables: definition }),
        'source.txt': 'input',
    });
    const plain = await checkReport(sandbox.path, ['check', '--json']);
    const initial = plain.report;
    expect(initial.checks.map((check) => check.check)).not.toContain('sandbox/manual');
    const named = await checkReport(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const report = named.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/manual', 'passed']]);
});

test('a scope path narrows to its checks and its reproduce command finds the same findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
configurations = []
[[scope]]
path = "api"
configurations = ["javascript", "naming"]
[[scope]]
path = "web"
configurations = ["javascript", "naming"]
`,
        'api/port.js': 'export const helperCommand = 1;\n',
        'web/port.js': 'export const helperCommand = 2;\n',
    });
    const selected = await checkReport(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    const failed = report.checks.filter((check) => check.status === 'failed');
    expect(failed.map((check) => check.scope)).toStrictEqual(['api']);
    const command = failed[0]?.reproduce;
    expect(command).toBeDefined();
    const repeated = await checkReport(sandbox.path, [...command!.split(' ').slice(1), '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = repeated.report;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});

test('a staged change to gspot.toml alone rechecks every file a configuration check covers', async () => {
    const loose = buildSettingsText(['sql'], {
        tables: '[limits.sql]\nfile_lines = 100\n',
        level: 'all',
    });
    const body = Array.from({ length: 12 }, (_, index) => `SELECT ${String(index)};`).join('\n');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': loose,
        'db/report.sql': `${body}\n`,
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), loose.replace('file_lines = 100', 'file_lines = 5'));
    readGitOutput(sandbox.path, ['add', 'gspot.toml']);
    const checked = await checkReport(sandbox.path, ['check', '--staged', '--only', 'structure/long-files', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks[0]?.findings).toContainEqual(matchFields({ file: 'db/report.sql' }));
});
