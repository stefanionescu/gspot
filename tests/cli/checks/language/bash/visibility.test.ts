import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

test('shell visibility uses outside callers and keeps entrypoints public', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'owner.sh':
            '_private() {\n echo first\n}\nhelper() {\n echo second\n}\nshared() {\n echo third\n}\nmain() {\n helper\n shared\n}\n',
        'caller.sh': '_private\nshared\n',
    });
    const options = buildRunOptions({ only: ['bash/private-prefix'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks).toMatchObject([{ check: 'bash/private-prefix', status: 'failed' }]);
    expect(
        broken.report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([
        { file: 'owner.sh', line: 1, rule: 'called-outside' },
        { file: 'owner.sh', line: 4, rule: 'unprefixed' },
    ]);
    await createFileTree(sandbox.path, {
        'owner.sh':
            '_helper() {\n echo second\n}\nprivate() {\n echo first\n}\nshared() {\n echo third\n}\nmain() {\n _helper\n shared\n}\n',
        'caller.sh': 'private\nshared\n',
    });
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'bash/private-prefix', status: 'passed', findings: [] }]);
});
