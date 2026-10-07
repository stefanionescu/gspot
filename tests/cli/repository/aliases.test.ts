import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { aliasesFor } from '#cli/repository/aliases.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { ALIAS_INPUTS, ALIAS_PROJECT } from '#tests/config/cli/repository/aliases.ts';

test.each(ALIAS_INPUTS)('alias reads report malformed $path', async ({ path, diagnostic }) => {
    await using sandbox = await testdir({ [path]: '{ "compilerOptions": { "paths": {} },' });
    expect(() => aliasesFor(sandbox.path, '')).toThrow(diagnostic.replace('{PATH}', join(sandbox.path, path)));
});

test.each(ALIAS_INPUTS)(
    'alias reads refuse an authored $path linked outside the repository',
    async ({ path, valid }) => {
        await using sandbox = await testdir();
        await using outside = await testdir({ [path]: valid });
        symlinkSync(join(outside.path, path), join(sandbox.path, path));
        expect(() => aliasesFor(sandbox.path, '')).toThrow('Source link leaves the repository');
    },
);

test('root and child aliases read their own declarations with compiler paths taking precedence', async () => {
    await using sandbox = await testdir(ALIAS_PROJECT);
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({
        '#app/': 'src/',
        '#root/': 'root/',
        '@root/': 'typed/',
        '#shared/': 'compiler/',
    });
    expect(aliasesFor(sandbox.path, 'web')).toStrictEqual({
        '#app/': 'web/src/',
        '@web/': 'web/typed/',
        '#shared/': 'web/compiler/',
    });
});

test('alias reads follow an extends into a linked node_modules package', async () => {
    await using sandbox = await testdir();
    await using dependency = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./node_modules/shared-config/tsconfig.json"}',
    });
    await createFileTree(dependency.path, { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
    mkdirSync(join(sandbox.path, 'node_modules'));
    symlinkSync(dependency.path, join(sandbox.path, 'node_modules/shared-config'), 'dir');
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({});
});

test('alias discovery accepts absent configuration files', async () => {
    await using sandbox = await testdir();
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({});
});

test('inherited aliases resolve from the configuration that declares them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'src/' });
    writeFileSync(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'app/src/' });
});

test('generated compiler configurations extend their authored alias owners', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "web"\nconfigurations = ["typescript"]\n',
        }),
        'web/tsconfig.json': ALIAS_PROJECT['web/tsconfig.json'],
        'web/source.ts': 'export const count = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'src/' });
    const generated = emitAll(session).files;
    const compiler = generated.find((file) => file.path === '.gspot/config/tsconfig.json')!;
    const child = generated.find((file) => file.path === '.gspot/config/web/tsconfig.json')!;
    expect(JSON.parse(compiler.content)).toMatchObject({ extends: '../../tsconfig.json' });
    expect(JSON.parse(child.content)).toMatchObject({ extends: '../../../web/tsconfig.json' });
});

test('alias discovery accepts linked authored manifests and inherited compiler configurations inside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'settings/manifest.json': '{"imports":{"#package/*":"./src/*"}}',
        'settings/compiler.json': '{"extends":"./settings/base.json"}',
        'settings/base.json': '{"compilerOptions":{"paths":{"#compiler/*":["../app/*"]}}}',
    });
    symlinkSync('settings/manifest.json', join(sandbox.path, 'package.json'));
    symlinkSync('settings/compiler.json', join(sandbox.path, 'tsconfig.json'));
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '#package/': 'src/', '#compiler/': 'app/' });
});

test('alias discovery reports a missing authored base by its filename', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"./missing-base.json"}' });
    expect(() => aliasesFor(sandbox.path, '')).toThrow('missing-base.json');
});
