import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

const policy = `configurations = []
[check."sandbox/identity"]
command = ${JSON.stringify([process.execPath, '-e', 'process.stdout.write("A sandbox finding."); process.exitCode = 1'])}
paths = ["source.txt"]
stage = "commit"
[check."sandbox/identity".output]
format = "lines"
`;

test('a check keeps its name in the report and in its findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, buildRunOptions({ only: ['sandbox/identity'] }));
    expect(session.policyFiles.policy.check['sandbox/identity']?.name).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.check).toBe('sandbox/identity');
    expect(outcome.report.checks[0]?.findings[0]?.check).toBe('sandbox/identity');
});

test('counted failures survive final filtering without diagnostic locations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy
            .replace(
                '[check."sandbox/identity".output]',
                'finding_count_pattern = "A sandbox finding"\n[check."sandbox/identity".output]',
            )
            .replace('format = "lines"', 'format = "none"')
            .replace('process.exitCode = 1', 'process.exitCode = 0'),
        'source.txt': 'original',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['sandbox/identity'] });
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
