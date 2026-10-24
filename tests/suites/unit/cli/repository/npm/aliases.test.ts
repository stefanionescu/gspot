import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { readScopeAliases } from '#cli/repository/npm/aliases.ts';
import { ALIAS_FILES, SCOPE_ALIASES, ALIAS_PROJECT } from '#tests/config/repository/npm/aliases.ts';

test.each([...ALIAS_FILES])('alias reads report a malformed $path', async ({ path, message }) => {
    await using sandbox = await testdir({ [path]: '{ "compilerOptions": { "paths": {} },' });
    expect(() => readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toThrow(new Error(message));
});

test('root and child aliases read their own files, and tsconfig paths win', async () => {
    await using sandbox = await testdir(ALIAS_PROJECT);
    expect(readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toStrictEqual(SCOPE_ALIASES);
    expect(readScopeAliases(sandbox.path, 'web', createReadCache(sandbox.path))).toStrictEqual({
        '#app/*': 'web/src/*',
        '@web/*': 'web/typed/*',
        '#shared/*': 'web/compiler/*',
    });
});

test('alias reads follow extends into a linked node_modules package', async () => {
    await using sandbox = await testdir();
    await using dependency = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./node_modules/shared-config/tsconfig.json"}',
    });
    await createFileTree(dependency.path, { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink(dependency.path, join(sandbox.path, 'node_modules/shared-config'), 'dir');
    expect(readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toStrictEqual({});
});

test('inherited aliases are read relative to the file that declares them', async () => {
    await using sandbox = await testdir({
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });

    expect(readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toStrictEqual({
        '@app/*': 'src/*',
    });
    await writeFile(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toStrictEqual({
        '@app/*': 'app/src/*',
    });
});

test('alias reads name a missing extended file', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"./missing-base.json"}' });
    expect(() => readScopeAliases(sandbox.path, '', createReadCache(sandbox.path))).toThrow(
        new Error(
            `Cannot read the compiler settings in tsconfig.json: Cannot read file '${join(sandbox.path, 'missing-base.json')}'.`,
        ),
    );
});
