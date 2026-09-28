import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';

test('shell visibility uses outside callers and keeps entrypoints public', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
        'owner.sh':
            '_private() {\n echo first\n}\nhelper() {\n echo second\n}\nshared() {\n echo third\n}\nmain() {\n shared\n}\n',
        'caller.sh': '_private\nshared\n',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['structure/private-prefix'],
        fix: false,
        isDryRun: false,
    };
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks).toMatchObject([{ check: 'structure/private-prefix', status: 'fail' }]);
    expect(
        broken.report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([
        { file: 'owner.sh', line: 1, rule: 'private-called-outside' },
        { file: 'owner.sh', line: 4, rule: 'file-local' },
    ]);
    await createFileTree(sandbox.path, {
        'owner.sh':
            '_helper() {\n echo second\n}\nprivate() {\n echo first\n}\nshared() {\n echo third\n}\nmain() {\n shared\n}\n',
        'caller.sh': 'private\nshared\n',
    });
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'structure/private-prefix', status: 'ok', findings: [] }]);
});

test('shell declaration order resets between files and requires main last', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
        'first.sh':
            '_top() {\n echo first\n}\npublic() {\n echo second\n}\n_late() {\n echo third\n}\nmain() {\n public\n}\nafter() {\n echo last\n}\n',
        'second.sh': '_local() {\n echo local\n}\nmain() {\n _local\n}\n',
        'empty.sh': '# No declarations.\n',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['structure/private-before-public'],
        fix: false,
        isDryRun: false,
    };
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks).toMatchObject([{ check: 'structure/private-before-public', status: 'fail' }]);
    expect(
        broken.report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([
        { file: 'first.sh', line: 7, rule: 'private-below-public' },
        { file: 'first.sh', line: 10, rule: 'main-not-last' },
    ]);
    await createFileTree(sandbox.path, {
        'first.sh':
            '_top() {\n echo first\n}\n_late() {\n echo third\n}\npublic() {\n echo second\n}\nafter() {\n echo last\n}\nmain() {\n public\n}\n',
    });
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'structure/private-before-public', status: 'ok', findings: [] },
    ]);
});

test('Swift declaration order identifies private types and extensions and accepts both before shared declarations', async () => {
    await using sandbox = await testdir();
    const shared = 'struct Shared {}\n';
    const hidden = 'private struct Hidden {}\nprivate extension Shared {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n',
        'Declarations.swift': shared + hidden,
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['swift/private-before-public'],
        noCache: true,
        fix: false,
        isDryRun: true,
    };
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'Declarations.swift',
            line: 2,
            rule: 'private-below-shared',
            message:
                'Hidden is private and sits below a declaration other files see. File-local declarations come first.',
        },
        {
            file: 'Declarations.swift',
            line: 3,
            rule: 'private-below-shared',
            message:
                'The extension of Shared is private and sits below a declaration other files see. File-local declarations come first.',
        },
    ]);
    await Bun.write(`${sandbox.path}/Declarations.swift`, hidden + shared);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
});
