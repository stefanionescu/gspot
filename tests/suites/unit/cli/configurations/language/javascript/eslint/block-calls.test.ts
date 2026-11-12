import { expect, test } from 'bun:test';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a scope named with glob characters keeps its rules in its own folder', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"type":"module"}\n',
        'app[1]/source.js': "import 'node:fs';\n",
        'app1/source.js': "import 'node:fs';\n",
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'app1' }, { path: 'app[1]' }],
            tables: '[scope.javascript]\nbanned_imports = [{ name = "node:fs", message = "Use the storage service." }]\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['app[[]1]/source.js', 'app1/source.js'],
            ['no-restricted-imports'],
        ),
    ).toStrictEqual([{ file: 'app[1]/source.js', rule: 'no-restricted-imports', line: 1 }]);
});
