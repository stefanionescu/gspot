import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('changed managed keys are reported without a whole-file replacement', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"stylelint":"authored"}\n',
    });
    const session = await openSession(sandbox.path);
    const output = {
        files: [],
        blocks: [],
        managedKeys: [{ path: 'package.json', keys: [{ key: ['stylelint'], value: 'managed' }] }],
    };
    expect(listStaleFiles(session, output)).toStrictEqual([{ path: 'package.json', kind: 'changed' }]);
});
