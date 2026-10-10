// Bun sandboxes exercise file, stage, and scope selection through the public CLI.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/harness/expectations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { spawnGspot, checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy, reportingCheck } from '#tests/harness/policy.ts';

// A sandbox with three commit checks that report every file they receive.
async function selectionSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const entries = Object.fromEntries(
        ['one', 'two', 'three'].map((name) => [
            `sandbox/${name}`,
            reportingCheck({ paths: ['src/**', 'docs/**'], stage: 'commit' }),
        ]),
    );
    const sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ configurations: [], check: entries }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    return sandbox;
}

test('file and folder arguments intersect check lists, and --skip leaves the other checks', async () => {
    await using sandbox = await selectionSandbox();
    const selected = await checkReport(sandbox.path, [
        'check',
        'src/selected.ts',
        'docs',
        '--only',
        'sandbox/one',
        'sandbox/two',
        '--json',
    ]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    expect(report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toStrictEqual(
            new Set(['docs/guide.md', 'src/selected.ts']),
        );
    const skipped = await checkReport(sandbox.path, [
        'check',
        'src/selected.ts',
        '--only',
        'sandbox/one',
        'sandbox/two',
        'sandbox/three',
        '--skip',
        'sandbox/one',
        'sandbox/two',
        '--json',
    ]);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(1);
    const skippedReport = skipped.report;
    expect(skippedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/one', 'skipped'],
        ['sandbox/two', 'skipped'],
        ['sandbox/three', 'failed'],
    ]);
});

test('a program option ends a list option, so the path after it stays a file argument', async () => {
    await using sandbox = await selectionSandbox();
    const result = await checkReport(sandbox.path, ['check', '--only', 'sandbox/one', '--json', 'src/selected.ts']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one']);
    expect(report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual(['src/selected.ts']);
});

test('-C resolves file arguments from the folder it names', async () => {
    await using sandbox = await selectionSandbox();
    const relative = await spawnGspot(sandbox.path, [
        '-C',
        'src',
        'check',
        'selected.ts',
        '--only',
        'sandbox/one',
        '--json',
    ]);
    expect(relative.code, relative.stdout + relative.stderr).toBe(1);
    const relativeReport = JSON.parse(relative.stdout) as RunReport;
    expect(relativeReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'src/selected.ts',
    ]);
    const after = await spawnGspot(sandbox.path, [
        'check',
        '-C',
        'src',
        'selected.ts',
        '--only',
        'sandbox/one',
        '--json',
    ]);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const afterReport = JSON.parse(after.stdout) as RunReport;
    expect(afterReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'src/selected.ts',
    ]);
});

test('--staged keeps default stages while --hook pre-commit selects commit checks', async () => {
    using _environment = useEnvironment({ GSPOT_HOOK: 'pre-commit' });
    const definitions = ['commit', 'push', 'manual'].map(
        (name) => `
[check."sandbox/${name}"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "${name}"
`,
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: definitions.join('\n') }),
        'source.txt': 'input',
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'source.txt'), 'staged input');
    gitOutput(sandbox.path, ['add', 'source.txt']);
    const staged = await checkReport(sandbox.path, [
        'check',
        '--only',
        'sandbox/commit',
        'sandbox/push',
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
        'sandbox/commit',
        'sandbox/push',
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
[check."sandbox/manual"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "manual"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: definition }),
        'source.txt': 'input',
    });
    const plain = await checkReport(sandbox.path, ['check', '--json']);
    expect(plain.code, plain.stdout + plain.stderr).toBe(2);
    const initial = plain.report;
    expect(initial.checks.map((check) => check.check)).not.toContain('sandbox/manual');
    expect(initial.checks.some((check) => check.status === 'missing')).toBe(true);
    const named = await checkReport(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const report = named.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/manual', 'passed']]);
});

test('a scope path selects its checks and its reproduction command repeats the same findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
configurations = []
[scope."api"]
configurations = ["javascript", "naming"]
[scope."web"]
configurations = ["javascript", "naming"]
`,
        'api/port.js': 'export const helperCommand = 1;\n',
        'web/port.js': 'export const helperCommand = 2;\n',
    });
    const selected = await checkReport(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['api']);
    const command = report.checks[0]?.reproduce;
    expect(command).toBeDefined();
    const repeated = await checkReport(sandbox.path, [...command!.split(' ').slice(1), '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = repeated.report;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});

test('a staged change to only gspot.toml rechecks every file a configuration check owns', async () => {
    const loose = buildPolicy(['sql'], {
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
    gitOutput(sandbox.path, ['add', 'gspot.toml']);
    const checked = await checkReport(sandbox.path, ['check', '--staged', '--only', 'structure/file-lines', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks[0]?.findings).toContainEqual(containing({ file: 'db/report.sql' }));
});
