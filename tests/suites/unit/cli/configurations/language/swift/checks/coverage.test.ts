import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir, type TestdirResult } from 'testdirs';

import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import * as environment from '#cli/system/environment.ts';
import type { RunResult } from '#cli/types/engine/run.ts';
import {
    COVERAGE_LIMIT_CASES,
    SWIFT_PACKAGE_COVERAGE_FILES,
    SWIFT_PACKAGE_COVERAGE_TARGETS,
    XCTEST_FAILURES,
    XCTEST_TABLES,
} from '#tests/config/configurations/swift.ts';
import { SWIFT_PACKAGE_HEADER, XCTEST_SOURCE } from '#tests/config/setup/languages.ts';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';

test.each([...XCTEST_FAILURES])(
    'swift/tests: XCTest coverage classifies $failure',
    async ({ tables, build, coverage, code, status, produced, hasNote, failure }) => {
        await using sandbox = await createGitSandbox({});
        await using _cache = await redirectCacheFolder();
        const result = await runXcodeCoverage(sandbox, {
            tables,
            xcodebuild: [...build],
            xcrun: [
                '--write',
                'viewed.txt=viewed',
                '--line',
                coverage === undefined
                    ? '{}'
                    : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }),
            ],
        });
        expect(result.report.exitCode).toBe(code);
        expect(result.report.checks[0]!.status).toBe(status);
        expect(result.report.checks[0]!.note !== undefined).toBe(hasNote);
        if (failure === 'failed-test')
            expect(result.report.checks[0]!.findings).toMatchObject([
                { rule: 'failed-test', file: 'ExampleTests.swift', line: 3, message: 'Expected true.' },
            ]);
        const session = await openSession(sandbox.path);
        const viewed = join(
            planSwiftBuild(session, planSandboxCheck(session, 'swift/tests')).folder,
            'source/viewed.txt',
        );
        expect(existsSync(viewed) ? await readFile(viewed, 'utf8') : undefined).toBe(produced ? 'viewed' : undefined);
    },
);

async function runXcodeCoverage(
    sandbox: TestdirResult,
    options: { tables: string; xcodebuild: string[]; xcrun: string[] },
): Promise<RunResult> {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift', 'xcode'], { tables: options.tables }),
        'ExampleTests.swift': XCTEST_SOURCE,
        'Example.xcodeproj/project.pbxproj': '',
    });
    await writeProgramCommand(sandbox.path, 'node_modules/.bin/xcodebuild', 'fakes/xcodebuild', ...options.xcodebuild);
    await writeProgramCommand(sandbox.path, 'node_modules/.bin/xcrun', 'fakes/tool', ...options.xcrun);
    return await runChecks(await openSession(sandbox.path), buildRunOptions({ stage: 'push', only: ['swift/tests'] }));
}

test('swift/tests: XCTest coverage refuses an external result link and removes a previous result bundle', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift', 'xcode'], { tables: XCTEST_TABLES }),
        'ExampleTests.swift': XCTEST_SOURCE,
        'Example.xcodeproj/project.pbxproj': '',
    });
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();

    const files = {
        tables: XCTEST_TABLES,
        xcodebuild: ['--refuse-previous-bundle', '--mark-tested'],
        xcrun: ['--line', JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] })],
    };
    const session = await openSession(sandbox.path);
    const cache = planSwiftBuild(session, planSandboxCheck(session, 'swift/tests')).folder;
    await writeFile(join(outside.path, 'authored.txt'), 'preserved');
    await mkdir(cache, { recursive: true });
    const bundle = join(cache, 'coverage.xcresult');
    await symlink(outside.path, bundle, 'dir');
    const refused = await runXcodeCoverage(sandbox, files);
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]?.note).toContain('coverage.xcresult');
    expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    expect(existsSync(join(cache, 'source/tested.txt'))).toBe(false);
    await rm(bundle);
    await mkdir(join(bundle, 'data'), { recursive: true });
    await writeFile(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
    const corrected = await runXcodeCoverage(sandbox, files);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(existsSync(bundle)).toBe(false);
    expect(await readFile(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
});

test('Swift package coverage runs swift test, reads the custom target paths, and applies every target limit', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await createGitSandbox({});
    await using _cache = await redirectCacheFolder();
    const reportPath = join(sandbox.path, 'coverage-input.json');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[coverage]\nmin_line_percent = 0\n[[coverage.swift_target]]\nname = "Core"\nmin_line_percent = 51\n[[coverage.swift_target]]\nname = "API"\nmin_line_percent = 67\n',
        }),
        'Package.swift': SWIFT_PACKAGE_HEADER,
        'Custom/Core/First.swift': 'func first() -> Int { 1 }\n',
        'Custom/Core/Second.swift': 'func second() -> Int { 2 }\n',
        'Sources/API/API.swift': 'func request() -> Int { 3 }\n',
        'Tests/CoreTests/CoreTests.swift': 'import XCTest\nfinal class CoreTests: XCTestCase {}\n',
    });
    await writeFile(reportPath, JSON.stringify(SWIFT_PACKAGE_COVERAGE_FILES));
    await writeProgramCommand(
        sandbox.path,
        'node_modules/.bin/swift',
        'fakes/swift',
        '--report',
        reportPath,
        '--targets',
        JSON.stringify({ targets: SWIFT_PACKAGE_COVERAGE_TARGETS }),
        '--',
    );
    const measured = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift/tests'] }),
    );

    expect(measured.report.checks[0]?.findings.map(({ message }) => message)).toStrictEqual([
        'Core covers 50% of its lines, under the limit of 51%.',
        'API covers 66% of its lines, under the limit of 67%.',
    ]);
    await writeFile(
        reportPath,
        JSON.stringify(SWIFT_PACKAGE_COVERAGE_FILES.filter(({ filename }) => !filename.endsWith('API.swift'))),
    );
    const omitted = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift/tests'] }),
    );

    expect(omitted.report.checks[0]?.note).toMatch(/\bAPI\b/u);
});

test.each([...COVERAGE_LIMIT_CASES])(
    'swift/tests compares each target with the shared and per-target limits: $name',
    async ({ report, tables, expected }) => {
        await using _cache = await redirectCacheFolder();
        await using sandbox = await createGitSandbox({});
        const result = await runXcodeCoverage(sandbox, {
            tables: `[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n${tables}`,
            xcodebuild: [],
            xcrun: ['--line', JSON.stringify(report)],
        });
        expect(
            result.report.checks[0]?.findings.map((finding) => finding.message),
            JSON.stringify(result.report),
        ).toStrictEqual([...expected]);
    },
);

test('Swift Testing failures name the test file and its source position', async () => {
    await using sandbox = await createGitSandbox({});
    await using _cache = await redirectCacheFolder();
    const result = await runXcodeCoverage(sandbox, {
        tables: XCTEST_TABLES,
        xcodebuild: [
            '--exit',
            '65',
            '--failure',
            'Test value() recorded an issue at ExampleTests.swift:4:8: Expected true.',
        ],
        xcrun: [],
    });
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks[0]?.findings).toMatchObject([
        { rule: 'failed-test', file: 'ExampleTests.swift', line: 4, column: 8, message: 'Expected true.' },
    ]);
});
