import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { swiftlint } from '#cli/checks/language/swift/swiftlint.ts';

test('SwiftLint rejects malformed native output and removes its selected workspace', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const text = 'public let value = 1 /** Inline documentation. */\n';
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
        'nested/Value.swift': text,
    });
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(root);
    const plans = planRun(session, { stage: 'all', only: ['swift/swiftlint'], skips: [] });
    const planned = plans[0]!;
    using _executables = mockPinnedExecutables([...session.manifests.values()].flatMap((manifest) => manifest.tools));
    let workspace = '';
    using _malformed = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command.includes('--reporter') && options.cwd !== root) {
            workspace = options.cwd;
            return Promise.resolve({ code: 0, missing: false, stdout: '{', stderr: '', duration: 1 });
        }
        return Promise.resolve({ code: 0, missing: false, stdout: '[]', stderr: '', duration: 1 });
    });
    const failed = await swiftlint(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.note).toContain('invalid JSON report');
    expect(workspace).not.toBe('');
    expect(existsSync(workspace)).toBe(false);
    expect(await Bun.file(join(root, 'nested/Value.swift')).text()).toBe(text);
});
