import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, mock, expect } from 'bun:test';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { setRuntime, setImportLookup } from '#cli/configurations/language/javascript/files/eslint-functions.ts';

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(
        'The globals package has no runtime named nodejs. Set tools.eslint.override.runtime to one of: node, browser.',
    );
});

test('every block of a config shares one TypeScript import resolver', () => {
    const createLookup = mock(() => ({}));
    const first = setImportLookup({}, createLookup, ['tsconfig.json']);
    const second = setImportLookup({}, createLookup, ['tsconfig.json']);
    expect(createLookup).toHaveBeenCalledTimes(1);
    expect(first.settings).toStrictEqual(second.settings);
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
