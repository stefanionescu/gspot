import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createRunCache } from '#cli/system/cache.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { readScopeAliases, readPackageAliases } from '#cli/repository/npm/aliases.ts';
import { ALIAS_FILES, SCOPE_ALIASES, ALIAS_PROJECT } from '#tests/config/repository/npm.ts';

test.each([...ALIAS_FILES])('alias reads report a malformed $path', async ({ path, message }) => {
    await using sandbox = await testdir({ [path]: '{ "compilerOptions": { "paths": {} },' });
    expect(() => readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toThrow(new Error(message));
});

test('root and child aliases read their own files, and tsconfig paths win', async () => {
    await using sandbox = await testdir(ALIAS_PROJECT);
    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual(SCOPE_ALIASES);
    expect(readScopeAliases(sandbox.path, 'web', createRunCache(sandbox.path))).toStrictEqual({
        '#app/*': 'web/src/*',
        '@web/*': 'web/typed/*',
        '#shared/*': 'web/compiler/*',
    });
});

test('alias reads accept an extends into a linked node_modules package', async () => {
    await using sandbox = await testdir();
    await using dependency = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./node_modules/shared-config/tsconfig.json"}',
    });
    await createFileTree(dependency.path, { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink(dependency.path, join(sandbox.path, 'node_modules/shared-config'), 'dir');
    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual({});
});

test('inherited aliases are read relative to the file that declares them', async () => {
    await using sandbox = await testdir({
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });

    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual({
        '@app/*': 'src/*',
    });
    await writeFile(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual({
        '@app/*': 'app/src/*',
    });
});

test('alias reads name a missing extended file', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"./missing-base.json"}' });
    expect(() => readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toThrow(
        new Error(
            `Cannot read the compiler settings in tsconfig.json: Cannot read file '${convertToPosixPath(join(sandbox.path, 'missing-base.json'))}'.`,
        ),
    );
});

test('package aliases skip browser conditions and resolve nested ESM conditions in order', async () => {
    await using sandbox = await testdir({
        'package.json':
            '{"imports":{"#runtime":{"browser":"./browser.js","node":{"import":"./node.js"},"default":"./fallback.js"},"#ordered":{"default":"./first.js","node":"./later.js"}}}',
    });
    expect(readPackageAliases(sandbox.path, '')).toStrictEqual({ '#runtime': 'node.js', '#ordered': 'first.js' });
});
