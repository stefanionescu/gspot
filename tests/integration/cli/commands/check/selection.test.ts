// File arguments, stages, and scope paths select the checks a run executes.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { existsSync, writeFileSync } from 'node:fs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runGspot, spawnGspot } from '#tests/harness/cli/command.ts';

// A sandbox with three commit checks that report every file they receive.
async function selectionSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const command = [
        process.execPath,
        '-e',
        'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;',
        '{files}',
    ];
    const entries = ['one', 'two', 'three'].map((name) => ({
        name: `sandbox/${name}`,
        command,
        paths: ['src/**', 'docs/**'],
        stage: 'commit',
        output: { format: 'lines' },
    }));
    const sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ kits: [], check: entries }),
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
    const afterReport = JSON.parse(after.stdout) as RunReport;
    expect(afterReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'src/selected.ts',
    ]);
});

test.each(['commit', 'push'])('--hook %s runs the checks of that hook', async (stage) => {
    const definitions = ['commit', 'push', 'manual'].map(
        (name) => `
[[check]]
name = "sandbox/${name}"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "${name}"
`,
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], definitions.join('\n')),
        'source.txt': 'input',
    });
    const checked = await runGspot(sandbox.path, ['check', '--hook', stage, '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([[`sandbox/${stage}`, 'passed']]);
});

test('a manual check runs only when --only names it', async () => {
    const definition = `
[[check]]
name = "sandbox/manual"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
paths = ["source.txt"]
stage = "manual"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], definition), 'source.txt': 'input' });
    const plain = await runGspot(sandbox.path, ['check', '--json']);
    expect((JSON.parse(plain.stdout) as RunReport).checks).toStrictEqual([]);
    const named = await runGspot(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']);
    const report = JSON.parse(named.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/manual', 'passed']]);
});

test('a scope path selects its checks and its reproduction command repeats the same findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
kits = []
[[scope]]
path = "api"
kits = ["javascript", "naming"]
[[scope]]
path = "web"
kits = ["javascript", "naming"]
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

test('a staged environment file stops the commit hook before any check runs', async () => {
    const definition = `
[[check]]
name = "sandbox/marker"
command = ${JSON.stringify([process.execPath, '-e', 'require("node:fs").writeFileSync("ran.txt", "")'])}
paths = ["**"]
stage = "commit"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], definition),
        '.gitignore': '.env\nran.txt\n',
        'source.txt': 'input',
    });
    commitAll(sandbox.path);
    writeFileSync(join(sandbox.path, '.env'), 'TOKEN=secret\n');
    gitOutput(sandbox.path, ['add', '-f', '.env']);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(JSON.parse(refused.stdout)).toStrictEqual({ failed: ['secrets/env-files'], files: ['.env'] });
    expect(existsSync(join(sandbox.path, 'ran.txt'))).toBe(false);
});
