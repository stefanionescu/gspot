import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { STAGE_SCOPE_SETTINGS } from '#tests/data/commands/check/arguments.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('file and folder arguments narrow the files each check gets', async () => {
    await using sandbox = await testdir();
    const entries = ['one', 'two', 'three'].map((name) =>
        buildReportingCheck({ id: `sandbox/${name}`, paths: ['src/**', 'docs/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: entries }) }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    const selected = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            'src/selected.ts',
            'docs',
            '--only',
            'sandbox/one,sandbox/two',
            '--json',
        ]),
    );
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
        buildReportingCheck({ id: `sandbox/${name}`, paths: ['src/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: entries }) }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });
    const selected = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--only',
            'sandbox/one',
            'src/selected.ts',
            '--only',
            'sandbox/two',
            '--json',
        ]),
    );
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    expect(selected.report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of selected.report.checks)
        expect(check.findings.map((finding) => finding.message)).toStrictEqual(['src/selected.ts']);
});

test('path arguments keep the findings of a project-wide check in the named files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/project',
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
        }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });

    const narrowed = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'src/selected.ts', '--only', 'sandbox/project', '--json']),
    );
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(1);
    expect(narrowed.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual(['here', 'fileless']);
    const whole = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/project', '--json']));
    expect(whole.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual([
        'here',
        'elsewhere',
        'fileless',
    ]);
});

test('--staged keeps every stage while --hook pre-commit runs only commit checks', async () => {
    const definitions = ['commit', 'push', 'manual'].map(
        (name) => `
[[command_check]]\nid = "sandbox/${name}"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "${name}"
`,
    );
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: definitions.join('\n') }),
        'source.txt': 'input',
    });

    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'staged input');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    const staged = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/commit,sandbox/push', '--staged', '--json']),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    const stagedReport = staged.report;
    expect(stagedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/commit', 'passed'],
        ['sandbox/push', 'passed'],
    ]);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--only',
            'sandbox/commit,sandbox/push',
            '--hook',
            'pre-commit',
            '--json',
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = checked.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/commit', 'passed']]);
});

test('a manual check runs only when --only names it', async () => {
    const definition = `
[[command_check]]\nid = "sandbox/manual"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "manual"
`;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: definition }),
        'source.txt': 'input',
    });

    const plain = parseCheckReport(await runGspot(sandbox.path, ['check', '--json']));
    const initial = plain.report;
    expect(initial.checks.map((check) => check.check)).not.toContain('sandbox/manual');
    const named = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']));
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const report = named.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/manual', 'passed']]);
});

test('a scope path narrows to its checks and its reproduce command finds the same findings', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], STAGE_SCOPE_SETTINGS),
        'api/port.js': 'export const helperCommand = 1;\n',
        'web/port.js': 'export const helperCommand = 2;\n',
    });

    const selected = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']),
    );
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    const failed = report.checks.filter((check) => check.status === 'failed');
    expect(failed.map((check) => check.scope)).toStrictEqual(['api']);
    const command = failed.map(({ reproduce }) => reproduce);
    expect(command).toStrictEqual(['gspot check api --only naming/identifiers']);
    const repeated = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']),
    );
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = repeated.report;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});

test('a staged change to gspot.toml alone rechecks every file a configuration check covers', async () => {
    const loose = buildSandboxSettings(['sql'], {
        tables: '[limits.sql]\nfile_lines = 100\n',
        level: 'all',
    });
    const body = Array.from({ length: 12 }, (_, index) => `SELECT ${String(index)};`).join('\n');
    await using sandbox = await testdir({
        'gspot.toml': loose,
        'db/report.sql': `${body}\n`,
    });

    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), loose.replace('file_lines = 100', 'file_lines = 5'));
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'structure/long-files', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks[0]?.findings).toContainEqual(matchFields({ file: 'db/report.sql' }));
});
