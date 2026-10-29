import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { SWIFT_PACKAGE } from '#tests/config/swift.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { prepareBuild, planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_PACKAGE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const folder = planSwiftBuild(session, input).folder;
    const held = prepareBuild(session.root, input.files, folder).files;
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(true);
    expect(() => prepareBuild(session.root, input.files, folder)).toThrow(
        new Error(
            `Another gspot command, process ${String(process.pid)}, holds build.lock. Retry after it finishes, or delete build.lock when no gspot command is running.`,
        ),
    );
    held[Symbol.dispose]();
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    const linkedFiles = prepareBuild(session.root, input.files, folder).files;
    expect(() => linkedFiles.read('package/authored')).toThrow(
        new Error('A parent of package/authored is a link or is not a folder. Choose a folder without links.'),
    );
    expect(() => {
        linkedFiles.write('package/authored', { bytes: Buffer.from('changed'), mode: 0o600 }, undefined);
    }).toThrow(new Error('A parent of package/authored is a link or is not a folder. Choose a folder without links.'));
    linkedFiles[Symbol.dispose]();
    expect(await readFile(authored, 'utf8')).toBe('preserved');
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
    await rm(join(folder, 'package'));
    await mkdir(join(folder, 'package'));
    const repaired = prepareBuild(session.root, input.files, folder).files;
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(true);
    repaired[Symbol.dispose]();
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
});

test('the Swift build folder lives in the gspot cache and differs between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await using _cache = await redirectCacheFolder();
    for (const root of [first.path, second.path])
        await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const firstSession = await openSession(first.path);
    const firstInput = planSandboxCheck(firstSession, 'swift/build');
    const secondSession = await openSession(second.path);
    const secondInput = planSandboxCheck(secondSession, 'swift/build');
    const folder = planSwiftBuild(firstSession, firstInput).folder;
    expect(folder).not.toBe(planSwiftBuild(secondSession, secondInput).folder);
    expect(folder).toStartWith(readCacheFolder() + sep);
});

test('two copies of one repository that share a tools root share one build folder', async () => {
    const files = { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE };
    await using installed = await testdir(files);
    await using first = await testdir(files);
    await using second = await testdir(files);
    await using _cache = await redirectCacheFolder();
    const session = await openSession(installed.path);
    const installedInput = planSandboxCheck(session, 'swift/build');
    const firstSession = await openSession(first.path, { toolsRoot: installed.path });
    const firstInput = planSandboxCheck(firstSession, 'swift/build');
    const secondSession = await openSession(second.path, { toolsRoot: installed.path });
    const secondInput = planSandboxCheck(secondSession, 'swift/build');
    const firstFolder = planSwiftBuild(firstSession, firstInput).folder;
    const secondFolder = planSwiftBuild(secondSession, secondInput).folder;
    expect(firstFolder).toBe(secondFolder);
    expect(firstFolder).toBe(planSwiftBuild(session, installedInput).folder);
});
