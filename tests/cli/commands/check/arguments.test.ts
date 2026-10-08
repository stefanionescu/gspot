// Bun sandboxes exercise file, stage, and scope selection through the public CLI.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';

// A sandbox with three commit checks that report every file they receive.
async function selectionSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const command = [
        process.execPath,
        '-e',
        'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;',
        '{files}',
    ];
    const entries = Object.fromEntries(
        ['one', 'two', 'three'].map((name) => [
            `sandbox/${name}`,
            {
                command,
                paths: ['src/**', 'docs/**'],
                stage: 'commit',
                output: { format: 'lines' },
            },
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
    const selected = await runGspot(sandbox.path, [
        'check',
        'src/selected.ts',
        'docs',
        '--only',
        'sandbox/one',
        'sandbox/two',
        '--json',
    ]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toStrictEqual(
            new Set(['docs/guide.md', 'src/selected.ts']),
        );
    const skipped = await runGspot(sandbox.path, [
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
    const skippedReport = JSON.parse(skipped.stdout) as RunReport;
    expect(skippedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/one', 'skipped'],
        ['sandbox/two', 'skipped'],
        ['sandbox/three', 'failed'],
    ]);
});

test('a program option ends a list option, so the path after it stays a file argument', async () => {
    await using sandbox = await selectionSandbox();
    const result = await runGspot(sandbox.path, ['check', '--only', 'sandbox/one', '--json', 'src/selected.ts']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
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
    expect(git(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const staged = await runGspot(sandbox.path, [
        'check',
        '--only',
        'sandbox/commit',
        'sandbox/push',
        '--staged',
        '--json',
    ]);
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    const stagedReport = JSON.parse(staged.stdout) as RunReport;
    expect(stagedReport.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/commit', 'passed'],
        ['sandbox/push', 'passed'],
    ]);
    const checked = await runGspot(sandbox.path, [
        'check',
        '--only',
        'sandbox/commit',
        'sandbox/push',
        '--hook',
        'pre-commit',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
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
    const plain = await runGspot(sandbox.path, ['check', '--json']);
    expect(plain.code, plain.stdout + plain.stderr).toBe(2);
    const initial = JSON.parse(plain.stdout) as RunReport;
    expect(initial.checks.map((check) => check.check)).not.toContain('sandbox/manual');
    expect(initial.checks.some((check) => check.status === 'missing')).toBe(true);
    const named = await runGspot(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const report = JSON.parse(named.stdout) as RunReport;
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
    const selected = await runGspot(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['api']);
    const command = report.checks[0]?.reproduce;
    expect(command).toBeDefined();
    const repeated = await runGspot(sandbox.path, [...command!.split(' ').slice(1), '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as RunReport;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});

test('a staged change to only gspot.toml rechecks every file a configuration check owns', async () => {
    const loose = buildPolicy(['sql'], {
        tables: '[agent_rules]\nenabled = false\n[limits.sql]\nfile_lines = 100\n',
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
    const checked = await runGspot(sandbox.path, ['check', '--staged', '--only', 'structure/file-lines', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks[0]?.findings).toContainEqual(containing({ file: 'db/report.sql' }));
});
