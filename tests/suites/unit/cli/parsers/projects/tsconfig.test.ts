import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';

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
    const covering = readTsconfigProject(session.root, 'app/deep', ['app/deep/source.ts'], session.reads);
    expect(covering?.path).toBe(join(session.root, 'tsconfig.json'));
    expect(
        readTsconfigProject(session.root, 'app', ['app/source.ts', 'app/excluded.ts'], session.reads),
    ).toBeUndefined();
    expect(readTsconfigProject(session.root, 'sibling', ['sibling/source.ts'], session.reads)).toBeUndefined();
    await writeFile(join(sandbox.path, 'app/tsconfig.json'), '{"files":["source.ts"]}');
    const nearest = await openSession(sandbox.path);
    expect(readTsconfigProject(nearest.root, 'app', ['app/source.ts'], nearest.reads)?.path).toBe(
        join(nearest.root, 'app/tsconfig.json'),
    );
    expect(readTsconfigProject(nearest.root, 'app/deep', ['app/deep/source.ts'], nearest.reads)).toBeUndefined();
});

test('tsconfig reads share one read cache per run and keep folders apart', async () => {
    await using first = await testdir({
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{"compilerOptions":{"strict":true}}',
    });
    await using second = await testdir({ 'tsconfig.json': '{"compilerOptions":{"strict":false}}' });
    const reads = createReadCache(first.path);
    const path = join(reads.root, 'tsconfig.json');
    const initial = readTsconfig(reads.root, path, reads)!;
    expect(initial.options.strict).toBe(true);
    expect(readTsconfig(reads.root, path, reads)).toStrictEqual(initial);
    const secondReads = createReadCache(second.path);
    expect(readTsconfig(second.path, join(second.path, 'tsconfig.json'), secondReads)?.options.strict).toBe(false);
    expect(() => readTsconfig(second.path, path, secondReads)).toThrow('is not a safe repository-relative path');
    await writeFile(join(first.path, 'base.json'), '{"compilerOptions":{"strict":false}}');
    expect(readTsconfig(reads.root, path, reads)).toStrictEqual(initial);
    const next = createReadCache(first.path);
    expect(readTsconfig(next.root, path, next)?.options.strict).toBe(false);
    await writeFile(join(first.path, 'base.json'), '{');
    const invalid = createReadCache(first.path);
    expect(() => readTsconfig(invalid.root, path, invalid)).toThrow('Cannot read the tsconfig file');
});
