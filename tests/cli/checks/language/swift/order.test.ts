import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';

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

test('Swift import runs report an intervening comment and accept moving it above the imports', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
        'Noted.swift': 'import Foundation\n// The interface configuration.\nimport UIKit\n',
    });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'swift/import-comments', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'swift/import-comments',
            status: 'failed',
            findings: [{ file: 'Noted.swift', rule: 'import-comment', line: 2 }],
        },
    ]);
    await Bun.write(
        `${sandbox.path}/Noted.swift`,
        '// The interface configuration.\nimport Foundation\nimport UIKit\n',
    );
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'swift/import-comments', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
