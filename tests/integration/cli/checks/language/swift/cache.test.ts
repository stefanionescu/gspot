import { testdir } from 'testdirs';
import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { buildFolder } from '#cli/platform/paths.ts';
import { openBuildCache } from '#cli/checks/language/swift/cache.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { cacheDirectory, environmentVariables } from '#cli/platform/environment.ts';
import { rmSync, mkdirSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('build state lives in the gspot cache, stable for one repository and distinct between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    const folder = buildFolder(first.path);
    expect(folder).toBe(buildFolder(first.path));
    expect(folder).not.toBe(buildFolder(second.path));
    expect(folder.startsWith(cacheDirectory() + sep)).toBe(true);
    expect(existsSync(join(first.path, '.gspot'))).toBe(false);
});

// macOS has one cache directory under the library folder, which no variable moves.
test.skipIf(process.platform === 'darwin')('a relative cache directory override is refused', () => {
    const name = process.platform === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    const previous = environmentVariables()[name];
    setEnvironmentVariable(name, 'cache');
    try {
        expect(() => cacheDirectory()).toThrow('must be absolute');
    } finally {
        setEnvironmentVariable(name, previous);
    }
});

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const folder = join(buildFolder(sandbox.path), 'swift', 'compile');
    try {
        const owner = openBuildCache(folder);
        try {
            expect(() => openBuildCache(folder)).toThrow('Another lifecycle writer');
        } finally {
            owner.close();
        }
        const authored = join(outside.path, 'authored');
        writeFileSync(authored, 'preserved');
        symlinkSync(outside.path, join(folder, 'package'));
        expect(() => openBuildCache(folder)).toThrow('Source link leaves the repository');
        expect(readFileSync(authored, 'utf8')).toBe('preserved');
        expect(existsSync(join(folder, 'build.lock'))).toBe(false);
        rmSync(join(folder, 'package'));
        mkdirSync(join(folder, 'package'));
        const corrected = openBuildCache(folder);
        corrected.close();
        expect(existsSync(join(folder, 'build.lock'))).toBe(false);
    } finally {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    }
});
