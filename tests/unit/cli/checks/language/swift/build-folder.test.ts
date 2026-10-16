import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/checks/run/run.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { SWIFT_PACKAGE } from '#tests/config/swift/package.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { useOperatingSystem } from '#tests/setup/operating-systems.ts';
import { configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { buildCheckInput, isolateCompilerCache } from '#tests/setup/check-input.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/swift/projects.ts';
import { buildPlan, prepareBuild, scopeBuildFolder } from '#cli/checks/language/swift/build-folder.ts';

test.each(['default', 'platform=macOS'])(
    'Xcode build plans keep destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': settingsText(['swift', 'xcode'], {
                tables: `[xcode]\nproject = "App.xcodeproj"\nscheme = "App"\n${declared}`,
            }),
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { argv } = buildPlan(input, { purpose: purpose });
            expect(argv[argv.indexOf('-destination') + 1]).toBe(
                destination === 'default'
                    ? configurationTableSchemas.xcode.unwrap().shape.destination.parse(undefined)
                    : destination,
            );
            expect(argv[argv.indexOf('-scheme') + 1]).toBe('App');
            expect(argv).toContain('App.xcodeproj');
        }
    },
);

test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'Swift build selection $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': settingsText(['swift'], { tables }) });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'swift/build', { scope });
        expect(input.scope.view.options('xcode').project).toBe(project);
        const plan = buildPlan(input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.argv[plan.argv.indexOf(container) + 1]).toBe(argument);
        expect(session.settingsFile.text).toBe(settingsText(['swift'], { tables }));
    },
);

test.each([...SWIFT_BUILD_PURPOSES])(
    'Swift $purpose skips without xcode.project or Package.swift, then builds the package once Package.swift exists',
    async ({ purpose, check }) => {
        using _host = useOperatingSystem('darwin');
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['swift', 'swift-tests']),
            'App.xcodeproj/project.pbxproj': '',
            'ExampleTests/Example.swift': 'import XCTest\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, check);
        expect(() => buildPlan(input, { purpose: purpose })).toThrow(
            new GspotError('skip', 'Set xcode.project or add Package.swift in this scope.'),
        );
        using _executables = mockPinnedExecutables(
            [...session.manifests.values()].flatMap((manifest) => manifest.tools),
        );
        const executed = await executeRun(session, buildRunOptions({ only: [check] }));
        expect(executed.report.exitCode).toBe(0);
        expect(executed.report.checks).toContainEqual(
            containing({ check, status: 'skipped', findings: [], note: textContaining('xcode.project') }),
        );
        expect(await pathExists(scopeBuildFolder(input, purpose))).toBe(false);
        await createFileTree(sandbox.path, {
            'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n',
        });
        const packageInput = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        const plan = buildPlan(packageInput, { purpose: purpose });
        expect(plan.argv[0]).toBe('swift');
        expect(plan.argv).toContain('--scratch-path');
        if (purpose === 'coverage') expect(plan.argv).toContain('--enable-code-coverage');
    },
);

test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await isolateCompilerCache();
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText(['swift']), 'Package.swift': SWIFT_PACKAGE });
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
    expect(await pathExists(join(folder, 'build.lock'))).toBe(false);
    await rm(join(folder, 'package'));
    await mkdir(join(folder, 'package'));
    {
        const prepared = prepareBuild(input, folder);
        using corrected = prepared.files;
        expect(corrected.read('build.lock')).toBeDefined();
    }
    expect(await pathExists(join(folder, 'build.lock'))).toBe(false);
});

test('build state lives in the gspot cache, stable for one repository and distinct between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await using _cache = await isolateCompilerCache();
    for (const root of [first.path, second.path])
        await createFileTree(root, { 'gspot.toml': settingsText(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const firstInput = buildCheckInput(await openSession(first.path), 'swift/build');
    const secondInput = buildCheckInput(await openSession(second.path), 'swift/build');
    const folder = buildPlan(firstInput).folder;
    expect(folder).toBe(buildPlan(firstInput).folder);
    expect(folder).not.toBe(buildPlan(secondInput).folder);
    expect(folder.startsWith(readCacheFolder() + sep)).toBe(true);
});
