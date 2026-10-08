import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

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
