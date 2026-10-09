import { testdir } from 'testdirs';
import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { cacheDirectory } from '#cli/platform/public.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isolateCompilerCache } from '#tests/harness/environment.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { buildFolder, openBuildCache } from '#cli/checks/language/swift/public.ts';

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await isolateCompilerCache();
    const folder = join(buildFolder(sandbox.path), 'swift', 'compile');
    {
        using owner = openBuildCache(folder);
        expect(owner.read('build.lock')).toBeDefined();
        expect(() => openBuildCache(folder)).toThrow('Another lifecycle writer');
    }
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    expect(() => openBuildCache(folder)).toThrow('Build folder contains an unsafe symbolic link: package');
    expect(await readFile(authored, 'utf8')).toBe('preserved');
    expect(await pathExists(join(folder, 'build.lock'))).toBe(false);
    await rm(join(folder, 'package'));
    await mkdir(join(folder, 'package'));
    {
        using corrected = openBuildCache(folder);
        expect(corrected.read('build.lock')).toBeDefined();
    }
    expect(await pathExists(join(folder, 'build.lock'))).toBe(false);
});

test('build state lives in the gspot cache, stable for one repository and distinct between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await using _cache = await isolateCompilerCache();
    const folder = buildFolder(first.path);
    expect(folder).toBe(buildFolder(first.path));
    expect(folder).not.toBe(buildFolder(second.path));
    expect(folder.startsWith(cacheDirectory() + sep)).toBe(true);
});
