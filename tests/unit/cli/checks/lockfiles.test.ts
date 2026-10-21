import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { BINARY_BUN_LOCKFILE } from '#tests/data/checks/dependencies.ts';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/check-input.ts';

test('dependencies/lockfiles reads no hosts from the binary bun.lockb', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'bun.lockb': BINARY_BUN_LOCKFILE,
    });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'dependencies/lockfiles');
    expect(await findBuiltInCheck('dependencies/lockfiles')(session, planned)).toStrictEqual([]);
});
