import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { usePlatform } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { buildPlan } from '#cli/checks/language/swift/plan.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { buildFolder } from '#cli/checks/language/swift/cache.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/cli/checks/language/swift/build.ts';

test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'Swift build selection $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': buildPolicy(['swift'], { tables }) });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'swift/build', { scope });
        expect(input.view.options('swift').xcode_project).toBe(project);
        const plan = buildPlan(input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.argv[plan.argv.indexOf(container) + 1]).toBe(argument);
        expect(session.policyFiles.text).toBe(buildPolicy(['swift'], { tables }));
    },
);

test.each([...SWIFT_BUILD_PURPOSES])(
    'Swift $purpose skips a missing project and keeps an authored empty choice',
    async ({ purpose, check }) => {
        using _host = usePlatform('darwin');
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift', 'xctest'], { tables: '[swift]\nxcode_project = ""\n' }),
            'App.xcodeproj/project.pbxproj': '',
            'ExampleTests/Example.swift': 'import XCTest\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, check);
        expect(input.view.options('swift').xcode_project).toBe('');
        expect(() => buildPlan(input, purpose)).toThrow(
            new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.'),
        );
        using _executables = mockPinnedExecutables(
            [...session.manifests.values()].flatMap((manifest) => manifest.tools),
        );
        const executed = await executeRun(session, buildRunOptions({ only: [check] }));
        expect(executed.report.exitCode).toBe(0);
        expect(executed.report.checks).toContainEqual(
            containing({ check, status: 'skipped', findings: [], note: textContaining('swift.xcode_project') }),
        );
        expect(await pathExists(buildFolder(sandbox.path))).toBe(false);
        await createFileTree(sandbox.path, {
            'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n',
        });
        const packageInput = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        const plan = buildPlan(packageInput, purpose);
        expect(plan.argv[0]).toBe('swift');
        expect(plan.argv).toContain('--scratch-path');
        if (purpose === 'coverage') expect(plan.argv).toContain('--enable-code-coverage');
    },
);
