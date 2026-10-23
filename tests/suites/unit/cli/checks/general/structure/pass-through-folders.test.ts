import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('a folder whose only entry is one folder is reported, and a file beside the folder clears it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'src/index.ts': 'export const index = 1;\n',
        'src/models/user/name.ts': 'export const name = 1;\n',
    });

    const findings = await runSandboxCheck(sandbox.path, 'structure/pass-through-folders');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        {
            file: 'src/models',
            rule: 'pass-through-folder',
            message: 'The folder src/models/ holds only the folder user/. Remove one of the two levels.',
        },
    ]);
    await using grouped = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'src/index.ts': 'export const index = 1;\n',
        'src/models/index.ts': 'export const index = 1;\n',
        'src/models/user/name.ts': 'export const name = 1;\n',
    });
    expect(await runSandboxCheck(grouped.path, 'structure/pass-through-folders')).toStrictEqual([]);
});

test('a child scope counts as an entry of its parent folder, and a scope folder is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'apps/web', configurations: ['typescript'] }],
        }),
        'apps/shared/value.ts': 'export const value = 1;\n',
        'apps/web/src/main.ts': 'export const main = 1;\n',
    });

    expect(await runSandboxCheck(sandbox.path, 'structure/pass-through-folders')).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'structure/pass-through-folders', { scope: 'apps/web' })).toStrictEqual(
        [],
    );
});

test('installed dependency folders are not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'index.ts': 'export const index = 1;\n',
        'node_modules/package/lib/index.ts': 'export const index = 1;\n',
    });

    expect(await runSandboxCheck(sandbox.path, 'structure/pass-through-folders')).toStrictEqual([]);
});
