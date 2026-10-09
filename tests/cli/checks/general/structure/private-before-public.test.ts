import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/samples/python.ts';

test('a private Swift setter leaves its getter visible to other files', async () => {
    const text = 'private(set) var count = 0\nprivate func hidden() {}\n';
    await using sandbox = await testdir({
        'Counter.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
    });
    expect(
        await BUILT_IN_CHECKS['structure/private-before-public'].input(
            buildCheckInput(await openSession(sandbox.path), 'structure/private-before-public'),
        ),
    ).toMatchObject([
        {
            file: 'Counter.swift',
            line: 2,
            rule: 'private-before-public',
            message:
                'hidden is private and sits below a declaration other files see. File-local declarations come first.',
        },
    ]);
});

test('Swift declaration order identifies private types and extensions and accepts both before shared declarations', async () => {
    await using sandbox = await testdir();
    const shared = 'struct Shared {}\n';
    const hidden = 'private struct Hidden {}\nprivate extension Shared {}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
        'Declarations.swift': shared + hidden,
    });
    const options = buildRunOptions({ only: ['structure/private-before-public'], isDryRun: true });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'Declarations.swift',
            line: 2,
            rule: 'private-before-public',
            message:
                'Hidden is private and sits below a declaration other files see. File-local declarations come first.',
        },
        {
            file: 'Declarations.swift',
            line: 3,
            rule: 'private-before-public',
            message:
                'The extension of Shared is private and sits below a declaration other files see. File-local declarations come first.',
        },
    ]);
    await Bun.write(`${sandbox.path}/Declarations.swift`, hidden + shared);
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
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
    const options = buildRunOptions({ only: ['structure/private-before-public'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks).toMatchObject([{ check: 'structure/private-before-public', status: 'failed' }]);
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
        { check: 'structure/private-before-public', status: 'passed', findings: [] },
    ]);
});

test('a private function declared under a public one is reported while private declarations above it pass', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/tidy.py': `${PYTHON_MODULE_HEADER}def _part() -> int:\n    """Give one part."""\n    return 1\n\n\ndef shown() -> int:\n    """Give one."""\n    return _part()\n`,
        'example/order.py': `${PYTHON_MODULE_HEADER}def shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n`,
    });
    expect(
        await BUILT_IN_CHECKS['structure/private-before-public'].input(
            buildCheckInput(await openSession(sandbox.path), 'structure/private-before-public'),
        ),
    ).toMatchObject([{ file: 'example/order.py', line: 9, rule: 'private-before-public' }]);
});
