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

test('shell declaration order resets between files and requires main last', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'first.sh':
            '_top() {\n echo first\n}\npublic() {\n echo second\n}\n_late() {\n echo third\n}\nmain() {\n public\n}\nafter() {\n echo last\n}\n',
        'second.sh': '_local() {\n echo local\n}\nmain() {\n _local\n}\n',
        'empty.sh': '# No declarations.\n',
    });
    const options = buildRunOptions({ only: ['bash/private-before-public'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks).toMatchObject([{ check: 'bash/private-before-public', status: 'failed' }]);
    expect(
        broken.report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([
        { file: 'first.sh', line: 7, rule: 'private-before-public' },
        { file: 'first.sh', line: 10, rule: 'main-not-last' },
    ]);
    await createFileTree(sandbox.path, {
        'first.sh':
            '_top() {\n echo first\n}\n_late() {\n echo third\n}\npublic() {\n echo second\n}\nafter() {\n echo last\n}\nmain() {\n public\n}\n',
    });
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'bash/private-before-public', status: 'passed', findings: [] },
    ]);
});
