import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { simulateOperatingSystem } from '#tests/setup/system.ts';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { buildCheckInput, createCompilerCache } from '#tests/setup/check-input.ts';
import { buildPlan, prepareBuild, getScopeBuildFolder } from '#cli/checks/swift/cache.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/data/checks/swift/projects.ts';

test.each(['default', 'platform=macOS'])(
    'Xcode build plans keep destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildSettingsText(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${declared}`,
            }),
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { commandArguments } = buildPlan(input, { purpose: purpose });
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
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': buildSettingsText(['swift'], { tables }) });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'swift/build', { scope });
        expect(input.selection.view.options('swift').xcode_project).toBe(project);
        const plan = buildPlan(input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.commandArguments[plan.commandArguments.indexOf(container) + 1]).toBe(argument);
        expect(session.settingsFile.text).toBe(buildSettingsText(['swift'], { tables }));
    },
);

test.each([...SWIFT_BUILD_PURPOSES])(
    'Swift $purpose skips without swift.xcode_project or Package.swift, then builds the package once Package.swift exists',
    async ({ purpose, check }) => {
        using _host = simulateOperatingSystem('darwin');
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['swift']),
            'App.xcodeproj/project.pbxproj': '',
            'ExampleTests/Example.swift': 'import XCTest\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, check);
        expect(() => buildPlan(input, { purpose: purpose })).toThrow(
            new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.'),
        );
        using _executables = fakePinnedExecutables(
            [...session.manifests.values()].flatMap((manifest) => manifest.tools),
        );
        const executed = await runChecks(session, buildRunOptions({ only: [check] }));
        expect(executed.report.exitCode).toBe(0);
        expect(executed.report.checks).toContainEqual(
            matchFields({ check, status: 'skipped', findings: [], note: matchSubstring('swift.xcode_project') }),
        );
        expect(await isOnDisk(getScopeBuildFolder(input, purpose))).toBe(false);
        await createFileTree(sandbox.path, {
            'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n',
        });
        const packageInput = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        const plan = buildPlan(packageInput, { purpose: purpose });
        expect(plan.commandArguments[0]).toBe('swift');
        expect(plan.commandArguments).toContain('--scratch-path');
        if (purpose === 'coverage') expect(plan.commandArguments).toContain('--enable-code-coverage');
    },
);

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await createCompilerCache();
    await createFileTree(sandbox.path, { 'gspot.toml': buildSettingsText(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const folder = buildPlan(input).folder;
    {
        const prepared = prepareBuild(input, folder);
        using owner = prepared.files;
        expect(owner.read('build.lock')).toBeDefined();
        expect(() => prepareBuild(input, folder)).toThrow('Another gspot command');
    }
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    {
        const prepared = prepareBuild(input, folder);
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
        const prepared = prepareBuild(input, folder);
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
        await createFileTree(root, { 'gspot.toml': buildSettingsText(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const firstInput = buildCheckInput(await openSession(first.path), 'swift/build');
    const secondInput = buildCheckInput(await openSession(second.path), 'swift/build');
    const folder = buildPlan(firstInput).folder;
    expect(folder).toBe(buildPlan(firstInput).folder);
    expect(folder).not.toBe(buildPlan(secondInput).folder);
    expect(folder.startsWith(readCacheFolder() + sep)).toBe(true);
});
