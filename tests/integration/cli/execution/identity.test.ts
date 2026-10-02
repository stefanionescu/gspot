import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/execution.ts';

const { version: GSPOT_VERSION } = packageManifest;

const policy = `kits = []
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
    const outcome = await executeRun(session, runOptions());
    expect(session.policyFiles.policy.checks[0]?.name).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.check).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('sandbox/identity');
});

test('counted failures survive final filtering without diagnostic locations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy
            .replace('[check.output]', 'count_pattern = "A sandbox finding"\n[check.output]')
            .replace('format = "lines"', 'format = "none"')
            .replace('process.exitCode = 1', 'process.exitCode = 0'),
        'source.txt': 'original',
    });
    const session = await openSession(sandbox.path);
    const options = runOptions();
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]).toMatchObject({ status: 'fail', findings: [] });
    await Bun.write(join(sandbox.path, '.gspot/version'), GSPOT_VERSION + '\n');
    const cli = Bun.spawnSync(
        [
            process.execPath,
            Bun.resolveSync('#cli/main.ts', import.meta.dir),
            'check',
            '--only',
            'sandbox/identity',
            '--json',
        ],
        { cwd: sandbox.path },
    );
    expect(cli.exitCode, cli.stderr.toString()).toBe(1);

    session.policyFiles.policy.checks[0]!.count_pattern = 'No matching output';
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
});

test('malformed custom JSON output produces inability instead of a discarded finding', async () => {
    const output = '{ broken';
    await using sandbox = await testdir();
    const program = `process.stdout.write(${JSON.stringify(output)})`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            [],
            `[[check]]\nname = "sandbox/json"\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\npaths = ["source.txt"]\nstage = "commit"\n[check.output]\nformat = "json"\n`,
        ),
        'source.txt': 'original',
        '.gspot/version': GSPOT_VERSION + '\n',
    });
    const cli = Bun.spawnSync(
        [
            process.execPath,
            Bun.resolveSync('#cli/main.ts', import.meta.dir),
            'check',
            '--only',
            'sandbox/json',
            '--json',
        ],
        { cwd: sandbox.path },
    );
    expect(cli.exitCode, cli.stdout.toString() + cli.stderr.toString()).toBe(2);
    expect((JSON.parse(cli.stdout.toString()) as RunReport).checks[0]!.status).toBe('error');
});
