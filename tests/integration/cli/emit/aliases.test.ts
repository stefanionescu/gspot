import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { templateInputs } from '#cli/emit/templates.ts';

test.each(['package.json', 'tsconfig.json'])(
    'generation reports malformed %s instead of dropping aliases',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
            [path]: '{}',
        });
        const session = await openSession(sandbox.path);
        writeFileSync(join(sandbox.path, path), '{ "compilerOptions": { "paths": {} },');
        expect(() => emitAll(session)).toThrow(
            path === 'tsconfig.json'
                ? `Cannot read TypeScript configuration ${join(sandbox.path, path)}`
                : 'Cannot read package manifest package.json',
        );
    },
);

test.each(['package.json', 'tsconfig.json'])(
    'generation reports unreadable %s instead of dropping aliases',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
            [path]: '{}',
        });
        const session = await openSession(sandbox.path);
        rmSync(join(sandbox.path, path));
        mkdirSync(join(sandbox.path, path));
        expect(() => emitAll(session)).toThrow(
            path === 'tsconfig.json'
                ? `Cannot read TypeScript configuration ${join(sandbox.path, path)}`
                : 'Cannot read package manifest package.json',
        );
    },
);

test('alias generation rejects a package manifest link planted after inventory and accepts corrected bytes', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
        'package.json': '{}',
    });
    await createFileTree(outside.path, { 'package.json': '{"imports":{"#private/*":"./private/*"}}' });
    const session = await openSession(sandbox.path);
    const path = join(sandbox.path, 'package.json');
    unlinkSync(path);
    symlinkSync(join(outside.path, 'package.json'), path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(() => inputs.importAliases('')).toThrow('Unsafe lifecycle destination');
    unlinkSync(path);
    writeFileSync(path, '{"imports":{"#app/*":"./src/*"}}');
    expect(inputs.importAliases('')).toEqual({ '#app/': 'src/' });
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"imports":{"#private/*":"./private/*"}}');
});

test.each(['tsconfig.json', 'base.json'])('TypeScript alias reads refuse a linked authored %s', async (name) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{}',
    });
    await createFileTree(outside.path, {
        'config.json': '{"compilerOptions":{"paths":{"@private/*":["./private/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    const path = join(sandbox.path, name);
    unlinkSync(path);
    symlinkSync(join(outside.path, 'config.json'), path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(() => inputs.importAliases('')).toThrow('private regular file');
    unlinkSync(path);
    writeFileSync(path, '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}');
    expect(inputs.importAliases('')).toEqual({ '@app/': 'src/' });
});

test('TypeScript alias reads retain a declared external dependency configuration', async () => {
    await using sandbox = await testdir();
    await using dependency = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
        'package.json': '{"devDependencies":{"shared-config":"1.0.0"}}',
        'tsconfig.json': '{"extends":"./node_modules/shared-config/tsconfig.json"}',
    });
    await createFileTree(dependency.path, { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
    mkdirSync(join(sandbox.path, 'node_modules'));
    symlinkSync(dependency.path, join(sandbox.path, 'node_modules/shared-config'), 'dir');
    const session = await openSession(sandbox.path);
    expect(templateInputs(session, session.scopes[0]!).importAliases('')).toEqual({});
    expect(await Bun.file(join(dependency.path, 'tsconfig.json')).text()).toBe('{"compilerOptions":{"strict":true}}');
});

test('alias discovery accepts absent files and valid TypeScript comments and trailing commas', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
    });
    const session = await openSession(sandbox.path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(inputs.importAliases('')).toEqual({});
    writeFileSync(
        join(sandbox.path, 'tsconfig.json'),
        `{
        // TypeScript permits comments and trailing commas.
        "compilerOptions": { "paths": { "@app/*": ["./src/*"], }, },
    }`,
    );
    expect(inputs.importAliases('')).toEqual({ '@app/': 'src/' });
});

test('inherited aliases resolve from the configuration that declares them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(inputs.importAliases('')).toEqual({ '@app/': 'src/' });
    writeFileSync(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(inputs.importAliases('')).toEqual({ '@app/': 'app/src/' });
});

test('generation preserves authored aliases and reports missing authored bases', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(inputs.importAliases('')).toEqual({ '@app/': 'src/' });
    expect(emitAll(session).files.some((file) => file.path === '.gspot/tsconfig.check.json')).toBe(true);
    expect(await Bun.file(join(sandbox.path, '.gspot/tsconfig.check.json')).exists()).toBe(false);
    writeFileSync(join(sandbox.path, 'tsconfig.json'), '{"extends":"./missing-base.json"}');
    expect(() => inputs.importAliases('')).toThrow('missing-base.json');
});
