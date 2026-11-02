import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { runChecks } from '#cli/engine/run.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { openSession } from '#cli/engine/session.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/configurations/swift.ts';
import { XCTEST_SOURCE, SWIFT_PACKAGE_HEADER } from '#tests/config/setup/languages.ts';
import { planSwiftBuild, readRepositoryCacheFolder } from '#cli/configurations/language/swift/checks/cache.ts';

test.each(['platform=macOS'])(
    'Xcode build plans keep destination %s for the build and the tests',
    async (destination) => {
        await using sandbox = await createGitSandbox({});
        const destinationLine = `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${destinationLine}`,
            }),
        });
        const session = await openSession(sandbox.path);
        const { kind, commandArguments, testArguments } = planSwiftBuild(
            session,
            planSandboxCheck(session, 'swift/build'),
        );
        expect(kind).toBe('xcode');
        expect(commandArguments).toContain('-disableAutomaticPackageResolution');
        expect(commandArguments).toContain('SWIFT_TREAT_WARNINGS_AS_ERRORS=YES');
        for (const command of [commandArguments, testArguments])
            expect(command[command.indexOf('-destination') + 1]).toBe(destination);
    },
);

test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'the swift/build plan $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'gspot.toml': buildSandboxSettings(['swift'], { tables }),
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build', { scope });
        expect(getTable(input.scope.settings, 'swift').xcode_project).toBe(project);
        const plan = planSwiftBuild(session, input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.commandArguments[plan.commandArguments.indexOf(container) + 1]).toBe(argument);
    },
);

test('Swift skips without swift.xcode_project or Package.swift, then builds the package once Package.swift exists', async () => {
    using _host = fakePlatform('darwin');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'App.xcodeproj/project.pbxproj': '',
        'ExampleTests/Example.swift': XCTEST_SOURCE,
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    expect(() => planSwiftBuild(session, input)).toThrow(
        matchFields<CheckStop>({
            name: 'CheckStop',
            status: 'skipped',
            message: 'Set swift.xcode_project or add Package.swift in this scope.',
        }),
    );
    using _executables = fakeToolExecutables(
        readConfigurations()
            .values()
            .flatMap((configuration) => configuration.tools)
            .toArray(),
    );
    const run = await runChecks(session, buildRunOptions({ only: ['swift/build'] }));

    expect(run.report.checks).toMatchObject([
        {
            check: 'swift/build',
            status: 'skipped',
            findings: [],
            note: 'Set swift.xcode_project or add Package.swift in this scope.',
        },
    ]);
    expect(await isOnDisk(join(readRepositoryCacheFolder(session.toolsRoot), 'swift', 'root'))).toBe(false);
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE_HEADER,
    });
    const checkedSession = await openSession(sandbox.path);
    const packageInput = planSandboxCheck(checkedSession, 'swift/build');
    const plan = planSwiftBuild(checkedSession, packageInput);
    expect(plan.kind).toBe('package');
    expect(plan.commandArguments).toContain('--force-resolved-versions');
    expect(plan.commandArguments).toContain('-warnings-as-errors');
});
