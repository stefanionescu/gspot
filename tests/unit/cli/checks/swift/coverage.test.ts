import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { buildPlan } from '#cli/checks/swift/cache.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { type RunResult } from '#cli/types/runs/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { SWIFT_PACKAGE_HEADER } from '#tests/data/checks/swift/sandbox.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { planSandboxCheck, redirectCacheFolder } from '#tests/setup/cli/checks.ts';

import {
    XCTEST_FAILURES,
    XCTEST_SETTINGS,
    COVERAGE_LIMIT_CASES,
    UNTESTED_COVERAGE_RESULTS,
    SWIFT_PACKAGE_COVERAGE_FILES,
    SWIFT_PACKAGE_COVERAGE_TARGETS,
} from '#tests/data/checks/swift/coverage.ts';

test.each([...XCTEST_FAILURES])(
    'swift/coverage: XCTest coverage classifies $failure and passes after the fix',
    async ({ settings, build, coverage, code, status, produced, note }) => {
        await using sandbox = await testdir();
        await using _cache = await redirectCacheFolder();
        const result = await runXcodeCoverage(sandbox, {
            settings,
            xcodebuild: build,
            xcrun: `await Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(coverage === undefined ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }))});\n`,
        });
        expect(result.report.exitCode).toBe(code);
        expect(result.report.checks[0]!.status).toBe(status);
        if (note !== undefined) expect(result.report.checks[0]!.note).toContain(note);
        expect(await isOnDisk(join(sandbox.path, 'viewed.txt'))).toBe(false);
        await writeFile(join(sandbox.path, 'gspot.toml'), XCTEST_SETTINGS);
        const session = await openSession(sandbox.path);
        const viewed = join(
            buildPlan(session, planSandboxCheck(session, 'swift/coverage'), {
                purpose: 'coverage',
            }).folder,
            'source/viewed.txt',
        );
        // The build folder keeps the coverage view after the run produces it.
        expect((await isOnDisk(viewed)) ? await readFile(viewed, 'utf8') : undefined).toBe(
            produced ? 'viewed' : undefined,
        );
        const corrected = await runXcodeCoverage(sandbox, {
            settings: XCTEST_SETTINGS,
            xcodebuild: '',
            xcrun: `console.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});\n`,
        });
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'swift/coverage', status: 'passed', findings: [] }]);
    },
);

/** Run Xcode coverage with the settings and fake process outputs of one scenario. */
async function runXcodeCoverage(
    sandbox: TestdirResult,
    files: { settings: string; xcodebuild: string; xcrun: string },
): Promise<RunResult> {
    using _system = simulateOperatingSystem('darwin');
    await createFileTree(sandbox.path, {
        'gspot.toml': files.settings,
        'ExampleTests.swift': 'import XCTest\n',
        'Example.xcodeproj/project.pbxproj': '',
    });
    await writeScriptCommand(sandbox.path, 'node_modules/.bin/xcodebuild', files.xcodebuild);
    await writeScriptCommand(sandbox.path, 'node_modules/.bin/xcrun', files.xcrun);
    return await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift/coverage'] }),
    );
}
test('swift/coverage: XCTest coverage refuses an external result link and removes a previous result bundle', async () => {
    using _system = simulateOperatingSystem('darwin');
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': XCTEST_SETTINGS,
        'ExampleTests.swift': 'import XCTest\n',
        'Example.xcodeproj/project.pbxproj': '',
    });

    const files = {
        settings: XCTEST_SETTINGS,
        xcodebuild: `const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');\n`,
        xcrun: `console.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));\n`,
    };
    const session = await openSession(sandbox.path);
    const cache = buildPlan(session, planSandboxCheck(session, 'swift/coverage'), {
        purpose: 'coverage',
    }).folder;
    await writeFile(join(outside.path, 'authored.txt'), 'preserved');
    await mkdir(cache, { recursive: true });
    const bundle = join(cache, 'coverage.xcresult');
    await symlink(outside.path, bundle, 'dir');
    const refused = await runXcodeCoverage(sandbox, files);
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]?.note).toContain('is a link. gspot does not write through links.');
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
test('Swift package coverage measures actual custom target paths and applies every target limit', async () => {
    using _system = simulateOperatingSystem('darwin');
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
    await writeScriptCommand(
        sandbox.path,
        'node_modules/.bin/swift',
        `import { join } from 'node:path';
const files = (await Bun.file(${JSON.stringify(reportPath)}).json()).map((file) => ({ ...file, filename: join(process.cwd(), file.filename) }));
await Bun.write('coverage.json', JSON.stringify({ data: [{ files }] }));
if (process.argv.includes('--show-codecov-path')) console.log(join(process.cwd(), 'coverage.json'));
else if (process.argv.includes('describe')) console.log(${JSON.stringify(JSON.stringify({ targets: SWIFT_PACKAGE_COVERAGE_TARGETS }))});
`,
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

    expect(omitted.report.checks[0]?.note).toContain('The Swift coverage report has no source lines for target API.');
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
            settings: buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n${tables}`,
            }),
            xcodebuild: '',
            xcrun: `console.log(${JSON.stringify(JSON.stringify(report))});\n`,
        });
        expect(
            result.report.checks[0]?.findings.map((finding) => finding.message),
            JSON.stringify(result.report),
        ).toStrictEqual([...expected]);
    },
);
