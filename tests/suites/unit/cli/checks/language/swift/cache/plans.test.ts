import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { SWIFT_PACKAGE, SWIFT_PACKAGE_HEADER } from '#tests/config/swift.ts';
import { SWIFT_BUILD_COMMANDS } from '#cli/config/checks/language/swift/cache.ts';
import { planSwiftBuild, getScopeBuildFolder } from '#cli/checks/language/swift/cache.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/checks/language/swift/cache.ts';

test.each(['default', 'platform=macOS'])(
    'Xcode build plans keep destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const destinationLine = destination === 'default' ? '' : `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${destinationLine}`,
            }),
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build');
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const folder = getScopeBuildFolder(session.toolsRoot, '', purpose);
            expect(planSwiftBuild(session, input, purpose)).toStrictEqual({
                kind: 'xcode',
                purpose,
                folder,
                log: join(folder, 'build.log'),
                commandArguments: [
                    'xcodebuild',
                    ...SWIFT_BUILD_COMMANDS[purpose].xcode,
                    '-project',
                    'App.xcodeproj',
                    '-scheme',
                    'App',
                    '-destination',
                    destination === 'default' ? 'generic/platform=iOS Simulator' : destination,
                    '-derivedDataPath',
                    join(folder, 'derived'),
                    'CODE_SIGNING_ALLOWED=NO',
                ],
            });
        }
    },
);
test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'the swift/build plan $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await testdir({ ...files, 'gspot.toml': buildSandboxSettings(['swift'], { tables }) });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build', { scope });
        expect(getTable(input.scope.settings, 'swift').xcode_project).toBe(project);
        const plan = planSwiftBuild(session, input);
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
        expect(() => planSwiftBuild(session, input, purpose)).toThrow(
            new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.'),
        );
        using _executables = fakeToolExecutables(
            session.configurations
                .values()
                .flatMap((configuration) => configuration.tools)
                .toArray(),
        );
        const run = await runChecks(session, buildRunOptions({ only: [check] }));

        expect(run.report.checks).toMatchObject([
            {
                check,
                status: 'skipped',
                findings: [],
                note: 'Set swift.xcode_project or add Package.swift in this scope.',
            },
        ]);
        expect(await isOnDisk(getScopeBuildFolder(session.toolsRoot, input.scope.folder.path, purpose))).toBe(false);
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE_HEADER,
        });
        const checkedSession = await openSession(sandbox.path);
        const packageInput = planSandboxCheck(checkedSession, 'swift/build');
        const plan = planSwiftBuild(checkedSession, packageInput, purpose);
        const folder = getScopeBuildFolder(checkedSession.toolsRoot, '', purpose);
        const scratch = join(folder, 'package');
        expect(plan).toStrictEqual({
            kind: 'package',
            purpose,
            folder,
            log: join(folder, 'build.log'),
            scratch,
            commandArguments: ['swift', ...SWIFT_BUILD_COMMANDS[purpose].package, '--scratch-path', scratch],
        });
    },
);
