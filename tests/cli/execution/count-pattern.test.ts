import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';

const { version: RUNNING_VERSION } = packageManifest;

const policy = `configurations = []
[[check]]
name = "sandbox/identity"
command = ${JSON.stringify([process.execPath, '-e', 'process.stdout.write("A sandbox finding."); process.exitCode = 1'])}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "lines"
`;

test('a check keeps its name in the report and in its findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, buildRunOptions());
    expect(session.policyFiles.policy.checks[0]?.name).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.check).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('sandbox/identity');
});

test('counted failures survive final filtering without diagnostic locations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy
            .replace('[check.output]', 'finding_count_pattern = "A sandbox finding"\n[check.output]')
            .replace('format = "lines"', 'format = "none"')
            .replace('process.exitCode = 1', 'process.exitCode = 0'),
        'source.txt': 'original',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions();
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]).toMatchObject({ status: 'failed', findings: [] });
    const text = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        text.replace('finding_count_pattern = "A sandbox finding"', 'finding_count_pattern = "No matching output"'),
    );
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
});

test('malformed custom JSON output produces inability instead of a discarded finding', async () => {
    const output = '{ broken';
    await using sandbox = await testdir();
    const program = `process.stdout.write(${JSON.stringify(output)})`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[[check]]\nname = "sandbox/json"\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\npaths = ["source.txt"]\nstage = "commit"\n[check.output]\nformat = "json"\n`,
        }),
        'source.txt': 'original',
        '.gspot/version': RUNNING_VERSION + '\n',
    });
    const cli = await spawnGspot(sandbox.path, ['check', '--only', 'sandbox/json', '--json']);
    expect(cli.code, cli.stdout + cli.stderr).toBe(2);
    expect((JSON.parse(cli.stdout) as RunReport).checks[0]!.status).toBe('error');
});
