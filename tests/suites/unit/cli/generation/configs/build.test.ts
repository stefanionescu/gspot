import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { buildConfigs } from '#cli/generation/configs/build.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a check copy builds the config files of the repository, not of the copy folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'docs', configurations: ['typescript'] }],
        }),
        'docs/tsconfig.json': '{"extends":"preset/tsconfig.json","include":["src"]}',
        'docs/node_modules/preset/tsconfig.json': '{"compilerOptions":{"strict":true}}',
        'docs/node_modules/preset/package.json': '{"name":"preset","version":"1.0.0"}',
        'docs/src/index.ts': 'export const value = 1;\n',
    });
    await using copy = await testdir({ 'docs/src/index.ts': 'export const value = 1;\n' });

    const copied = buildConfigs({ ...(await openSession(sandbox.path)), root: copy.path });
    expect(copied).toStrictEqual(buildConfigs(await openSession(sandbox.path)));
});
