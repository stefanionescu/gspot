import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { privateBeforePublic } from '#cli/checks/language/swift/private-before-public.ts';

test('a private Swift setter leaves its getter visible to other files', async () => {
    const text = 'private(set) var count = 0\nprivate func hidden() {}\n';
    await using sandbox = await testdir({
        'Counter.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
    });
    expect(
        await privateBeforePublic(buildEngineInput(await openSession(sandbox.path), 'swift/private-before-public')),
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
