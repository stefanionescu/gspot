import { join } from 'node:path';
import { homedir } from 'node:os';
import { testdir } from 'testdirs';
import { expect, test } from 'bun:test';
import { buildFolder } from '#cli/platform/paths.ts';
import { cacheHome } from '#cli/platform/environment.ts';
import { openBuildCache } from '#cli/checks/swift/cache.ts';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

test('build state is platform-local, stable for one repository, and distinct between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    const folder = buildFolder(first.path);
    expect(folder).toBe(buildFolder(first.path));
    expect(folder).not.toBe(buildFolder(second.path));
    expect(folder.startsWith(join(cacheHome(), 'gspot') + '/')).toBe(true);
    if (process.platform === 'darwin') expect(cacheHome()).toBe(join(homedir(), 'Library', 'Caches'));
    expect(existsSync(join(first.path, '.gspot'))).toBe(false);
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
