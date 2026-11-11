import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { setRuntime } from '#cli/configurations/language/javascript/files/eslint-functions.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(/\bnodejs\b/u);
});

test('ESLint resolves imports over several projects without a warning', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
            tables: '[[import_rule]]\nname = "app"\npaths = ["app/**"]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'app/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'root.ts': "import { value } from './app/value.ts';\nexport const root: number = value;\n",
        'app/value.ts': 'export const value = 1;\n',
    });
    await buildEslint(sandbox.path);
    const eslint = join(sandbox.path, 'node_modules/eslint/bin/eslint.js');
    const config = getManifestTarget('javascript', 'eslint/eslint.mjs');
    const result = await runCommand(['node', eslint, '--config', config, '--format', 'json', 'root.ts'], {
        cwd: sandbox.path,
    });
    expect(result.stdout).toStartWith('[');
    expect(result.stderr).toBe('');
});
