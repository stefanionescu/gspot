import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

function identityPolicy(pattern: string | undefined, format: string, exitCode: number, paths: string[]): string {
    return `configurations = []
[check."sandbox/identity"]
command = ${JSON.stringify([process.execPath, '-e', `process.stdout.write("A sandbox finding."); process.exitCode = ${exitCode.toString()}`])}
paths = ${JSON.stringify(paths)}
stage = "commit"
${pattern === undefined ? '' : `finding_count_pattern = ${JSON.stringify(pattern)}\n`}[check."sandbox/identity".output]
format = ${JSON.stringify(format)}
`;
}

test('counted failures survive final filtering without diagnostic locations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': identityPolicy('A sandbox finding', 'none', 0, ['source.txt']),
        'source.txt': 'original',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['sandbox/identity'] });
    const failed = await executeRun(session, options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]).toMatchObject({ status: 'failed', findings: [] });
    await Bun.write(join(sandbox.path, 'gspot.toml'), identityPolicy('No matching output', 'none', 0, ['source.txt']));
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
});
