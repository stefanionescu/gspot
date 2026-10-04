import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { aliasesFor } from '#cli/repository/aliases.ts';
import { openSession } from '#cli/execution/session.ts';
import { rmSync, mkdirSync, unlinkSync, symlinkSync, writeFileSync } from 'node:fs';

test.each(['package.json', 'tsconfig.json'])(
    'generation reports malformed %s instead of dropping aliases',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript']),
            'source.ts': 'export const value = 1;\n',
            [path]: '{}',
        });
        const session = await openSession(sandbox.path);
        writeFileSync(join(sandbox.path, path), '{ "compilerOptions": { "paths": {} },');
        expect(() => emitAll(session)).toThrow(
            path === 'tsconfig.json'
                ? `Cannot read TypeScript configuration ${join(sandbox.path, path)}`
                : 'Cannot read package manifest package.json',
        );
        rmSync(join(sandbox.path, path), { recursive: true });
        writeFileSync(
            join(sandbox.path, path),
            path === 'package.json'
                ? '{"imports":{"#app/*":"./src/*"}}'
                : '{"compilerOptions":{"paths":{"#app/*":["./src/*"]}}}',
        );
        expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '#app/': 'src/' });
    },
);

test('alias reads reject a package manifest linked outside the repository and accept corrected bytes', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{}',
    });
    await createFileTree(outside.path, { 'package.json': '{"imports":{"#private/*":"./private/*"}}' });
    const path = join(sandbox.path, 'package.json');
    unlinkSync(path);
    symlinkSync(join(outside.path, 'package.json'), path);
    expect(() => aliasesFor(sandbox.path, '')).toThrow('Source link leaves the repository');
    unlinkSync(path);
    writeFileSync(path, '{"imports":{"#app/*":"./src/*"}}');
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '#app/': 'src/' });
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"imports":{"#private/*":"./private/*"}}');
});

test('TypeScript alias reads refuse an authored configuration linked outside the repository', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{}',
    });
    await createFileTree(outside.path, {
        'config.json': '{"compilerOptions":{"paths":{"@private/*":["./private/*"]}}}',
    });
    const path = join(sandbox.path, 'tsconfig.json');
    unlinkSync(path);
    symlinkSync(join(outside.path, 'config.json'), path);
    expect(() => aliasesFor(sandbox.path, '')).toThrow('Source link leaves the repository');
    unlinkSync(path);
    writeFileSync(path, '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}');
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'src/' });
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
    expect(await Bun.file(join(dependency.path, 'tsconfig.json')).text()).toBe('{"compilerOptions":{"strict":true}}');
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

test('generation preserves authored aliases and reports missing authored bases', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript']),
        'tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'src/' });
    expect(emitAll(session).files.some((file) => file.path === '.gspot/config/tsconfig.json')).toBe(true);
    expect(await Bun.file(join(sandbox.path, '.gspot/config/tsconfig.json')).exists()).toBe(false);
    writeFileSync(join(sandbox.path, 'tsconfig.json'), '{"extends":"./missing-base.json"}');
    expect(() => aliasesFor(sandbox.path, '')).toThrow('missing-base.json');
    writeFileSync(join(sandbox.path, 'missing-base.json'), '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}');
    expect(aliasesFor(sandbox.path, '')).toStrictEqual({ '@app/': 'src/' });
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
    expect(await Bun.file(join(sandbox.path, 'settings/manifest.json')).text()).toBe(
        '{"imports":{"#package/*":"./src/*"}}',
    );
});
