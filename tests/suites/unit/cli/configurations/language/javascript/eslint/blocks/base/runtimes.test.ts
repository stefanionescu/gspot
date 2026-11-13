import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules } from '#tests/setup/eslint/lint.ts';

test('a browser runtime block turns unicorn/prefer-iterator-to-array off', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'web', configurations: ['react'] }],
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'server.js': '',
        'web/client.jsx': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const tables = await readEslintRules(eslint, ['server.js', 'web/client.jsx']);
    expect(
        Object.fromEntries(
            Object.entries(tables).map(([file, table]) => [file, table['unicorn/prefer-iterator-to-array']?.[0]]),
        ),
    ).toStrictEqual({ 'server.js': 2, 'web/client.jsx': 0 });
});
