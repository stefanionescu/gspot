import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import { symlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { prepareBuild, planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';

test('build cache rejects external output links', async () => {
    await using sandbox = await createGitSandbox({});
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_PACKAGE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const folder = planSwiftBuild(session, input).folder;
    prepareBuild(session.root, input.files, folder);
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    const linkedFiles = prepareBuild(session.root, input.files, folder).files;
    const refusal = matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' });
    expect(() => linkedFiles.read('package/authored')).toThrow(refusal);
    expect(() => {
        linkedFiles.write('package/authored', { bytes: Buffer.from('changed'), mode: 0o600 });
    }).toThrow(refusal);
    expect(await readFile(authored, 'utf8')).toBe('preserved');
});

test('the Swift build folder lives in the gspot cache and differs between repositories', async () => {
    await using first = await createGitSandbox({});
    await using second = await createGitSandbox({});
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
    await using installed = await createGitSandbox(files);
    await using first = await createGitSandbox(files);
    await using second = await createGitSandbox(files);
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
