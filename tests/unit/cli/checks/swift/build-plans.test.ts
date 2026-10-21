import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { getTable } from '#cli/settings/scope-view.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { simulateOperatingSystem } from '#tests/setup/system.ts';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { planSandboxCheck, createCompilerCache } from '#tests/setup/check-input.ts';
import { buildPlan, prepareBuild, getScopeBuildFolder } from '#cli/checks/swift/cache.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/data/checks/swift/projects.ts';

test.each(['default', 'platform=macOS'])(
    'Xcode build plans keep destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${declared}`,
            }),
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build');
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { commandArguments } = buildPlan(session, input, { purpose: purpose });
            expect(commandArguments[commandArguments.indexOf('-destination') + 1]).toBe(
                destination === 'default'
                    ? configurationTableSchemas.swift.unwrap().shape.xcode_destination.parse(undefined)
                    : destination,
            );
            expect(commandArguments[commandArguments.indexOf('-scheme') + 1]).toBe('App');
            expect(commandArguments).toContain('App.xcodeproj');
        }
    },
);

test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'Swift build selection $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await testdir({ ...files, 'gspot.toml': buildSandboxSettings(['swift'], { tables }) });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build', { scope });
        expect(getTable(input.selection.view, 'swift').xcode_project).toBe(project);
        const plan = buildPlan(session, input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.commandArguments[plan.commandArguments.indexOf(container) + 1]).toBe(argument);
    },
);

test.each([...SWIFT_BUILD_PURPOSES])(
    'Swift $purpose skips without swift.xcode_project or Package.swift, then builds the package once Package.swift exists',
    async ({ purpose, check }) => {
        using _host = simulateOperatingSystem('darwin');
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift']),
            'App.xcodeproj/project.pbxproj': '',
            'ExampleTests/Example.swift': 'import XCTest\n',
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, check);
        expect(() => buildPlan(session, input, { purpose: purpose })).toThrow(
            new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.'),
        );
        using _executables = fakePinnedExecutables(
            [...session.manifests.values()].flatMap((manifest) => manifest.tools),
        );
        const executed = await runChecks(session, buildRunOptions({ only: [check] }));

        expect(executed.report.checks).toContainEqual(
            matchFields({ check, status: 'skipped', findings: [], note: matchSubstring('swift.xcode_project') }),
        );
        expect(await isOnDisk(getScopeBuildFolder(session.installedRoot, input.selection.scope.path, purpose))).toBe(
            false,
        );
        await createFileTree(sandbox.path, {
            'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n',
        });
        const checkedSession = await openSession(sandbox.path);
        const packageInput = planSandboxCheck(checkedSession, 'swift/build');
        const plan = buildPlan(checkedSession, packageInput, { purpose: purpose });
        expect(plan.commandArguments[0]).toBe('swift');
        if (plan.kind !== 'package') throw new Error('Expected a Swift package build.');
        expect(plan.commandArguments).toContain(plan.scratch);
        if (purpose === 'coverage') expect(plan.commandArguments).toContain('--enable-code-coverage');
    },
);

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await createCompilerCache();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_PACKAGE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const folder = buildPlan(session, input).folder;
    {
        const prepared = prepareBuild(session.root, input.files, folder);
        using owner = prepared.files;
        expect(owner.read('build.lock')).toBeDefined();
        expect(() => prepareBuild(session.root, input.files, folder)).toThrow('Another gspot command');
    }
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    {
        const prepared = prepareBuild(session.root, input.files, folder);
        using owner = prepared.files;
        expect(() => owner.read('package/authored')).toThrow();
        expect(() => {
            owner.write('package/authored', { bytes: Buffer.from('changed'), mode: 0o600 }, undefined);
        }).toThrow();
    }
    expect(await readFile(authored, 'utf8')).toBe('preserved');
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
    await rm(join(folder, 'package'));
    await mkdir(join(folder, 'package'));
    {
        const prepared = prepareBuild(session.root, input.files, folder);
        using corrected = prepared.files;
        expect(corrected.read('build.lock')).toBeDefined();
    }
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
});

test('build state lives in the gspot cache, stable for one repository and distinct between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await using _cache = await createCompilerCache();
    for (const root of [first.path, second.path])
        await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const session = await openSession(first.path);
    const firstInput = planSandboxCheck(session, 'swift/build');
    const checkedSession = await openSession(second.path);
    const secondInput = planSandboxCheck(checkedSession, 'swift/build');
    const folder = buildPlan(session, firstInput).folder;
    expect(folder).toBe(buildPlan(session, firstInput).folder);
    expect(folder).not.toBe(buildPlan(checkedSession, secondInput).folder);
    expect(folder.startsWith(readCacheFolder() + sep)).toBe(true);
});

test('two copies of one repository with the same installed root share one build folder', async () => {
    const files = { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE };
    await using installed = await testdir(files);
    await using first = await testdir(files);
    await using second = await testdir(files);
    await using _cache = await createCompilerCache();
    const session = await openSession(installed.path);
    const installedInput = planSandboxCheck(session, 'swift/build');
    const checkedSession = await openSession(first.path, { installedRoot: installed.path });
    const firstInput = planSandboxCheck(checkedSession, 'swift/build');
    const correctedSession = await openSession(second.path, { installedRoot: installed.path });
    const secondInput = planSandboxCheck(correctedSession, 'swift/build');
    const firstFolder = buildPlan(checkedSession, firstInput).folder;
    const secondFolder = buildPlan(correctedSession, secondInput).folder;
    expect(firstFolder).toBe(secondFolder);
    expect(firstFolder).toBe(buildPlan(session, installedInput).folder);
});
