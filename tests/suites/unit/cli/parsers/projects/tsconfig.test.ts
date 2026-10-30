import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openSession } from '#cli/planning/session.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { UNSAFE_PATH_MESSAGE } from '#tests/config/messages.ts';
import { symlink, realpath, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { TSCONFIG_PARSE_ERRORS } from '#tests/config/parsers/projects.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';

test('a tsconfig can extend a dependency installed above the repository', async () => {
    await using sandbox = await testdir({
        'node_modules/compiler-settings/tsconfig.json': '{"compilerOptions":{"strict":true}}',
        'app/tsconfig.json': '{"extends":"compiler-settings/tsconfig.json"}',
    });
    const root = join(sandbox.path, 'app');
    expect(readTsconfig(root, join(root, 'tsconfig.json'), createRunCache(root))?.options.strict).toBe(true);
});

test.each([...TSCONFIG_PARSE_ERRORS])(
    '$name raises a configuration error with its compiler message',
    async ({ json, message }) => {
        await using sandbox = await testdir({ 'tsconfig.json': json });
        const path = join(sandbox.path, 'tsconfig.json');
        const error = await captureRejection(
            Promise.try(() => readTsconfig(sandbox.path, path, createRunCache(sandbox.path))),
        );
        expect(error).toBeInstanceOf(GspotError);
        expect(error).toMatchObject({ code: 'configuration', message });
    },
);

test('a tsconfig keeps dependencies reached through a node_modules symlink readable', async () => {
    await using dependencies = await testdir({
        'node_modules/compiler-settings/package.json': '{"name":"compiler-settings","version":"1.0.0"}',
        'node_modules/compiler-settings/tsconfig.json': '{"compilerOptions":{"strict":true}}',
    });
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"compiler-settings/tsconfig.json"}' });
    await symlink(join(dependencies.path, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
    const target = await realpath(join(sandbox.path, 'node_modules/compiler-settings/tsconfig.json'));
    const cache = createRunCache(sandbox.path);
    expect(readTsconfig(sandbox.path, target, cache)?.options.strict).toBe(true);
    expect(readTsconfig(sandbox.path, join(sandbox.path, 'tsconfig.json'), cache)?.options.strict).toBe(true);
});

test('a TypeScript project comes from the nearest covering tsconfig.json and refuses an excluded file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'app/deep' }, { path: 'sibling' }],
        }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["app/**/*.ts"],"exclude":["app/excluded.ts"]}',
        'app/source.ts': 'export const amount = 1;\n',
        'app/deep/source.ts': 'export const amount = 2;\n',
        'app/excluded.ts': 'export const amount = 3;\n',
        'sibling/source.ts': 'export const amount = 4;\n',
    });
    const session = await openSession(sandbox.path);
    const covering = readTsconfigProject(session.root, 'app/deep', ['app/deep/source.ts'], session.cache);
    expect(covering?.path).toBe(join(session.root, 'tsconfig.json'));
    expect(
        readTsconfigProject(session.root, 'app', ['app/source.ts', 'app/excluded.ts'], session.cache),
    ).toBeUndefined();
    expect(readTsconfigProject(session.root, 'sibling', ['sibling/source.ts'], session.cache)).toBeUndefined();
    await writeFile(join(sandbox.path, 'app/tsconfig.json'), '{"files":["source.ts"]}');
    const nearest = await openSession(sandbox.path);
    expect(readTsconfigProject(nearest.root, 'app', ['app/source.ts'], nearest.cache)?.path).toBe(
        join(nearest.root, 'app/tsconfig.json'),
    );
    expect(readTsconfigProject(nearest.root, 'app/deep', ['app/deep/source.ts'], nearest.cache)).toBeUndefined();
});

test('tsconfig reads share one run cache per run and keep folders apart', async () => {
    await using first = await testdir({
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{"compilerOptions":{"strict":true}}',
    });
    await using second = await testdir({ 'tsconfig.json': '{"compilerOptions":{"strict":false}}' });
    const cache = createRunCache(first.path);
    const path = join(cache.root, 'tsconfig.json');
    const initial = readTsconfig(cache.root, path, cache)!;
    expect(initial.options.strict).toBe(true);
    expect(readTsconfig(cache.root, path, cache)).toStrictEqual(initial);
    const secondReads = createRunCache(second.path);
    expect(readTsconfig(second.path, join(second.path, 'tsconfig.json'), secondReads)?.options.strict).toBe(false);
    expect(() => readTsconfig(second.path, path, secondReads)).toThrow(UNSAFE_PATH_MESSAGE);
    await writeFile(join(first.path, 'base.json'), '{"compilerOptions":{"strict":false}}');
    expect(readTsconfig(cache.root, path, cache)).toStrictEqual(initial);
    const next = createRunCache(first.path);
    expect(readTsconfig(next.root, path, next)?.options.strict).toBe(false);
    await writeFile(join(first.path, 'base.json'), '{');
    const invalid = createRunCache(first.path);
    expect(() => readTsconfig(invalid.root, path, invalid)).toThrow(
        "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    );
});
