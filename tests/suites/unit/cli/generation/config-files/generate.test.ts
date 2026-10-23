import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';

test('a check copy reads the config files of the repository, not of the copy folder', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'docs', configurations: ['typescript'] }],
        }),
        'docs/tsconfig.json': '{"extends":"preset/tsconfig.json","include":["src"]}',
        'docs/node_modules/preset/tsconfig.json': '{"compilerOptions":{"strict":true}}',
        'docs/node_modules/preset/package.json': '{"name":"preset","version":"1.0.0"}',
        'docs/src/index.ts': 'export const value = 1;\n',
    });
    await using copy = await testdir({ 'docs/src/index.ts': 'export const value = 1;\n' });

    const session = await openSession(sandbox.path);
    const copied = getConfigFiles({ ...session, root: copy.path });
    expect(copied).toBe(getConfigFiles(session));
});
