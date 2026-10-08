import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { privateBeforePublic } from '#cli/checks/general/structure/private-before-public.ts';

test('a private Swift setter leaves its getter visible to other files', async () => {
    const text = 'private(set) var count = 0\nprivate func hidden() {}\n';
    await using sandbox = await testdir({
        'Counter.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
    });
    expect(
        await privateBeforePublic(buildCheckInput(await openSession(sandbox.path), 'swift/private-before-public')),
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
    const options = buildRunOptions({ only: ['swift/private-before-public'], isDryRun: true });
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
