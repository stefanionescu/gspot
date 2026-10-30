import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import * as environment from '#cli/system/environment.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { type RunResult } from '#cli/types/commands/check.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { XCTEST_SOURCE, SWIFT_PACKAGE_HEADER } from '#tests/config/swift.ts';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';

import {
    XCTEST_TABLES,
    XCTEST_FAILURES,
    COVERAGE_LIMIT_CASES,
    UNTESTED_COVERAGE_RESULTS,
    SWIFT_PACKAGE_COVERAGE_FILES,
    SWIFT_PACKAGE_COVERAGE_TARGETS,
} from '#tests/config/checks/language/swift/coverage.ts';

test.each([...XCTEST_FAILURES])(
    'swift/coverage: XCTest coverage classifies $failure and passes after the fix',
    async ({ tables, build, coverage, code, status, produced, note, failure }) => {
        await using sandbox = await testdir();
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
        expect(result.report.checks[0]!.note).toBe(note);
        if (failure === 'failed-test')
            expect(result.report.checks[0]!.findings).toMatchObject([
                { rule: 'failed-test', file: 'ExampleTests.swift', line: 3, message: 'Expected true.' },
            ]);
        expect(await isOnDisk(join(sandbox.path, 'viewed.txt'))).toBe(false);
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['swift', 'xcode'], { tables: XCTEST_TABLES }),
        );
        const session = await openSession(sandbox.path);
        const viewed = join(
            planSwiftBuild(session, planSandboxCheck(session, 'swift/coverage'), 'coverage').folder,
            'source/viewed.txt',
        );
        expect((await isOnDisk(viewed)) ? await readFile(viewed, 'utf8') : undefined).toBe(
            produced ? 'viewed' : undefined,
        );
        const corrected = await runXcodeCoverage(sandbox, {
            tables: XCTEST_TABLES,
            xcodebuild: [],
            xcrun: ['--line', JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] })],
        });
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'swift/coverage', status: 'passed', findings: [] }]);
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
    return await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift/coverage'] }),
    );
}

test('swift/coverage: XCTest coverage refuses an external result link and removes a previous result bundle', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift', 'xcode'], { tables: XCTEST_TABLES }),
        'ExampleTests.swift': XCTEST_SOURCE,
        'Example.xcodeproj/project.pbxproj': '',
    });

    const files = {
        tables: XCTEST_TABLES,
        xcodebuild: ['--refuse-previous-bundle', '--mark-tested'],
        xcrun: ['--line', JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] })],
    };
    const session = await openSession(sandbox.path);
    const cache = planSwiftBuild(session, planSandboxCheck(session, 'swift/coverage'), 'coverage').folder;
    await writeFile(join(outside.path, 'authored.txt'), 'preserved');
    await mkdir(cache, { recursive: true });
    const bundle = join(cache, 'coverage.xcresult');
    await symlink(outside.path, bundle, 'dir');
    const refused = await runXcodeCoverage(sandbox, files);
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]?.note).toBe(
        'The swift/coverage check failed: coverage.xcresult is a link. gspot does not write through links.',
    );
    expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    expect(await isOnDisk(join(cache, 'source/tested.txt'))).toBe(false);
    await rm(bundle);
    await mkdir(join(bundle, 'data'), { recursive: true });
    await writeFile(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
    const corrected = await runXcodeCoverage(sandbox, files);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(await isOnDisk(bundle)).toBe(false);
    expect(await readFile(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
    expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
});

test('Swift package coverage runs swift test, reads the custom target paths, and applies every target limit', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await testdir();
    await using _cache = await redirectCacheFolder();
    const reportPath = join(sandbox.path, 'coverage-input.json');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[coverage]\nlines = 0\n[[coverage.swift_target]]\nname = "Core"\nlines = 51\n[[coverage.swift_target]]\nname = "API"\nlines = 67\n',
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
        buildRunOptions({ stage: 'push', only: ['swift/coverage'] }),
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
        buildRunOptions({ stage: 'push', only: ['swift/coverage'] }),
    );

    expect(omitted.report.checks[0]?.note).toBe(
        'The swift/coverage check failed: The Swift coverage report has no source lines for target API.',
    );
});

test('Swift coverage skips a scope that holds no Swift tests', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_PACKAGE_HEADER,
        'Sources/App/App.swift': 'func value() -> Int { 1 }\n',
    });

    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift/coverage'] }),
    );
    expect(report.checks).toMatchObject([...UNTESTED_COVERAGE_RESULTS]);
});

test.each([...COVERAGE_LIMIT_CASES])(
    'swift/coverage compares each target with the shared and per-target limits: $name',
    async ({ report, tables, expected }) => {
        await using _cache = await redirectCacheFolder();
        await using sandbox = await testdir();
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
    await using sandbox = await testdir();
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
