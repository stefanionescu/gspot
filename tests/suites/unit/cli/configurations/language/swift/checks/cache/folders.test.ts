import { sep } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { openSession } from '#cli/engine/session.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
