// File arguments, stages, and scope paths select the checks a run executes.
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('file and folder arguments intersect check lists and respect -C', async () => {
    const command = [
        process.execPath,
        '-e',
        'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;',
        '{files}',
    ];
    const entries = ['one', 'two', 'three']
        .map(
            (name) => `
[[check]]
name = "sandbox/${name}"
command = ${JSON.stringify(command)}
paths = ["src/**", "docs/**"]
stage = "commit"
[check.output]
format = "lines"
`,
        )
        .join('');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = []\n${entries}`,
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    const selected = await run(sandbox.path, [
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
    const skipped = await run(sandbox.path, [
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
        ['sandbox/three', 'fail'],
    ]);
    const relative = await run(sandbox.path, ['-C', 'src', 'check', 'selected.ts', '--only', 'sandbox/one', '--json']);
    expect(relative.code, relative.stdout + relative.stderr).toBe(1);
    const relativeReport = JSON.parse(relative.stdout) as RunReport;
    expect(relativeReport.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'src/selected.ts',
    ]);
});

test.each(['commit', 'push', 'manual'])('--stage %s runs the checks assigned to that stage', async (stage) => {
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
        'gspot.toml': `version = 1\nconfigurations = []\n${definitions.join('\n')}`,
        'source.txt': 'input',
    });
    const checked = await run(sandbox.path, ['check', '--stage', stage, '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([[`sandbox/${stage}`, 'ok']]);
});

test('a scope path selects its checks and its reproduction command repeats the same findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1
level = "all"
configurations = []
[[scope]]
path = "api"
configurations = ["javascript", "naming"]
[[scope]]
path = "web"
configurations = ["javascript", "naming"]
`,
        'api/port.js': 'export const shellCommand = 1;\n',
        'web/port.js': 'export const shellCommand = 2;\n',
    });
    const selected = await run(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['api']);
    const command = report.checks[0]?.reproduce;
    expect(command).toBeDefined();
    const repeated = await run(sandbox.path, [...command!.split(' ').slice(1), '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    const repeatedReport = JSON.parse(repeated.stdout) as RunReport;
    expect(repeatedReport.checks.flatMap((check) => check.findings)).toStrictEqual(
        report.checks.flatMap((check) => check.findings),
    );
});
